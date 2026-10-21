import type { Card, Document } from "../shared/model.ts";
import { validateDeck } from "../shared/model.ts";
export interface DeckValidation {
  status: "checked" | "invalid" | "incomplete" | "casual";
  checkedAt: string;
  errors: string[];
  warnings: string[];
}
/** Client snapshots supply identities only. Inventory lot metadata is never overwritten. */
export async function authoritativeDeck(
  deck: Document,
  resolve: (id: string) => Promise<Card>,
) {
  const facts = new Map<string, Card>();
  const warnings: string[] = [];
  const entries = [];
  for (const entry of deck.entries) {
    if (entry.board === "maybeboard") {
      entries.push(entry);
      continue;
    }
    try {
      let card = facts.get(entry.card.id);
      if (!card) {
        card = await resolve(entry.card.id);
        facts.set(entry.card.id, card);
      }
      if (
        card.id !== entry.card.id ||
        !card.oracle_id ||
        !card.type_line ||
        !card.legalities?.[deck.format] ||
        !card.color_identity
      )
        throw Error("Incomplete card facts");
      entries.push({ ...entry, card });
    } catch {
      warnings.push(
        "Card provider verification is incomplete. Retry validation or agree to casual play.",
      );
      // Never fall back to client-supplied rule facts.
      entries.push({
        ...entry,
        card: { id: entry.card.id, name: "Unverified card" },
      });
    }
  }
  const document = { ...deck, entries };
  const result = validateDeck(document);
  const allWarnings = [...new Set([...warnings, ...result.warnings])];
  const validation: DeckValidation = {
    status: allWarnings.length
      ? "incomplete"
      : result.errors.length
        ? "invalid"
        : "checked",
    checkedAt: new Date().toISOString(),
    errors: result.errors,
    warnings: allWarnings,
  };
  return { document, validation };
}
