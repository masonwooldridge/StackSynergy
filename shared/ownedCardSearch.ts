import type { Card } from "./model";
import type { SearchFilters } from "./searchFilters";
type Facts = Card & {
  colors?: string[];
  rarity?: string;
  artist?: string;
  released_at?: string;
  printed_name?: string;
  foil?: boolean;
  nonfoil?: boolean;
  reserved?: boolean;
  full_art?: boolean;
  border_color?: string;
  promo?: boolean;
  reprint?: boolean;
  digital?: boolean;
  security_stamp?: string;
};
const lower = (s: string | undefined) => (s || "").toLowerCase();
const formats = [
  "standard",
  "pioneer",
  "modern",
  "legacy",
  "vintage",
  "commander",
  "pauper",
  "brawl",
  "historic",
  "timeless",
  "oathbreaker",
];
export function matchesOwnedSearch(
  card: Card,
  f: SearchFilters,
  query: string,
) {
  const c = card as Facts;
  if (
    query.trim() &&
    !lower(c.name + " " + c.printed_name).includes(lower(query.trim()))
  )
    return false;
  if (f.language && c.lang && c.lang !== f.language) return false;
  if (
    f.ignoreNonlegal &&
    !formats.some((format) => c.legalities?.[format] === "legal")
  )
    return false;
  if (
    f.formats.length &&
    !f.formats.some((format) => c.legalities?.[format] === "legal")
  )
    return false;
  const colors = f.identity ? c.color_identity : c.colors;
  if (f.colors.length) {
    if (!colors) return false;
    const wanted = f.colors.filter((v) => v !== "C");
    if (
      f.colorMode === "exact" &&
      (colors.length !== wanted.length ||
        !wanted.every((v) => colors.includes(v)))
    )
      return false;
    if (f.colorMode === "include" && !wanted.every((v) => colors.includes(v)))
      return false;
    if (f.colorMode === "within" && !colors.every((v) => wanted.includes(v)))
      return false;
    if (
      f.colorMode === "any" &&
      !(f.colors.includes("C") && !colors.length) &&
      !wanted.some((v) => colors.includes(v))
    )
      return false;
  }
  const range = (value: number | undefined, min: string, max: string) =>
    (min === "" && max === "") ||
    (value !== undefined &&
      Number.isFinite(value) &&
      (min === "" || value >= Number(min)) &&
      (max === "" || value <= Number(max)));
  if (
    !range(colors?.length, f.minColors, f.maxColors) ||
    !range(
      c.prices?.usd != null ? Number(c.prices.usd) : undefined,
      f.minPrice,
      f.maxPrice,
    ) ||
    !range(c.cmc, f.minMana, f.maxMana) ||
    !range(
      c.power !== undefined ? Number(c.power) : undefined,
      f.minPower,
      f.maxPower,
    ) ||
    !range(
      c.toughness !== undefined ? Number(c.toughness) : undefined,
      f.minToughness,
      f.maxToughness,
    )
  )
    return false;
  if (
    f.type.trim() &&
    !f.type
      .trim()
      .split(/[ ,]+/)
      .every((t) => lower(c.type_line).includes(lower(t)))
  )
    return false;
  if (
    f.oracle &&
    !lower(
      c.oracle_text +
        " " +
        (c.card_faces || []).map((face) => face.oracle_text).join(" "),
    ).includes(lower(f.oracle))
  )
    return false;
  if (
    (f.set && lower(c.set) !== lower(f.set.trim())) ||
    (f.rarity && c.rarity !== f.rarity) ||
    (f.artist && !lower(c.artist).includes(lower(f.artist))) ||
    (f.layout && c.layout !== f.layout)
  )
    return false;
  if (f.finish && !(c.finishes || []).includes(f.finish)) return false;
  if (f.mana.trim()) {
    const tokens = (s: string): string[] =>
      s.toUpperCase().match(/\{[^}]+\}/g) || [];
    const available = tokens(c.mana_cost || ""),
      wanted = tokens(f.mana);
    if (!wanted.length) return false;
    for (const token of wanted) {
      if (/^\{\d+\}$/.test(token)) {
        const numeric = available.find((v) => /^\{\d+\}$/.test(v));
        if (
          !numeric ||
          Number(numeric.slice(1, -1)) < Number(token.slice(1, -1))
        )
          return false;
      } else {
        const i = available.indexOf(token);
        if (i < 0) return false;
        available.splice(i, 1);
      }
    }
  }
  const flags: Record<string, boolean | undefined> = {
    reserved: c.reserved,
    fullart: c.full_art,
    borderless: c.border_color === "borderless",
    promo: c.promo,
    reprint: c.reprint,
    firstprint: c.reprint === undefined ? undefined : !c.reprint,
    digital: c.digital,
    funny: c.border_color === "silver" || c.security_stamp === "acorn",
  };
  if (f.misc && !flags[f.misc]) return false;
  return true;
}
export function sortOwnedSearch(cards: Card[], f: SearchFilters) {
  const value = (card: Card): number | string | undefined => {
    const c = card as Facts;
    switch (f.order) {
      case "usd":
        return c.prices?.usd != null ? Number(c.prices.usd) : undefined;
      case "cmc":
        return c.cmc;
      case "power":
        return c.power !== undefined && Number.isFinite(Number(c.power))
          ? Number(c.power)
          : undefined;
      case "toughness":
        return c.toughness !== undefined && Number.isFinite(Number(c.toughness))
          ? Number(c.toughness)
          : undefined;
      case "released":
        return c.released_at;
      case "rarity":
        return [
          "common",
          "uncommon",
          "rare",
          "mythic",
          "special",
          "bonus",
        ].indexOf(c.rarity || "");
      case "artist":
        return c.artist;
      case "set":
        return c.set;
      default:
        return c.name;
    }
  };
  return [...cards].sort((a, b) => {
    const x = value(a),
      y = value(b);
    if (x === undefined) return y === undefined ? 0 : 1;
    if (y === undefined) return -1;
    return (
      (typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y))) * (f.direction === "asc" ? 1 : -1)
    );
  });
}
