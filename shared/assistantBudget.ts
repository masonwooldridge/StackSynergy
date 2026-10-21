import type { Document } from "./model";
export type BudgetMeaning = "purchases" | "deck";
export function deckMarketValue(deck: Document): number | null {
  let total = 0;
  for (const e of deck.entries.filter(
    (e) => e.board === "mainboard" || e.board === "commander",
  )) {
    const raw =
      e.card.prices?.[
        e.finish === "foil"
          ? "usd_foil"
          : e.finish === "etched"
            ? "usd_etched"
            : "usd"
      ];
    if (
      raw == null ||
      raw.trim() === "" ||
      !Number.isFinite(Number(raw)) ||
      Number(raw) < 0
    )
      return null;
    total += Number(raw) * e.qty;
  }
  return Math.round(total * 100) / 100;
}
export function assertTotalBudget(deck: Document, cap: number) {
  const value = deckMarketValue(deck);
  if (value === null)
    throw Error(
      "Total deck budget cannot be verified: a selected printing/finish has no USD quote, including commander and lands.",
    );
  if (value > cap + 1e-8)
    throw Error(
      `Total deck value $${value.toFixed(2)} exceeds the $${cap.toFixed(2)} cap, including commander and lands. No changes saved.`,
    );
  return value;
}
/** Clarify explicit conflicts before provider calls; controls are never silently rewritten. */
export function budgetConflict(
  text: string,
  cap: number,
  meaning: BudgetMeaning,
): string | null {
  const clauses = text.split(/[!?\n]|\.(?!\d)/);
  for (const clause of clauses) {
    if (
      !/budget|total|new[- ]purchases?|including (?:the )?commander|entire deck|whole deck/i.test(
        clause,
      )
    )
      continue;
    const amounts = [...clause.matchAll(/\$\s*(\d+(?:\.\d{1,2})?)/g)];
    if (!amounts.length) continue;
    const total =
      /total|including (?:the )?commander|entire deck|whole deck/i.test(clause);
    const purchase = /new[- ]purchases?|additions? budget/i.test(clause);
    if (
      amounts.some((m) => Number(m[1]) !== cap) ||
      (total && meaning !== "deck") ||
      (purchase && meaning !== "purchases")
    )
      return "Your message and budget controls differ. Choose Total deck (including commander) or New purchases and the matching USD cap, then resend. No model request or changes made.";
  }
  return null;
}

/** Preview a subset from the verified full proposal and its quoted unit-price deltas. Server validation remains authoritative. */
export function selectedReviewBudget(
  review: {
    budget: number;
    budgetMeaning?: BudgetMeaning;
    totalBudget?: number;
    deckValue?: number | null;
    pairs: {
      id: string;
      purchase: number;
      cutPrice?: number | null;
      addPrice?: number | null;
    }[];
  },
  ids: string[],
) {
  const chosen = review.pairs.filter((p) => ids.includes(p.id)),
    purchase =
      Math.round(chosen.reduce((n, p) => n + p.purchase, 0) * 100) / 100;
  let deckValue: number | null = null;
  if (
    review.budgetMeaning === "deck" &&
    review.deckValue != null &&
    Number.isFinite(review.deckValue)
  ) {
    deckValue = review.deckValue;
    for (const p of review.pairs.filter((p) => !ids.includes(p.id))) {
      if (
        p.cutPrice == null ||
        p.addPrice == null ||
        !Number.isFinite(p.cutPrice) ||
        !Number.isFinite(p.addPrice)
      ) {
        deckValue = null;
        break;
      }
      deckValue += p.cutPrice - p.addPrice;
    }
    if (deckValue !== null) deckValue = Math.round(deckValue * 100) / 100;
  }
  const cap = review.totalBudget ?? review.budget;
  const invalid =
    !ids.length ||
    new Set(ids).size !== ids.length ||
    chosen.length !== ids.length ||
    purchase > review.budget + 1e-8 ||
    (review.budgetMeaning === "deck" &&
      (deckValue === null || deckValue > cap + 1e-8));
  const reason =
    review.budgetMeaning === "deck" && ids.length
      ? deckValue === null
        ? "Selected total cannot be verified from these quotes. Request a fresh review."
        : deckValue > cap + 1e-8
          ? `Selected deck $${deckValue.toFixed(2)} exceeds the $${cap.toFixed(2)} total cap. Include a saving swap or change the selection.`
          : ""
      : purchase > review.budget + 1e-8
        ? "Selected purchases exceed this review’s budget."
        : "";
  return { purchase, deckValue, valid: !invalid, reason };
}
