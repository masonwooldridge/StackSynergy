import { expect, it } from "vitest";
import type { Card } from "../shared/model";
import { castModes, castThresholdProfile } from "../shared/castThreshold";
import { constructionRoles } from "../shared/constructionPlan";
import { buildCommanderDeck } from "../shared/deckBuilder";
const c = (
  name: string,
  cost = "{4}{G}",
  type = "Creature",
  text = "",
): Card => ({
  id: crypto.randomUUID(),
  oracle_id: crypto.randomUUID(),
  name,
  mana_cost: cost,
  cmc: 5,
  type_line: type,
  oracle_text: text,
  prices: { usd: "0.1" },
  color_identity: ["G"],
  legalities: { commander: "legal" },
});
const engine = c(
    "Threshold canopy",
    "{1}{G}",
    "Enchantment",
    "When this enchantment enters and whenever you cast a spell with mana value 5 or greater, draw a card.",
  ),
  cmd = c("Leader", "{1}{G}", "Legendary Creature");
it("keeps low-density entry cantrips available without filling supported-engine quotas", () => {
  const low = [c("Large")];
  expect(castThresholdProfile(engine, low)).toMatchObject({
    eligible: 1,
    entryCantrip: true,
    supported: false,
  });
  expect(constructionRoles(engine, cmd, low)).not.toContain("advantage");
  const high = Array.from({ length: 6 }, (_, i) => c("Large " + i));
  expect(constructionRoles(engine, cmd, high)).toContain("advantage");
  const burst = {
    ...engine,
    oracle_text:
      "When this enchantment enters, draw two cards. Whenever you cast a spell with mana value 5 or greater, draw a card.",
  };
  expect(constructionRoles(burst, cmd, low)).toContain("advantage");
  const land = { ...c("Forest", "", "Basic Land — Forest"), cmc: 0 };
  const result = buildCommanderDeck({
    commander: cmd,
    candidates: [
      land,
      engine,
      ...Array.from({ length: 62 }, (_, i) => ({
        ...c("Small " + i, "{G}"),
        cmc: 1,
      })),
    ],
    documents: [],
    mode: "buy",
    budget: 200,
    budgetMeaning: "deck",
    fetchedAt: "synthetic fixture",
  });
  expect(result.complete).toBe(true);
  expect(result.document.entries.some((e) => e.card.id === engine.id)).toBe(
    true,
  );
  expect(
    result.construction?.roles.find((r) => r.role === "advantage")?.count,
  ).toBe(0);
});
it("uses cast face costs rather than split totals or transformed backs, and deduplicates sources", () => {
  const split = {
    ...c("Two // Three", "{1}{G} // {2}{G}", "Instant // Sorcery"),
    layout: "split",
    cmc: 5,
    card_faces: [
      { name: "Two", type_line: "Instant", mana_cost: "{1}{G}" },
      { name: "Three", type_line: "Sorcery", mana_cost: "{2}{G}" },
    ],
  };
  expect(castThresholdProfile(engine, [split])?.eligible).toBe(0);
  expect(
    castThresholdProfile(engine, [{ ...split, oracle_text: "Fuse" }])
      ?.conditional,
  ).toBe(1);
  const adventure = {
    ...c("Adventure", "{G}"),
    layout: "adventure",
    cmc: 1,
    card_faces: [
      { name: "Small", type_line: "Creature", mana_cost: "{G}" },
      {
        name: "Large adventure",
        type_line: "Sorcery — Adventure",
        mana_cost: "{6}{G}",
      },
    ],
  };
  expect(
    castThresholdProfile(engine, [
      adventure,
      { ...adventure, id: crypto.randomUUID() },
    ]),
  ).toMatchObject({ eligible: 1, alternate: 1 });
  const modal = {
    ...adventure,
    layout: "modal_dfc",
    card_faces: [
      { name: "Land", type_line: "Land" },
      { name: "Large spell", type_line: "Sorcery", mana_cost: "{5}{G}" },
    ],
  };
  expect(castThresholdProfile(engine, [modal])).toMatchObject({
    eligible: 1,
    alternate: 1,
  });
  expect(
    castThresholdProfile(engine, [{ ...adventure, layout: "transform" }])
      ?.eligible,
  ).toBe(0);
});
it("does not assume an X payment or permission for no-cost cards, and respects hybrid printed values", () => {
  expect(
    castThresholdProfile(engine, [c("X spell", "{X}{X}{G}")]),
  ).toMatchObject({ eligible: 0, conditional: 1 });
  expect(
    castThresholdProfile(engine, [c("Already large X", "{X}{5}{G}")])?.eligible,
  ).toBe(1);
  expect(castModes(c("Hybrid", "{2/G}{2/G}{G}"))[0].value).toBe(5);
  const noCost = { ...c("No normal cost", ""), cmc: 6 };
  expect(castThresholdProfile(engine, [noCost])?.eligible).toBe(0);
  expect(
    castThresholdProfile(engine, [
      { ...c("Delve", "{6}{G}"), oracle_text: "Delve" },
    ])?.eligible,
  ).toBe(1);
});
it("handles exact/min/max and qualified spell types on the relevant cast face", () => {
  const exact = {
      ...engine,
      oracle_text:
        "Whenever you cast a creature spell with mana value 5, draw a card.",
    },
    maximum = {
      ...engine,
      oracle_text:
        "Whenever you cast a noncreature spell with mana value 3 or less, draw a card.",
    };
  expect(
    castThresholdProfile(exact, [
      c("Five"),
      c("Six", "{5}{G}"),
      c("Artifact", "{4}{G}", "Artifact"),
    ])?.eligible,
  ).toBe(1);
  expect(
    castThresholdProfile(maximum, [
      c("Small creature", "{G}"),
      c("Small spell", "{G}", "Sorcery"),
      c("X spell", "{X}{G}", "Instant"),
    ]),
  ).toMatchObject({ eligible: 1, conditional: 1 });
  const unknown = {
    ...engine,
    oracle_text:
      "Whenever you cast a purple spell with mana value 5 or greater, draw a card.",
  };
  expect(castThresholdProfile(unknown, [c("Five")])).toMatchObject({
    qualifierUnderstood: false,
    supported: false,
  });
});

it("does not fill broad-answer quotas with random resets, temporary blink or graveyard-only exile", async () => {
  const { supportQuality } = await import("../shared/constructionPlan");
  for (const card of [
    c(
      "Random",
      "{4}",
      "Artifact",
      "{T}: Flip a coin. If you win the flip, destroy all nonland permanents.",
    ),
    c(
      "Power restricted",
      "{4}",
      "Artifact",
      "When this enters, exile all creatures with power 5 or greater until this leaves the battlefield.",
    ),
  ])
    expect(constructionRoles(card, cmd)).not.toContain("wipes");
  for (const text of [
    "Exile target creature. Return the exiled card to the battlefield under its owner's control at the beginning of the next end step.",
    "Exile target creature card from a graveyard.",
    "Destroy target nonland permanent with the lowest mana value.",
  ])
    expect(
      constructionRoles(c("Utility", "{2}", "Artifact", text), cmd),
    ).not.toContain("interaction");
  const slow = {
      ...c(
        "Slow",
        "{1}",
        "Artifact",
        "{6}, {T}: Destroy target nonland permanent.",
      ),
      cmc: 1,
    },
    fast = {
      ...c(
        "Efficient",
        "{1}",
        "Artifact",
        "{1}, {T}: Destroy target nonland permanent.",
      ),
      cmc: 1,
    };
  expect(supportQuality(fast, "interaction", cmd)).toBeGreaterThan(
    supportQuality(slow, "interaction", cmd),
  );
  expect(constructionRoles(slow, cmd)).toContain("interaction");
});

it("keeps voting outcomes, tapped-only resets and own-only destruction out of guaranteed answer quotas", () => {
  expect(
    constructionRoles(
      c(
        "Vote",
        "{4}",
        "Artifact",
        "Each player votes. If carnage gets more votes, destroy all nonland permanents. If the vote is tied, draw a card.",
      ),
      cmd,
    ),
  ).not.toContain("wipes");
  expect(
    constructionRoles(
      c("Tapped reset", "{4}", "Artifact", "Exile all untapped creatures."),
      cmd,
    ),
  ).not.toContain("wipes");
  expect(
    constructionRoles(
      c(
        "Own outlet",
        "{1}",
        "Artifact",
        "{T}: Destroy target permanent you own.",
      ),
      cmd,
    ),
  ).not.toContain("interaction");
  expect(
    constructionRoles(
      c(
        "Name counter",
        "{3}",
        "Artifact",
        "Counter target spell if it has the same name as that card.",
      ),
      cmd,
    ),
  ).not.toContain("interaction");
  expect(
    constructionRoles(
      c("Normal counter", "{U}{U}", "Instant", "Counter target spell."),
      cmd,
    ),
  ).toContain("interaction");
});

it("does not assume either outcome of a coin flip is guaranteed", () => {
  expect(
    constructionRoles(
      c(
        "Lose-flip reset",
        "{4}",
        "Artifact",
        "When this dies, flip a coin. If you lose the flip, it deals 4 damage to each creature.",
      ),
      cmd,
    ),
  ).not.toContain("wipes");
});
