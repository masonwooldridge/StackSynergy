export type CardDataStamp = {
  source: string;
  retrievedAt: string;
  expiresAt?: string;
};
export function cardDataStamp(value: unknown): CardDataStamp | undefined {
  const stamp = (value as { cardData?: CardDataStamp } | null)?.cardData;
  return stamp &&
    typeof stamp.source === "string" &&
    Number.isFinite(Date.parse(stamp.retrievedAt))
    ? stamp
    : undefined;
}
export function cardDataAsOf(stamps: (CardDataStamp | undefined)[]): string {
  const known = stamps
    .filter((x): x is CardDataStamp => !!x)
    .sort((a, b) => Date.parse(a.retrievedAt) - Date.parse(b.retrievedAt));
  if (!known.length)
    return "Source retrieval timestamp unavailable; prices are estimates, not refreshed quotes";
  return `${known[0].retrievedAt} (oldest source retrieval; ${stamps.some((x) => !x) ? "some timestamps unavailable; " : ""}Scryfall responses/cache up to 24 hours; not live market prices)`;
}
