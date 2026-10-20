export function cardSearchPath(input: {
  q: string;
  page: number;
  unique?: string;
  order?: string;
  dir?: string;
  extras?: string;
  multilingual?: string;
}) {
  if (!input.q.trim() || input.q.length > 1000)
    throw Error("Enter a search query of at most 1000 characters.");
  if (!Number.isInteger(input.page) || input.page < 1 || input.page > 100)
    throw Error("Invalid result page.");
  const unique = input.unique || "cards",
    order = input.order || "name",
    dir = input.dir || "asc";
  if (
    !["cards", "prints", "art"].includes(unique) ||
    ![
      "name",
      "usd",
      "cmc",
      "released",
      "rarity",
      "set",
      "power",
      "toughness",
      "artist",
      "edhrec",
    ].includes(order) ||
    !["asc", "desc"].includes(dir)
  )
    throw Error("Invalid card search options.");
  const query = new URLSearchParams({
    q: input.q,
    unique,
    order,
    dir,
    page: String(input.page),
    include_extras: input.extras === "1" ? "true" : "false",
    include_multilingual: input.multilingual === "1" ? "true" : "false",
  });
  return "/cards/search?" + query.toString();
}
