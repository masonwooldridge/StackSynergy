export interface SearchFilters {
  language: string;
  order: string;
  direction: "asc" | "desc";
  groupPrintings: boolean;
  ignoreNonlegal: boolean;
  formats: string[];
  colors: string[];
  identity: boolean;
  colorMode: "exact" | "include" | "within" | "any";
  minColors: string;
  maxColors: string;
  type: string;
  oracle: string;
  mana: string;
  set: string;
  rarity: string;
  minPrice: string;
  maxPrice: string;
  minMana: string;
  maxMana: string;
  minPower: string;
  maxPower: string;
  minToughness: string;
  maxToughness: string;
  finish: string;
  artist: string;
  layout: string;
  misc: string;
}
export const defaultSearchFilters: SearchFilters = {
  language: "en",
  order: "usd",
  direction: "desc",
  groupPrintings: true,
  ignoreNonlegal: false,
  formats: [],
  colors: [],
  identity: false,
  colorMode: "exact",
  minColors: "",
  maxColors: "",
  type: "",
  oracle: "",
  mana: "",
  set: "",
  rarity: "",
  minPrice: "",
  maxPrice: "",
  minMana: "",
  maxMana: "",
  minPower: "",
  maxPower: "",
  minToughness: "",
  maxToughness: "",
  finish: "",
  artist: "",
  layout: "",
  misc: "",
};
export function searchFilterTerms(f: SearchFilters) {
  const terms: string[] = [];
  const quote = (s: string) => JSON.stringify(s.trim());
  if (f.language) terms.push("lang:" + f.language);
  if (f.ignoreNonlegal)
    terms.push(
      "(f:standard or f:pioneer or f:modern or f:legacy or f:vintage or f:commander or f:pauper or f:brawl or f:historic or f:timeless or f:oathbreaker)",
    );
  if (f.formats.length)
    terms.push("(" + f.formats.map((v) => "f:" + v).join(" or ") + ")");
  const color = f.identity ? "id" : "c",
    selected = f.colors.join("").toLowerCase();
  if (selected)
    terms.push(
      f.colorMode === "any"
        ? "(" +
            f.colors.map((c) => color + ":" + c.toLowerCase()).join(" or ") +
            ")"
        : color +
            { exact: "=", include: ">=", within: "<=" }[f.colorMode] +
            selected,
    );
  for (const [key, low, high] of [
    [color, f.minColors, f.maxColors],
    ["usd", f.minPrice, f.maxPrice],
    ["mv", f.minMana, f.maxMana],
    ["pow", f.minPower, f.maxPower],
    ["tou", f.minToughness, f.maxToughness],
  ]) {
    if (
      (low !== "" && (!Number.isFinite(Number(low)) || Number(low) < 0)) ||
      (high !== "" && (!Number.isFinite(Number(high)) || Number(high) < 0))
    )
      throw Error("Ranges must contain nonnegative numbers.");
    if (low !== "" && high !== "" && Number(low) > Number(high))
      throw Error("Range minimum cannot exceed its maximum.");
    if (low !== "") terms.push(key + ">=" + low);
    if (high !== "") terms.push(key + "<=" + high);
  }
  if (f.type.trim())
    terms.push(
      ...f.type
        .trim()
        .split(/[ ,]+/)
        .map((part) => "t:" + quote(part)),
    );
  if (f.oracle.trim()) terms.push("o:" + quote(f.oracle));
  if (f.mana.trim()) terms.push("mana:" + quote(f.mana));
  if (f.set.trim()) terms.push("set:" + quote(f.set));
  if (f.rarity) terms.push("r:" + f.rarity);
  if (f.finish) terms.push("is:" + f.finish);
  if (f.artist.trim()) terms.push("a:" + quote(f.artist));
  if (f.layout) terms.push("layout:" + f.layout);
  if (f.misc) terms.push("is:" + f.misc);
  return terms;
}
export function buildCardSearch(
  query: string,
  filters: SearchFilters,
  constraints: string[] = [],
) {
  return [
    query.trim() ? "(" + query.trim() + ")" : "",
    ...constraints,
    ...searchFilterTerms(filters),
  ]
    .filter(Boolean)
    .join(" ");
}
export interface CardSet {
  id: string;
  code: string;
  name: string;
  released_at?: string;
  card_count: number;
  set_type: string;
  icon_svg_uri?: string;
}
