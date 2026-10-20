import { expect, it } from "vitest";
import type { Card, Document } from "../shared/model";
import {
  assertDiscussionFacts,
  readableAIReply,
} from "../shared/aiResponseSafety";
const commander = {
  id: "commander",
  oracle_text: "Create a token tapped and attacking.",
  name: "Commander",
} as Card;
const candidate = {
  id: "candidate",
  oracle_id: "candidate",
  name: "Dolmen Gate",
} as Card;
const deck = {
  entries: [{ board: "commander", card: commander, qty: 1 }],
} as Document;
it("blocks the observed false entering-attacking claim, while allowing the correct distinction", () => {
  expect(() =>
    assertDiscussionFacts(
      'Tokens enter tapped and attacking and will trigger "when this creature attacks" effects.',
      [],
      deck,
    ),
  ).toThrow("entering attacking does not trigger");
  expect(() =>
    assertDiscussionFacts(
      "Tokens entering attacking do not trigger when this attacks. They can deal combat damage.",
      [],
      deck,
    ),
  ).not.toThrow();
  expect(() =>
    assertDiscussionFacts(
      "If a token is later declared as an attacker, it will trigger when this creature attacks.",
      [],
      deck,
    ),
  ).not.toThrow();
});
it("blocks the observed installed-candidate confusion without blocking a stated missing card", () => {
  expect(() =>
    assertDiscussionFacts(
      "Dolmen Gate is present in deck (high USD).",
      [candidate],
      deck,
    ),
  ).toThrow("retrieved candidate");
  expect(() =>
    assertDiscussionFacts(
      "Dolmen Gate is not in your deck; compare its price.",
      [candidate],
      deck,
    ),
  ).not.toThrow();
});
it("removes internal identifiers from user-facing prose without changing structured card references", () => {
  const id = "090f130e-995b-4097-a391-f4802b98d496";
  expect(readableAIReply("Lightning Runner (" + id + ") is a creature.")).toBe(
    "Lightning Runner is a creature.",
  );
});
