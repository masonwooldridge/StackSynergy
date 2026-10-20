import type { Board, Card, Document } from "./model";
export function deckSearchTerms(deck: Document | undefined, board: Board, enabled: boolean) {
  if (!enabled || deck?.kind !== "deck") return [];
  const terms = [`f:${deck.format}`];
  if (deck.format === "commander") {
    if (board === "commander") terms.push("is:commander");
    else {
      const commanders = deck.entries.filter((entry) => entry.board === "commander");
      if (commanders.length && commanders.every((entry) => entry.card.color_identity !== undefined)) {
        const colors = [...new Set(commanders.flatMap((entry) => entry.card.color_identity || []))];
        terms.push(`id<=${colors.join("").toLowerCase() || "c"}`);
      }
    }
  }
  return terms;
}
export function includedCopies(deck: Document | undefined, card: Card, board: Board) {
  return deck?.entries.filter((entry) => entry.board === board &&
    (entry.card.oracle_id || entry.card.name) === (card.oracle_id || card.name))
    .reduce((total, entry) => total + entry.qty, 0) || 0;
}
export function matchesDeckRules(card: Card, deck: Document | undefined, board: Board, enabled: boolean) {
  if (!enabled || deck?.kind !== "deck") return true;
  if (card.legalities?.[deck.format] !== "legal") return false;
  if (deck.format !== "commander") return true;
  if (board === "commander") return /Legendary.*Creature/.test(card.type_line || "") || /can be your commander/.test(card.oracle_text || "");
  const commanders = deck.entries.filter((entry) => entry.board === "commander");
  if (!commanders.length || commanders.some((entry) => entry.card.color_identity === undefined)) return true;
  const colors = new Set(commanders.flatMap((entry) => entry.card.color_identity || []));
  return card.color_identity !== undefined && card.color_identity.every((color) => colors.has(color));
}
