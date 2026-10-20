import type { Card, Document } from "./model";

const normalize = (name: string) => name.normalize("NFKC").toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
const names = (card: Card) => new Set([card.name, ...card.name.split(/\s*\/\/\s*/), ...(card.card_faces || []).map(face => face.name)].map(normalize).filter(Boolean));

/** Canonical membership across printings and face-only records. Ownership is separate. */
export function sameSuggestedCard(a: Card, b: Card): boolean {
  if (a.id === b.id) return true;
  if (a.oracle_id && b.oracle_id) return a.oracle_id === b.oracle_id;
  const aliases = names(a);
  return [...names(b)].some(name => aliases.has(name));
}

export function availableSuggestions(cards: Card[], deck: Pick<Document, "entries">): Card[] {
  const members = deck.entries.filter(entry => entry.qty > 0).map(entry => entry.card);
  const available: Card[] = [];
  for (const card of cards) {
    if (members.some(member => sameSuggestedCard(member, card))) continue;
    if (!available.some(previous => sameSuggestedCard(previous, card))) available.push(card);
  }
  return available;
}
