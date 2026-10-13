/** OCR candidates are search queries only; never card identities or exact printings. */
export function scanQueries(text: string): string[] {
  const queries: string[] = [];
  for (const line of text.split("\n").slice(0, 12)) {
    const words = line
      .replace(/[^\p{L}\p{N} ,’'/-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ");
    if (words.length < 1 || words.length > 12) continue;
    for (let start = 0; start < Math.min(2, words.length); start++) {
      const end = Math.min(words.length, start + 7);
      for (let n = end; n > start; n--) {
        const q = words
          .slice(start, n)
          .join(" ")
          .replace(/[\d /-]+$/, "")
          .trim();
        if (q.length >= 3 && !queries.includes(q)) queries.push(q);
      }
    }
  }
  return queries.slice(0, 40);
}
export function visiblePrintingHint(
  text: string,
): { set: string; collector: string } | null {
  // Only a hint. Set and collector order varies by frame and OCR often confuses letters.
  const m =
    text.match(
      /\b([A-Z0-9]{3,5})\s*[•·|]?\s+(?:EN|FR|DE|ES|IT|JA|PT|RU|KO|ZHS|ZHT)\s*\n?\s*(\d{1,4})\b/i,
    ) || text.match(/\b(\d{1,4})\s*\/\s*\d{1,4}\s+([A-Z]{3,5})\b/);
  if (!m) return null;
  return /^\d/.test(m[1])
    ? { set: m[2].toLowerCase(), collector: String(Number(m[1])) }
    : { set: m[1].toLowerCase(), collector: String(Number(m[2])) };
}
