import type { Document, Entry } from "./model";
import { validateDeck } from "./model";
export interface ProposalChange {
  id: string;
  entry: Entry;
  before: number;
  after: number;
  reason: string;
}
export interface Proposal {
  id: string;
  accountId: string;
  deckId: string;
  revision: number;
  budget: number;
  ownedOnly: boolean;
  analysis: string;
  changes: ProposalChange[];
  rejected: string[];
  evidence: string;
  retrievedAt: string;
}
const identity = (e: Entry) => e.card.oracle_id || e.card.name;
/** Pure preview; server uses the same checks inside its application transaction. */
export function applyProposal(
  p: Proposal,
  account: string,
  deck: Document,
  ids: string[],
  documents: Document[],
) {
  if (
    p.accountId !== account ||
    p.deckId !== deck.id ||
    deck.deleted ||
    deck.kind !== "deck"
  )
    throw Error("This proposal belongs to another deck or account.");
  if (p.revision !== deck.revision)
    throw Error(
      "Deck changed. Analyze it again before applying this proposal.",
    );
  if (
    !ids.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !p.changes.some((c) => c.id === id))
  )
    throw Error("Choose valid changes.");
  const next = structuredClone(deck);
  let purchaseCost = 0;
  let pricedCopies = 0;
  let addedCopies = 0;
  const owned = new Map<string, number>();
  for (const doc of documents.filter(
    (d) => d.kind === "collection" && !d.deleted,
  ))
    for (const e of doc.entries)
      owned.set(identity(e), (owned.get(identity(e)) || 0) + e.qty);
  for (const c of p.changes.filter((c) => ids.includes(c.id))) {
    const existing = next.entries.find((e) => e.id === c.entry.id);
    if (
      (existing?.qty || 0) !== c.before ||
      !Number.isInteger(c.after) ||
      c.after < 0
    )
      throw Error("Proposal quantity no longer matches the deck.");
    next.entries = next.entries.filter((e) => e.id !== c.entry.id);
    if (c.after) next.entries.push({ ...c.entry, qty: c.after });
    const added = Math.max(0, c.after - c.before);
    if (added) {
      addedCopies += added;
      const price =
        c.entry.card.prices?.[
          c.entry.finish === "foil"
            ? "usd_foil"
            : c.entry.finish === "etched"
              ? "usd_etched"
              : "usd"
        ];
      if (
        price !== null &&
        price !== undefined &&
        price !== "" &&
        Number.isFinite(Number(price))
      ) {
        pricedCopies += added;
        // Conservative purchase estimate: price all additions, including owned copies.
        purchaseCost += Number(price) * added;
      }
    }
  }
  if (p.ownedOnly) {
    const required = new Map<string, number>();
    for (const e of next.entries.filter((e) => e.board !== "maybeboard"))
      required.set(identity(e), (required.get(identity(e)) || 0) + e.qty);
    for (const c of p.changes.filter(
      (c) => ids.includes(c.id) && c.after > c.before,
    ))
      if (
        (required.get(identity(c.entry)) || 0) >
        (owned.get(identity(c.entry)) || 0)
      )
        throw Error(
          `${c.entry.card.name}: insufficient owned copies for the resulting deck.`,
        );
  }
  if (!p.ownedOnly && pricedCopies !== addedCopies)
    throw Error("Purchase price coverage is incomplete.");
  if (!p.ownedOnly && purchaseCost > p.budget)
    throw Error("Selected additions exceed the total budget.");
  return {
    document: next,
    purchaseCost,
    pricedCopies,
    addedCopies,
    validation: validateDeck(next),
  };
}
