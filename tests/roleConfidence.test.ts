import { expect, it } from "vitest";
import type { Card } from "../shared/model";
import { roleConfidence, dependableRole } from "../shared/roleConfidence";
import { constructionRoles } from "../shared/constructionPlan";
import { deploymentCost } from "../shared/deploymentCost";
const c = (name: string, text = "", type = "Instant", cmc = 1): Card => ({
  id: crypto.randomUUID(),
  oracle_id: crypto.randomUUID(),
  name,
  oracle_text: text,
  type_line: type,
  cmc,
});
const commander = c(
  "Spells commander",
  "Whenever you cast an instant or sorcery spell, create a 2/2 blue Drake creature token.",
  "Legendary Creature",
);
it("keeps variable counters usable but separates them from dependable primary answers", () => {
  for (const text of [
    "Counter target spell unless its controller pays {X}.",
    "Counter target spell with mana value X.",
  ]) {
    const card = c("X answer", text);
    expect(roleConfidence(card).variableCounter).toBe(true);
    expect(constructionRoles(card, commander)).not.toContain("interaction");
    expect(deploymentCost(card).printedManaValue).toBe(1);
    expect(deploymentCost(card).notes.join(" ")).toContain("no X payment");
  }
  const tax = c(
    "Fixed tax",
    "Counter target spell unless its controller pays {3}.",
  );
  expect(constructionRoles(tax, commander)).toContain("interaction");
  expect(roleConfidence(tax).fixedTax).toBe(true);
  expect(
    constructionRoles(c("Direct counter", "Counter target spell."), commander),
  ).toContain("interaction");
});
it("does not confuse opponent land catch-up with unconditional ramp or reject it as illegal", () => {
  const scope = c(
    "Catch-up",
    "{T}, Exile this artifact: Search your library for up to X basic land cards, where X is the number of players who control at least two more lands than you. Put those cards onto the battlefield, then shuffle.",
    "Artifact",
    2,
  );
  expect(roleConfidence(scope).opponentLand).toBe(true);
  expect(constructionRoles(scope, commander)).not.toContain("ramp");
  expect(deploymentCost(scope).notes.join(" ")).toContain(
    "low-land plan may still use it",
  );
  const ramp = c(
    "Direct ramp",
    "Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.",
    "Sorcery",
    2,
  );
  expect(constructionRoles(ramp, commander)).toContain("ramp");
});
it("requires actual death support for delayed draw, not artifacts or unrelated token production", () => {
  const engine = c(
    "Delayed engine",
    "Whenever a creature you control dies, put a phyresis counter on this artifact. Then draw a card if it has seven or more phyresis counters on it. If it doesn't, scry 1.",
    "Artifact",
    2,
  );
  const creatures = Array.from({ length: 6 }, (_, i) =>
    c("Body " + i, "", "Creature"),
  );
  const unsupported = [
    ...creatures,
    c(
      "Food only",
      "At the beginning of your upkeep, create a Food token.",
      "Enchantment",
    ),
  ];
  expect(dependableRole(engine, "advantage", unsupported)).toBe(false);
  const outlet = c("Outlet", "Sacrifice a creature: Scry 1.", "Creature");
  const supported = [...creatures, outlet];
  expect(dependableRole(engine, "advantage", supported)).toBe(true);
  expect(roleConfidence(engine, supported).notes.join(" ")).toContain(
    "time to the threshold are not guaranteed",
  );
  const tokenFactory = c(
    "Tokens",
    "At the beginning of your upkeep, create a 1/1 white Soldier creature token.",
    "Enchantment",
  );
  expect(
    roleConfidence(engine, [...creatures.slice(0, 4), tokenFactory, outlet])
      .bodies,
  ).toBe(6);
  expect(
    roleConfidence(engine, [
      ...creatures.slice(0, 4),
      tokenFactory,
      { ...tokenFactory, id: crypto.randomUUID() },
      outlet,
    ]).bodies,
  ).toBe(6);
  expect(
    roleConfidence(engine, [
      ...creatures,
      c("Self only", "Sacrifice this creature: Draw a card.", "Creature"),
    ]).outlets,
  ).toBe(0);
});
it("preserves an independent entry draw burst and does not assume an attack payoff is immediate", () => {
  const engine = c(
    "Mixed engine",
    "When this artifact enters, draw two cards.\nWhenever a creature you control dies, put a charge counter on this artifact. Then draw a card if it has seven or more charge counters.",
    "Artifact",
  );
  expect(dependableRole(engine, "advantage")).toBe(true);
  const payoff = c(
    "Attack payoff",
    "Whenever a creature you control attacks, put a quest counter on this enchantment.\nAs long as this enchantment has seven or more quest counters on it, creatures you control get +5/+5.",
    "Enchantment",
  );
  expect(dependableRole(payoff, "finisher")).toBe(true);
  expect(roleConfidence(payoff).notes.join(" ")).toContain(
    "turn when it becomes active",
  );
});

it("does not let sideboard or maybeboard cards supply installed engine support", async () => {
  const { analyzeAIDeck } = await import("../shared/aiUpgradeQuality");
  const { newEntry } = await import("../shared/deckEditing");
  const { activeDeckCards } = await import("../shared/deckContext");
  const leader = c("Nymph leader", "", "Legendary Creature — Nymph");
  const engine = c(
    "Shared cast engine",
    "Whenever you cast a spell that shares a creature type with your commander, draw a card.",
    "Enchantment",
  );
  const supports = Array.from({ length: 6 }, (_, i) => ({
    ...newEntry(c("Nymph " + i, "", "Creature — Nymph")),
    board: "maybeboard" as const,
  }));
  const d = {
    id: crypto.randomUUID(),
    name: "Disposable support boundary",
    kind: "deck" as const,
    format: "commander" as const,
    notes: "",
    revision: 0,
    entries: [
      { ...newEntry(leader), board: "commander" as const },
      newEntry(engine),
      ...supports,
    ],
  };
  expect(analyzeAIDeck(d)?.roles.advantage).toBe(0);
  expect(activeDeckCards(d)).toHaveLength(2);
  const supported = {
    ...d,
    entries: d.entries.map((e) =>
      e.board === "maybeboard" ? { ...e, board: "mainboard" as const } : e,
    ),
  };
  expect(analyzeAIDeck(supported)?.roles.advantage).toBe(1);
  const side = {
    ...d,
    entries: d.entries.map((e) =>
      e.board === "maybeboard" ? { ...e, board: "sideboard" as const } : e,
    ),
  };
  expect(analyzeAIDeck(side)?.roles.advantage).toBe(0);
});

it("keeps narrow target-dependent counters distinct from broad creature/noncreature spell answers", () => {
  expect(
    constructionRoles(
      c("Target-only counter", "Counter target spell that targets a creature."),
      commander,
    ),
  ).not.toContain("interaction");
  expect(
    constructionRoles(
      c("Creature spell counter", "Counter target creature spell."),
      commander,
    ),
  ).toContain("interaction");
  expect(
    constructionRoles(
      c("Noncreature spell counter", "Counter target noncreature spell."),
      commander,
    ),
  ).toContain("interaction");
});

it("associates the draw threshold with its own clause rather than an earlier animation threshold", () => {
  const card = c(
    "Dual threshold",
    "As long as this artifact has four or more phyresis counters, it is a creature.\nWhenever a creature you control dies, put a phyresis counter on it. Then draw a card if it has seven or more phyresis counters.",
    "Artifact",
  );
  expect(roleConfidence(card).drawThreshold).toBe(7);
  expect(roleConfidence(card).notes.join(" ")).toContain(
    "needs 7 phyresis counters",
  );
  expect(
    constructionRoles(
      c("Player target only", "Counter target spell that targets a player."),
      commander,
    ),
  ).not.toContain("interaction");
});
