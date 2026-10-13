import type { Board, Card, Document, Entry } from "./model";
export function newEntry(card: Card, board: Board = "mainboard"): Entry {
  return {
    id: crypto.randomUUID(),
    card,
    qty: 1,
    board,
    language: card.lang || "en",
    condition: "near_mint",
    finish: "nonfoil",
    purchasePrice: "",
    notes: "",
    tags: "",
  };
}
/** Deck membership never creates or removes an owned inventory copy. */
export function addCopy(
  document: Document,
  card: Card,
  board: Board = "mainboard",
): Document {
  const targetBoard = document.kind === "deck" ? board : "mainboard";
  const existing = document.entries.find(
    (e) =>
      e.card.id === card.id &&
      e.board === targetBoard &&
      e.language === (card.lang || "en") &&
      e.finish === "nonfoil" &&
      e.condition === "near_mint" &&
      !e.notes &&
      !e.tags &&
      !e.purchasePrice,
  );
  return {
    ...document,
    entries: existing
      ? document.entries.map((e) =>
          e.id === existing.id ? { ...e, qty: e.qty + 1 } : e,
        )
      : [...document.entries, newEntry(card, targetBoard)],
  };
}
export function changeCopies(
  document: Document,
  id: string,
  delta: number,
): Document {
  return {
    ...document,
    entries: document.entries
      .map((e) => (e.id === id ? { ...e, qty: e.qty + delta } : e))
      .filter((e) => e.qty > 0),
  };
}
export function cardCount(document: Document) {
  return document.entries.reduce((n, e) => n + e.qty, 0);
}
export function cardType(entry: Entry) {
  const t = entry.card.type_line || "";
  return (
    [
      "Land",
      "Creature",
      "Planeswalker",
      "Instant",
      "Sorcery",
      "Artifact",
      "Enchantment",
      "Battle",
    ].find((type) => t.includes(type)) || "Other"
  );
}

/** Compare playable deck copies against owned cards, across all printings. */
export function missingCards(deck: Document, documents: Document[]) {
  const key = (card: Card) => card.oracle_id || card.name;
  const available = new Map<string, number>();
  for (const doc of documents.filter(
    (d) => d.kind === "collection" && !d.deleted,
  ))
    for (const e of doc.entries)
      available.set(key(e.card), (available.get(key(e.card)) || 0) + e.qty);
  const required = new Map<string, { card: Card; qty: number }>();
  for (const e of deck.entries.filter((e) => e.board !== "maybeboard")) {
    const k = key(e.card),
      previous = required.get(k);
    required.set(k, { card: e.card, qty: (previous?.qty || 0) + e.qty });
  }
  return [...required]
    .map(([k, e]) => ({
      ...e,
      owned: available.get(k) || 0,
      missing: Math.max(0, e.qty - (available.get(k) || 0)),
    }))
    .filter((e) => e.missing > 0);
}
