import { describe, expect, it } from "vitest";
import type { Card, Document } from "../shared/model";
import { addCopy, newEntry, replacePrinting } from "../shared/deckEditing";
import { deckSearchTerms, includedCopies, matchesDeckRules } from "../shared/discovery";
const commander: Card = { id: "commander", name: "QA Commander", color_identity: ["G", "U"], type_line: "Legendary Creature", legalities: { commander: "legal" } };
const card: Card = { id: "printing-one", oracle_id: "card", name: "QA card", color_identity: ["G"], legalities: { commander: "legal" } };
const deck: Document = { id: "deck", name: "QA", kind: "deck", format: "commander", notes: "", revision: 1, entries: [newEntry(commander, "commander")] };
describe("in-deck discovery", () => {
  it("scopes additions to format and combined commander identity", () => {
    expect(deckSearchTerms(deck, "mainboard", true)).toEqual(["f:commander", "id<=gu"]);
    expect(deckSearchTerms({ ...deck, entries: [...deck.entries, newEntry({ ...commander, id: "partner", color_identity: ["W"] }, "commander")] }, "mainboard", true)).toEqual(["f:commander", "id<=guw"]);
  });
  it("does not restrict a replacement commander to the old identity", () => {
    expect(deckSearchTerms(deck, "commander", true)).toEqual(["f:commander", "is:commander"]);
  });
  it("supports explicit override, colorless commanders and incomplete metadata", () => {
    expect(deckSearchTerms(deck, "mainboard", false)).toEqual([]);
    expect(deckSearchTerms({ ...deck, entries: [newEntry({ ...commander, color_identity: [] }, "commander")] }, "mainboard", true)).toEqual(["f:commander", "id<=c"]);
    expect(deckSearchTerms({ ...deck, entries: [newEntry({ ...commander, color_identity: undefined }, "commander")] }, "mainboard", true)).toEqual(["f:commander"]);
  });
  it("counts oracle copies across printings on the selected board only", () => {
    let updated = addCopy(deck, card);
    updated = addCopy(updated, { ...card, id: "printing-two" });
    updated = addCopy(updated, card, "maybeboard");
    expect(includedCopies(updated, card, "mainboard")).toBe(2);
    expect(includedCopies(updated, card, "maybeboard")).toBe(1);
    expect(deck.entries).toHaveLength(1);
  });
  it("applies format and identity to owned-card discovery without changing inventory", () => {
    expect(matchesDeckRules(card, deck, "mainboard", true)).toBe(true);
    expect(matchesDeckRules({ ...card, color_identity: ["R"] }, deck, "mainboard", true)).toBe(false);
    expect(matchesDeckRules({ ...card, legalities: { commander: "banned" } }, deck, "mainboard", true)).toBe(false);
    expect(matchesDeckRules({ ...card, color_identity: ["R"] }, deck, "mainboard", false)).toBe(true);
  });
});

it("printing edits preserve row identity, copy count, notes and purchasing metadata", () => {
  const row = { ...newEntry(card), qty: 3, notes: "Keep", tags: "Ramp", purchasePrice: "0.50" };
  const original = { ...deck, entries: [...deck.entries, row] };
  const changed = replacePrinting(original, row.id, { ...card, id: "new-printing" },
    { qty: row.qty, board: row.board, language: row.language, finish: row.finish });
  expect(changed.entries).toHaveLength(original.entries.length);
  expect(changed.entries[1]).toMatchObject({ id: row.id, qty: 3, notes: "Keep", tags: "Ramp", purchasePrice: "0.50", card: { id: "new-printing" } });
  expect(original.entries[1].card.id).toBe("printing-one");
  expect(() => replacePrinting(original, "missing-row", card, row)).toThrow("This row changed");
});
