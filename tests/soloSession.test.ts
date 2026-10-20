import { expect, it } from "vitest";
import type { Document } from "../shared/model";
import { newEntry } from "../shared/deckEditing";
import { startSolo, soloAction } from "../shared/solo";
import { encodeSoloSession, decodeSoloSession } from "../shared/soloSession";
const deck: Document = { id: "qa", kind: "deck", name: "QA", format: "modern", notes: "", revision: 1, entries: [{ ...newEntry({ id: "forest", name: "Forest", type_line: "Basic Land", oracle_text: "x".repeat(2000) }), qty: 60 }] };
it("restores current state and undo/redo history after reload without repeating card facts", () => {
  const opening = startSolo(deck), playing = soloAction(opening, { type: "keep", bottom: [] }), drawn = soloAction(playing, { type: "draw", count: 1 });
  const encoded = encodeSoloSession("deck-v1", playing, [opening], [drawn]);
  expect(decodeSoloSession(encoded)).toEqual({ version: "deck-v1", state: playing, past: [opening], future: [drawn] });
  expect(encoded.length).toBeLessThan(JSON.stringify({ state: playing, past: [opening], future: [drawn] }).length / 4);
});
it("migrates the existing full-state session format without resetting the game", () => {
  const state = startSolo(deck);
  expect(decodeSoloSession(JSON.stringify({ version: "old", state }))).toEqual({ version: "old", state, past: [], future: [] });
});
it("rejects broken current state while preserving valid state when only history is damaged", () => {
  const state = startSolo(deck), data = JSON.parse(encodeSoloSession("v1", state, [], []));
  data.past = [{ pieces: null }];
  expect(decodeSoloSession(JSON.stringify(data))?.state).toEqual(state);
  data.state.pieces[0].cardId = "absent";
  expect(decodeSoloSession(JSON.stringify(data))).toBeNull();
  expect(decodeSoloSession("broken JSON")).toBeNull();
});
it("bounds persistent history and prevents an empty deck opening-hand keep", () => {
  const state = startSolo(deck), data = decodeSoloSession(encodeSoloSession("v1", state, Array(80).fill(state), Array(80).fill(state)));
  expect(data?.past).toHaveLength(50);expect(data?.future).toHaveLength(50);
  expect(() => soloAction(startSolo({ ...deck, entries: [] }), { type: "keep", bottom: [] })).toThrow(/mainboard/);
});
