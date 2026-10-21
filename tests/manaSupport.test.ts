import { expect, it } from "vitest";
import type { Card, Document } from "../shared/model";
import { manaProfile, manaAvailability } from "../shared/mtgCardFunctions";
import {
  colorlessSupport,
  basicManaTargets,
  fitsSelectedColorlessBase,
} from "../shared/basicMana";
import { newEntry } from "../shared/deckEditing";
import { assessAIUpgrade } from "../shared/aiUpgradeQuality";
const c = (
  name: string,
  text = "",
  type = "Artifact",
  cost = "{2}",
  cmc = 2,
): Card => ({
  id: crypto.randomUUID(),
  oracle_id: crypto.randomUUID(),
  name,
  oracle_text: text,
  type_line: type,
  mana_cost: cost,
  cmc,
  color_identity: [],
  legalities: { commander: "legal" },
  prices: { usd: ".1" },
  finishes: ["nonfoil"],
});
const leader = {
    ...c("BG fixture commander", "", "Legendary Creature", "{2}{B}{G}", 4),
    color_identity: ["B", "G"],
  },
  forest = c("Forest", "{T}: Add {G}.", "Basic Land — Forest", "", 0),
  wastes = c("Wastes", "{T}: Add {C}.", "Basic Land", "", 0),
  answer = c(
    "Explicit C fixture answer",
    "Counter target spell.",
    "Instant",
    "{1}{C}",
    2,
  ),
  ring = c("Independent C fixture", "{T}: Add {C}{C}.", "Artifact", "{1}", 1),
  creature = c(
    "Creature C fixture",
    "{T}: Add {C}.",
    "Artifact Creature — Construct",
    "{2}",
    2,
  );
it("distinguishes explicit colorless costs from generic payment and supplies a supported early splash without increasing land slots", () => {
  const base = [
    { card: leader, qty: 1 },
    {
      card: {
        ...c("Green demand", "", "Creature", "{G}{G}", 2),
        color_identity: ["G"],
      },
      qty: 60,
    },
    { card: forest, qty: 35 },
  ];
  expect(colorlessSupport(base).required).toEqual([]);
  const generic = { ...answer, mana_cost: "{2}" };
  expect(
    colorlessSupport([...base, { card: generic, qty: 1 }]).required,
  ).toEqual([]);
  const t = basicManaTargets(
    [...base, { card: answer, qty: 1 }],
    ["B", "G"],
    35,
    leader,
  );
  expect(t.C).toBeGreaterThanOrEqual(8);
  expect(t.G + t.B + t.C).toBe(35);
  expect(t.B).toBeGreaterThanOrEqual(8);
  const supported = [
    { card: forest, qty: 27 },
    { card: wastes, qty: 8 },
    { card: answer, qty: 1 },
  ];
  expect(colorlessSupport(supported)).toMatchObject({
    creditedSources: 8,
    planningTarget: 8,
    meetsPlanningTarget: true,
  });
});
it("credits fast independent rocks but separates own-creature tap timing and conditional resource payments", () => {
  expect(manaAvailability(ring)).toMatchObject({
    fastIndependentColorless: true,
  });
  expect(manaAvailability(creature)).toMatchObject({
    fastIndependentColorless: false,
    summoningDelay: true,
    delayedColorless: true,
  });
  expect(
    manaAvailability({ ...creature, oracle_text: "Haste\n{T}: Add {C}." })
      .fastIndependentColorless,
  ).toBe(true);
  const engine = c(
    "Tap engine",
    "{T}, Tap an untapped artifact or creature you control: Add {C}.",
    "Artifact",
    "{U}",
    1,
  );
  expect(manaProfile(engine).reliableAcceleration).toBe(false);
  expect(manaProfile(engine).manaRock).toBe(true);
  expect(manaAvailability(engine)).toMatchObject({
    conditionalColorless: true,
    fastIndependentColorless: false,
    conditionalSupportInList: false,
  });
  const tokenFactory = c(
    "Lasting token fixture",
    "At the beginning of your upkeep, create a 1/1 white Soldier creature token.",
    "Enchantment",
  );
  expect(manaAvailability(engine, [tokenFactory])).toMatchObject({
    conditionalSupportInList: true,
    selectedEnablers: 1,
    fastIndependentColorless: false,
  });
  expect(
    manaAvailability(engine, [c("Other artifact")]).conditionalSupportInList,
  ).toBe(true);
  const onlyCreature = c(
    "Creature tap engine",
    "{T}, Tap an untapped creature you control: Add {C}.",
  );
  const food = c("Food fixture", "Create a Food token.", "Sorcery");
  expect(manaAvailability(onlyCreature, [food]).conditionalSupportInList).toBe(
    false,
  );
});
it("does not credit one-shot, restricted, circular or expensive production as a fast independent source", () => {
  for (const card of [
    c("Sacrifice", "{T}, Sacrifice this artifact: Add {C}."),
    c("Evidence", "{T}, Collect evidence 3: Add {C}."),
    c("Large", "{T}: Add {C}{C}.", "Artifact", "{5}", 5),
    c("Circular", "{T}: Add {C}.", "Artifact", "{C}", 1),
  ])
    expect(manaAvailability(card).fastIndependentColorless).toBe(false);
  expect(
    manaAvailability(c("Colored only", "{T}: Add one mana of any color."))
      .explicitColorless,
  ).toBe(false);
});
it("counts independent sources once per card quantity, preserves C shells, and ignores sideboards as support", () => {
  const rocks = Array.from({ length: 8 }, (_, i) => ({
    ...newEntry(c("Rock " + i, "{T}: Add {C}.", "Artifact", "{1}", 1)),
  }));
  const support = colorlessSupport([...rocks, newEntry(answer)]);
  expect(support).toMatchObject({
    fastIndependentNonlands: 8,
    meetsPlanningTarget: true,
  });
  expect(
    colorlessSupport(
      rocks
        .map((e) => ({ ...e, board: "maybeboard" }))
        .concat(newEntry(answer)),
    ).creditedSources,
  ).toBe(0);
  expect(
    colorlessSupport([
      { card: wastes, qty: 36 },
      { card: answer, qty: 1 },
    ]),
  ).toMatchObject({ directLandSources: 36, meetsPlanningTarget: true });
});
it("blocks an unsupported cheap C recommendation against a fixed mana base while allowing a supported one", () => {
  const filler = Array.from({ length: 63 }, (_, i) =>
    newEntry({
      ...c("Filler " + i, "", "Creature", "{1}{G}", 2),
      color_identity: ["G"],
    }),
  );
  const deck: Document = {
    id: crypto.randomUUID(),
    name: "Disposable C guard fixture",
    kind: "deck",
    format: "commander",
    notes: "",
    revision: 0,
    entries: [
      { ...newEntry(leader), board: "commander" },
      { ...newEntry(forest), qty: 36 },
      ...filler,
    ],
  };
  expect(
    assessAIUpgrade(deck, filler[0], answer, "Improve interaction.").why,
  ).toContain("explicit-colorless");
  const supported = {
    ...deck,
    entries: [
      ...deck.entries.filter((e) => e.card.name !== "Forest"),
      { ...newEntry(forest), qty: 28 },
      { ...newEntry(wastes), qty: 8 },
    ],
  };
  expect(
    assessAIUpgrade(supported, filler[0], answer, "Improve interaction.")
      .accepted,
  ).toBe(true);
});

it("keeps automatic explicit-C additions within the selected base while retaining dedicated C commanders", () => {
  const bg = [{ card: forest, qty: 36 }];
  expect(fitsSelectedColorlessBase(answer, bg, leader)).toBe(false);
  expect(
    fitsSelectedColorlessBase({ ...answer, mana_cost: "{2}" }, bg, leader),
  ).toBe(true);
  expect(
    fitsSelectedColorlessBase(
      answer,
      [
        { card: wastes, qty: 8 },
        { card: forest, qty: 28 },
      ],
      leader,
    ),
  ).toBe(true);
  expect(
    fitsSelectedColorlessBase(answer, bg, { ...leader, mana_cost: "{2}{C}" }),
  ).toBe(true);
});
