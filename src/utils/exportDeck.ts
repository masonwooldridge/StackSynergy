import type { Card } from "../store/useDeckStore";

export function deckToText(deck: Record<string, { card: Card; qty: number }>) {
  return Object.values(deck)
    .map(({ card, qty }) => `${qty} ${card.name}`)
    .join("\n");
}
