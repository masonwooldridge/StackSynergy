import type { Card } from "./model";
export interface CardPage {
  data: Card[];
  has_more?: boolean;
}
/** Fetch every provider page; never silently return a truncated printing list. */
export async function printingPages(
  fetchPage: (page: number) => Promise<CardPage>,
) {
  const cards = new Map<string, Card>();
  for (let page = 1; page <= 100; page++) {
    const result = await fetchPage(page);
    for (const card of result.data) cards.set(card.id, card);
    if (!result.has_more) return [...cards.values()];
  }
  throw Error(
    "Printing list exceeded the supported page limit. Refine the query.",
  );
}
