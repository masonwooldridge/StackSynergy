import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { Card, Document } from "../shared/model";
import { newEntry } from "../shared/deckEditing";
import {
  parseAIRequest,
  matchesAIRequest,
  pairMatchesAIRequest,
  countAIRequest,
  assertAIRequest,
  requestQuery,
  requestSummary,
} from "../shared/aiConstraints";
import {
  recommendAIUpgrades,
  aiCandidateQueries,
} from "../shared/aiUpgradeQuality";
import {
  proposeUpgrades,
  previewUpgrade,
  type UpgradePair,
} from "../shared/deckUpgrade";
const facts = JSON.parse(
    readFileSync(
      new URL("./fixtures/aiQualityCards.json", import.meta.url),
      "utf8",
    ),
  ).cards as Card[],
  c = (name: string) => structuredClone(facts.find((c) => c.name === name)!);
const req = (...texts: string[]) =>
  parseAIRequest(texts.map((content) => ({ role: "user", content })));
function deck() {
  const cmd = c("Satya, Aetherflux Genius"),
    land: Card = {
      id: crypto.randomUUID(),
      oracle_id: crypto.randomUUID(),
      name: "Plains",
      type_line: "Basic Land — Plains",
      color_identity: ["W"],
      legalities: { commander: "legal" },
      cmc: 0,
      prices: { usd: ".1" },
    },
    hill = c("Hill Giant");
  return {
    id: crypto.randomUUID(),
    name: "Constraint test",
    kind: "deck",
    format: "commander",
    commanderBracket: 3,
    revision: 0,
    notes: "",
    entries: [
      { ...newEntry(cmd), board: "commander" },
      { ...newEntry(land), qty: 36 },
      newEntry(c("Wall of Omens")),
      ...Array.from({ length: 62 }, (_, i) =>
        newEntry({
          ...hill,
          id: crypto.randomUUID(),
          oracle_id: crypto.randomUUID(),
          name: "Filler " + i,
        }),
      ),
    ],
  } as Document;
}
it.each([
  "Add more 5 mana creatures",
  "Add more 5-mana creatures",
  "More five mana creatures",
  "More creatures with mana value exactly 5",
  "More creatures at 5 mana",
  "More creatures costing exactly five",
])("parses exact five-mana creature intent: %s", (text) => {
  const r = req(text);
  expect(r.errors).toEqual([]);
  expect(r.manaValue).toBe(5);
  expect(r.relation).toBe("exact");
  expect(r.types).toEqual(["Creature"]);
  expect(r.intent).toBe("increase");
  expect(requestQuery(r)).toContain("mv=5");
});
it("does not broaden five to five-plus or accept noncreature/unknown-value cards", () => {
  const r = req("Add more 5 mana creatures"),
    mulldrifter = c("Mulldrifter");
  expect(matchesAIRequest(mulldrifter, r)).toBe(true);
  expect(matchesAIRequest({ ...mulldrifter, cmc: 6 }, r)).toBe(false);
  expect(
    matchesAIRequest({ ...mulldrifter, type_line: "Enchantment" }, r),
  ).toBe(false);
  expect(matchesAIRequest({ ...mulldrifter, cmc: undefined }, r)).toBe(false);
  expect(
    matchesAIRequest(
      {
        ...mulldrifter,
        type_line: "Enchantment // Creature",
        card_faces: [
          { name: "Front", type_line: "Enchantment" },
          { name: "Back", type_line: "Creature" },
        ],
      },
      r,
    ),
  ).toBe(false);
  expect(
    matchesAIRequest({ ...mulldrifter, cmc: 6 }, req("More 5+ mana creatures")),
  ).toBe(true);
});
it("persists exact constraints across follow-ups and changes them only when explicitly updated", () => {
  const r = req(
    "Add more five mana creatures",
    "Only cards I own, under $0",
    "Try a different suggestion",
    "Keep those restrictions",
    "Show more options",
  );
  expect(r.manaValue).toBe(5);
  expect(r.types).toEqual(["Creature"]);
  expect(r.ownedOnly).toBe(true);
  expect(r.purchaseBudget).toBe(0);
  expect(
    req("More 5 mana creatures", "Actually make them six mana").manaValue,
  ).toBe(6);
  expect(
    req("More 5 mana creatures", "Actually make them six mana").types,
  ).toEqual(["Creature"]);
});
it("rejects conflicting exact values rather than silently picking one", () => {
  expect(
    req("Add exactly 5 mana creatures and exactly 6 mana creatures").errors,
  ).not.toHaveLength(0);
  expect(
    req("Add more 5 mana creatures", "Actually exactly 6 mana creatures")
      .errors,
  ).toEqual([]);
});
it("more requires a positive group increase, while replacing matching five-drops permits an equal count", () => {
  const five = c("Mulldrifter"),
    more = req("Add more 5 mana creatures"),
    replace = req("Replace 5 mana creatures");
  expect(
    pairMatchesAIRequest(five, { ...five, id: crypto.randomUUID() }, more),
  ).toBe(false);
  expect(
    pairMatchesAIRequest(five, { ...five, id: crypto.randomUUID() }, replace),
  ).toBe(true);
  expect(pairMatchesAIRequest(c("Wall of Omens"), five, replace)).toBe(false);
});
it("offers only exact five-mana creatures and allows the explicitly requested curve increase from two to five", () => {
  const d = deck(),
    r = req("Add more 5 mana creatures"),
    before = JSON.stringify(d),
    six = {
      ...c("Mulldrifter"),
      id: crypto.randomUUID(),
      oracle_id: crypto.randomUUID(),
      name: "Six mana creature",
      cmc: 6,
    },
    noncreature = {
      ...c("Mulldrifter"),
      id: crypto.randomUUID(),
      oracle_id: crypto.randomUUID(),
      name: "Five mana noncreature",
      type_line: "Enchantment",
    },
    plan = recommendAIUpgrades(
      d,
      [six, noncreature, c("Mulldrifter")],
      [],
      5,
      false,
      "Add more 5 mana creatures",
      r,
    ).plan;
  expect(plan.pairs).toHaveLength(1);
  expect(plan.pairs[0].add.name).toBe("Mulldrifter");
  expect(plan.pairs[0].cut?.cmc).not.toBe(5);
  const after = previewUpgrade(
    plan,
    d,
    plan.pairs.map((p) => p.id),
    [],
  );
  expect(countAIRequest(after.document, r) - countAIRequest(d, r)).toBe(1);
  expect(() =>
    assertAIRequest(
      d,
      after.document,
      plan,
      plan.pairs.map((p) => p.id),
      r,
    ),
  ).not.toThrow();
  expect(JSON.stringify(d)).toBe(before);
});
it("returns no proposal when exact target conflicts with budget, ownership or protected slots", () => {
  const d = deck(),
    goal = "Add more 5 mana creatures",
    m = c("Mulldrifter");
  expect(
    recommendAIUpgrades(d, [m], [], 0, false, goal).plan.pairs,
  ).toHaveLength(0);
  expect(
    recommendAIUpgrades(d, [m], [], 10, true, goal).plan.pairs,
  ).toHaveLength(0);
  d.notes = d.entries.map((e) => e.card.name).join(";");
  expect(
    recommendAIUpgrades(d, [m], [], 10, false, goal).plan.pairs,
  ).toHaveLength(0);
  expect(requestSummary(req(goal))).toContain("exactly 5");
});
it("checks canonical changes again at apply and rejects equal matching cuts or too-small selected subsets", () => {
  const d = deck(),
    five = c("Mulldrifter"),
    old = {
      ...five,
      id: crypto.randomUUID(),
      oracle_id: crypto.randomUUID(),
      name: "Existing five",
    },
    r = req("Add more 5 mana creatures");
  d.entries[2] = newEntry(old);
  const pair: UpgradePair = {
    id: crypto.randomUUID(),
    cutId: d.entries[2].id,
    cutName: old.name,
    add: five,
    purchase: 0.33,
    owned: false,
    reason: "Test",
  };
  const plan = { ...proposeUpgrades(d, [], [], 5, false), pairs: [pair] },
    preview = previewUpgrade(plan, d, [pair.id], []);
  expect(() =>
    assertAIRequest(d, preview.document, plan, [pair.id], r),
  ).toThrow(/exact card type/);
  expect(() =>
    assertAIRequest(
      d,
      preview.document,
      plan,
      [pair.id],
      req("Replace 5 mana creatures"),
    ),
  ).not.toThrow();
  const fresh = deck(),
    increase = recommendAIUpgrades(
      fresh,
      [five],
      [],
      5,
      false,
      "More 5 mana creatures",
    ).plan,
    checked = previewUpgrade(
      increase,
      fresh,
      increase.pairs.map((p) => p.id),
      [],
    );
  expect(() =>
    assertAIRequest(
      fresh,
      checked.document,
      increase,
      increase.pairs.map((p) => p.id),
      req("Add two 5 mana creatures"),
    ),
  ).toThrow(/at least 2/);
});
it("filters every candidate search by exact type and value, including follow-up requests", () => {
  const r = req("More 5 mana creatures", "Try again"),
    queries = aiCandidateQueries(
      [c("Satya, Aetherflux Genius")],
      "Try again",
      r,
    );
  expect(
    queries.every(
      (q) => q.query.includes("mv=5") && q.query.includes("t:creature"),
    ),
  ).toBe(true);
});
