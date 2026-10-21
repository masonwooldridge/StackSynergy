import { expect, it } from "vitest";
import type { Card } from "../shared/model";
import {
  mechanicalPrerequisites,
  eligibleAdventure,
  typeSupportCount,
  acceleration,
} from "../shared/mechanicalSupport";
import { constructionRoles } from "../shared/constructionPlan";
import { buildCommanderDeck } from "../shared/deckBuilder";
import {
  commanderSignals,
  rankCommanderCards,
} from "../shared/commanderRelevance";
import { packageTargets } from "../shared/themePackages";
const c = (
  name: string,
  text = "",
  type = "Creature",
  price = "0.1",
): Card => ({
  id: crypto.randomUUID(),
  oracle_id: crypto.randomUUID(),
  name,
  oracle_text: text,
  type_line: type,
  cmc: 2,
  mana_cost: "{1}{G}",
  prices: { usd: price },
  finishes: ["nonfoil"],
  color_identity: ["G"],
  legalities: { commander: "legal" },
});
const leader = c("Fixture leader", "", "Legendary Creature"),
  land = c("Forest", "{T}: Add {G}.", "Basic Land — Forest");
it("uses actual creature Adventure front faces, not six arbitrary Adventure layouts", () => {
  const engine = c(
    "Engine",
    "Whenever you cast a creature spell that has an Adventure, draw a card.",
  );
  const adventure = (i: number, type = "Creature") => ({
    ...c("Adventure " + i, "", type),
    layout: "adventure",
    card_faces: [
      { name: "Front", type_line: type },
      { name: "Spell", type_line: "Sorcery — Adventure" },
    ],
  });
  const six = Array.from({ length: 6 }, (_, i) => adventure(i));
  expect(eligibleAdventure(adventure(8, "Land"))).toBe(false);
  expect(eligibleAdventure(adventure(9, "Enchantment"))).toBe(false);
  expect(mechanicalPrerequisites(engine, six)).toEqual([]);
  expect(
    mechanicalPrerequisites(engine, [
      ...six.slice(0, 3),
      ...Array.from({ length: 3 }, (_, i) => adventure(i + 10, "Land")),
    ]).join(),
  ).toContain("3 selected");
});
it("recognizes creature-type and own token support without assuming opponents supply it", () => {
  const spell = c(
      "Conditional answer",
      "Exile target creature that blocked or was blocked by a Zombie this turn.",
      "Instant",
    ),
    wallSpell = c(
      "Conditional sweep",
      "Cast this spell only after combat. Destroy all creatures that were blocked by target Wall this turn.",
      "Instant",
    );
  expect(mechanicalPrerequisites(spell, [leader]).length).toBe(1);
  expect(
    mechanicalPrerequisites(spell, [
      c("Tribal leader", "", "Legendary Creature — Zombie"),
    ]),
  ).toEqual([]);
  const source = c(
    "Own token engine",
    "Create two 2/2 black Zombie creature tokens.",
    "Enchantment",
  );
  expect(typeSupportCount("Zombie", [source, source])).toBe(1);
  expect(mechanicalPrerequisites(spell, [source])).toEqual([]);
  expect(
    typeSupportCount("Zombie", [
      c(
        "Opponent gift",
        "Target opponent creates a 2/2 black Zombie creature token.",
        "Instant",
      ),
    ]),
  ).toBe(0);
  expect(
    mechanicalPrerequisites(wallSpell, [c("Defender", "", "Creature — Wall")]),
  ).toEqual([]);
  expect(constructionRoles(wallSpell, leader)).not.toContain("wipes");
  expect(constructionRoles(spell, leader)).not.toContain("interaction");
});
it("distinguishes counter/combat-dependent value from reliable support without banning the cards", () => {
  const conditionalDraw = c(
      "Counter watcher",
      "Whenever a spell you've cast is countered, draw a card.",
      "Enchantment",
    ),
    combatRamp = c(
      "Combat aura",
      "Enchant creature\nWhenever enchanted creature deals combat damage to a player, search your library for a basic land card, put it onto the battlefield tapped, then shuffle.",
      "Enchantment",
    );
  expect(constructionRoles(conditionalDraw, leader)).not.toContain("advantage");
  expect(acceleration(combatRamp)).toBe(false);
  expect(
    constructionRoles(
      c(
        "Direct ramp",
        "Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.",
        "Sorcery",
      ),
      leader,
    ),
  ).toContain("ramp");
  expect(
    constructionRoles(
      c(
        "Own draw",
        "Whenever you cast an enchantment spell, draw a card.",
        "Enchantment",
      ),
      leader,
    ),
  ).toContain("advantage");
  const wallLeader = c("Wall leader", "", "Legendary Creature — Wall"),
    spell = c(
      "Wall utility",
      "Destroy all creatures that were blocked by target Wall this turn.",
      "Instant",
    ),
    r = buildCommanderDeck({
      commander: wallLeader,
      candidates: [
        land,
        spell,
        ...Array.from({ length: 62 }, (_, i) => c("Body " + i)),
      ],
      documents: [],
      mode: "buy",
      budget: 200,
      budgetMeaning: "deck",
      fetchedAt: "synthetic fixture",
    });
  expect(r.complete).toBe(true);
  expect(r.document.entries.some((e) => e.card.id === spell.id)).toBe(true);
  expect(r.construction?.warnings.join()).toContain("Combat-dependent");
});
it("derives cast specialization from commander rules and preserves structural/category balance", () => {
  const enchantress = c(
    "Cast leader",
    "Whenever you cast an enchantment spell, draw a card.",
    "Legendary Creature",
  );
  expect(commanderSignals([enchantress]).castTypes).toContain("Enchantment");
  expect(packageTargets(enchantress)["Enchantment spells"]).toBe(28);
  const enchant = c("Enchantment draw", "Draw two cards.", "Enchantment"),
    instant = c("Instant draw", "Draw two cards.", "Instant");
  expect(rankCommanderCards([enchant, instant], [enchantress])[0].card.id).toBe(
    enchant.id,
  );
  const utility = [
    ...Array.from({ length: 10 }, (_, i) =>
      c(
        "Ramp " + i,
        "When this enters, search your library for a basic land card, put it onto the battlefield tapped, then shuffle.",
        "Enchantment",
      ),
    ),
    ...Array.from({ length: 10 }, (_, i) =>
      c(
        "Draw " + i,
        "At the beginning of your upkeep, draw a card.",
        "Enchantment",
      ),
    ),
    ...Array.from({ length: 10 }, (_, i) =>
      c(
        "Answer " + i,
        "When this enters, exile target creature.",
        "Enchantment",
      ),
    ),
    ...Array.from({ length: 8 }, (_, i) =>
      c("Shield " + i, "Creatures you control have hexproof.", "Enchantment"),
    ),
    ...Array.from({ length: 6 }, (_, i) =>
      c(
        "Pump " + i,
        "Creatures you control get +3/+3 and have trample.",
        "Enchantment",
      ),
    ),
    ...Array.from({ length: 4 }, (_, i) =>
      c("Sweep " + i, "Destroy all creatures.", "Sorcery"),
    ),
    ...Array.from({ length: 50 }, (_, i) => c("Filler " + i)),
  ];
  const r = buildCommanderDeck({
    commander: enchantress,
    candidates: [land, ...utility],
    documents: [],
    mode: "buy",
    budget: 200,
    budgetMeaning: "deck",
    fetchedAt: "synthetic fixture",
  });
  expect(r.complete).toBe(true);
  expect(
    r.document.entries.filter(
      (e) =>
        e.board === "mainboard" && /Enchantment/.test(e.card.type_line || ""),
    ).length,
  ).toBeGreaterThanOrEqual(28);
  expect(r.construction?.roles.find((x) => x.role === "wipes")?.count).toBe(3);
  expect(
    r.document.entries
      .filter((e) => /Land/.test(e.card.type_line || ""))
      .reduce((n, e) => n + e.qty, 0),
  ).toBe(36);
  const artifactLeader = c(
    "Artifact leader",
    "Whenever you cast an artifact spell, create a token.",
    "Legendary Creature",
  );
  expect(packageTargets(artifactLeader)["Artifact spells"]).toBe(24);
  expect(
    rankCommanderCards(
      [c("Artifact", "", "Artifact"), c("Body")],
      [artifactLeader],
    )[0].card.type_line,
  ).toBe("Artifact");
});

it("does not read draw watchers or mana fixing as draw/acceleration, but keeps genuine extra mana", () => {
  expect(
    constructionRoles(
      c(
        "Watcher",
        "If you would begin your draw step, you may skip that step instead. When you draw a card, destroy this enchantment.",
        "Enchantment",
      ),
      leader,
    ),
  ).not.toContain("advantage");
  expect(
    acceleration(
      c(
        "Fixing",
        "Enchant land. Enchanted land has '{T}: Add one mana of any color.'",
        "Enchantment",
      ),
    ),
  ).toBe(false);
  expect(
    acceleration(
      c(
        "Extra mana",
        "Enchant land. Whenever enchanted land is tapped for mana, its controller adds an additional {G}.",
        "Enchantment",
      ),
    ),
  ).toBe(true);
  expect(
    mechanicalPrerequisites(
      c("Specific aura", "Enchant Mountain you control", "Enchantment"),
      [land],
    ).length,
  ).toBe(1);
  expect(
    mechanicalPrerequisites(
      c(
        "Generic anthem",
        "Other creatures you control get +3/+3.",
        "Enchantment",
      ),
      [leader],
    ),
  ).toEqual([]);
  const elves = c(
    "Elf anthem",
    "Elf creatures you control get +3/+3.",
    "Enchantment",
  );
  expect(
    mechanicalPrerequisites(elves, [
      c(
        "Elf maker",
        "Create two 1/1 green Elf creature tokens.",
        "Enchantment",
      ),
    ]),
  ).toEqual([]);
  expect(
    constructionRoles(elves, c("Elf leader", "", "Legendary Creature — Elf")),
  ).toContain("finisher");
});

it("keeps delayed sweeps and narrow retaliation as utilities rather than immediate broad support", () => {
  expect(
    constructionRoles(
      c(
        "Delayed reset",
        "At the beginning of your upkeep, if there are four or more creatures on the battlefield, destroy all creatures.",
        "Enchantment",
      ),
      leader,
    ),
  ).not.toContain("wipes");
  expect(
    constructionRoles(
      c("Flying answer", "Destroy target creature with flying.", "Instant"),
      leader,
    ),
  ).not.toContain("interaction");
  expect(
    constructionRoles(
      c(
        "Retaliation",
        "Destroy target creature that dealt damage to you this turn.",
        "Artifact",
      ),
      leader,
    ),
  ).not.toContain("interaction");
});
