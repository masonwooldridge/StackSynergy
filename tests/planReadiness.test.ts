import { expect, it } from "vitest";
import { planReadiness, deckPlanReadiness } from "../shared/planReadiness";
import type { Card, Document } from "../shared/model";
import { newEntry } from "../shared/deckEditing";
it("distinguishes a structurally complete low-budget zero-finisher draft from strategic readiness without changing the draft", () => {
  const input = {
    complete: true,
    count: 100,
    roles: [
      { role: "ramp", count: 3, target: 8 },
      { role: "advantage", count: 0, target: 5 },
      { role: "finisher", count: 0, target: 5 },
    ],
    intent: { supplementalDraw: "reduced" as const },
  };
  const before = JSON.stringify(input),
    r = planReadiness(input);
  expect(r.level).toBe("review-shortfalls");
  expect(r.title).toContain("plan shortfalls");
  expect(r.shortfalls.find((x) => x.role === "finisher")).toMatchObject({
    count: 0,
    target: 5,
  });
  expect(r.commanderDrawNote).toContain(
    "not a claim that the deck cannot draw",
  );
  expect(r.structuralComplete).toBe(true);
  expect(JSON.stringify(input)).toBe(before);
});
it("keeps restricted owned-only incompleteness distinct and never invents a cap or grants structural success", () => {
  const r = planReadiness({
    complete: false,
    count: 49,
    roles: [{ role: "finisher", count: 0, target: 5 }],
  });
  expect(r.level).toBe("incomplete");
  expect(r.title).toContain("49-card");
  expect(r.structuralComplete).toBe(false);
  expect(r.choices.join()).toContain("verified card source");
  expect(r.choices.join()).toContain("no new cap");
});
it("grounds current overlapping counts and commander draw dependence without reusing stale primary allocations", () => {
  const c: Card = {
      id: crypto.randomUUID(),
      oracle_id: crypto.randomUUID(),
      name: "Fixture token commander",
      type_line: "Legendary Creature",
      oracle_text: "Tap three untapped tokens you control: Draw a card.",
      color_identity: [],
      legalities: { commander: "legal" },
      mana_cost: "{3}",
      cmc: 3,
    },
    w: Card = {
      id: crypto.randomUUID(),
      name: "Wastes",
      type_line: "Basic Land",
      oracle_text: "{T}: Add {C}.",
      color_identity: [],
      legalities: { commander: "legal" },
    };
  const d: Document = {
    id: crypto.randomUUID(),
    kind: "deck",
    name: "Disposable",
    format: "commander",
    notes: 'Build intent: {"primary":"tokens","supplementalDraw":"reduced"}',
    revision: 0,
    entries: [
      { ...newEntry(c), board: "commander" },
      { ...newEntry(w), qty: 99 },
    ],
  };
  const r = deckPlanReadiness(d)!;
  expect(r.count).toBe(100);
  expect(r.basis).toContain("overlapping");
  expect(r.shortfalls.find((x) => x.role === "advantage")?.count).toBe(0);
  expect(r.commanderDrawNote).toBeTruthy();
  expect(r.budgetVerified).toBe(false);
});
