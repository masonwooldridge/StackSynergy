import { expect, it } from "vitest";
import type { Card, Board } from "../shared/model";
import { newEntry } from "../shared/deckEditing";
import { availableSuggestions, sameSuggestedCard } from "../shared/suggestionMembership";
const card: Card = { id: "printing-a", oracle_id: "oracle-a", name: "Front // Back", card_faces: [{ name: "Front" }, { name: "Back" }] };
const other: Card = { id: "other", oracle_id: "oracle-other", name: "Other" };
it("excludes alternate printings on every deck board before taking recommendation slots", () => {
  for (const board of ["commander", "mainboard", "sideboard", "maybeboard"] as Board[]) {
    const deck = { entries: [{ ...newEntry(card), board }] };
    expect(availableSuggestions([{ ...card, id: "printing-b" }, other], deck).slice(0, 1)).toEqual([other]);
  }
});
it("matches face-only legacy records and normalizes exact aliases without substring matches", () => {
  expect(sameSuggestedCard(card, { id: "face", name: " BACK " })).toBe(true);
  expect(sameSuggestedCard(card, { id: "face", name: "Frontier" })).toBe(false);
  expect(sameSuggestedCard(card, { ...card, id: "different", oracle_id: "different" })).toBe(false);
});
it("recomputes add, remove, undo, board movement and deck switches without excluding collection ownership", () => {
  const empty = { entries: [] };
  const added = { entries: [newEntry(card)] };
  const pool = [card, { ...card, id: "alternate" }, other];
  expect(availableSuggestions(pool, empty)).toEqual([card, other]);
  expect(availableSuggestions(pool, added)).toEqual([other]);
  expect(availableSuggestions(pool, { entries: [{ ...added.entries[0], board: "sideboard" }] })).toEqual([other]);
  expect(availableSuggestions(pool, empty)).toEqual([card, other]);
  expect(availableSuggestions(pool, added)).toEqual([other]);
  expect(availableSuggestions(pool, { entries: [{ ...added.entries[0], qty: 0 }] })).toEqual([card, other]);
  // Collection documents are deliberately not an input to this deck membership rule.
});
