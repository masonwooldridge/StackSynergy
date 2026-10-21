import type { Card, Document } from "./model";
/** Sideboard/maybeboard suggestions cannot supply installed Commander mechanics. */
export function activeDeckCards(deck: Document): Card[] {
  return deck.entries
    .filter(
      (e) => e.qty > 0 && (e.board === "mainboard" || e.board === "commander"),
    )
    .map((e) => e.card);
}
