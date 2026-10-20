import { expect, it } from "vitest";
import {
  buildCardSearch,
  defaultSearchFilters,
  searchFilterTerms,
} from "../shared/searchFilters";
import { cardSearchPath } from "../shared/cardSearchRequest";
it("builds all supported filter families as actual provider syntax", () => {
  const q = buildCardSearch("water", {
    ...defaultSearchFilters,
    formats: ["commander", "modern"],
    colors: ["W", "U"],
    identity: true,
    colorMode: "within",
    minColors: "1",
    maxColors: "2",
    type: "Legendary, Creature Angel",
    oracle: "draw a card",
    mana: "{2}{G}{W}",
    set: "mkm",
    rarity: "rare",
    minPrice: "0",
    maxPrice: "5",
    minMana: "1",
    maxMana: "6",
    minPower: "0",
    maxPower: "5",
    minToughness: "1",
    maxToughness: "8",
    finish: "foil",
    artist: "John Avon",
    layout: "normal",
    misc: "reserved",
    ignoreNonlegal: true,
  });
  for (const term of [
    "(water)",
    "lang:en",
    "f:commander or f:modern",
    "id<=wu",
    "id>=1",
    "id<=2",
    't:"Legendary"',
    't:"Creature"',
    't:"Angel"',
    'o:"draw a card"',
    'mana:"{2}{G}{W}"',
    'set:"mkm"',
    "r:rare",
    "usd>=0",
    "usd<=5",
    "mv>=1",
    "mv<=6",
    "pow>=0",
    "tou<=8",
    "is:foil",
    'a:"John Avon"',
    "layout:normal",
    "is:reserved",
  ])
    expect(q).toContain(term);
});
it("supports exact/include/any colors and preserves deck legality constraints", () => {
  expect(
    buildCardSearch(
      "Sol Ring",
      { ...defaultSearchFilters, colors: ["W", "U"], colorMode: "exact" },
      ["f:commander", "id<=ruw"],
    ),
  ).toContain("c=wu");
  expect(
    searchFilterTerms({
      ...defaultSearchFilters,
      colors: ["G"],
      colorMode: "include",
    }),
  ).toContain("c>=g");
  expect(
    searchFilterTerms({
      ...defaultSearchFilters,
      colors: ["W", "U"],
      colorMode: "any",
    }),
  ).toContain("(c:w or c:u)");
  expect(
    buildCardSearch("x", defaultSearchFilters, ["f:commander", "id<=ruw"]),
  ).toContain("f:commander id<=ruw");
});
it("rejects invalid and inverted ranges rather than emitting inert filters", () => {
  expect(() =>
    searchFilterTerms({ ...defaultSearchFilters, minMana: "4", maxMana: "2" }),
  ).toThrow(/minimum/);
  expect(() =>
    searchFilterTerms({ ...defaultSearchFilters, maxPrice: "NaN" }),
  ).toThrow(/numbers/);
});
it("forwards explicit grouping, ordering, extras and multilingual options with validation", () => {
  const path = cardSearchPath({
      q: "lang:ja set:mkm",
      page: 2,
      unique: "prints",
      order: "released",
      dir: "desc",
      extras: "1",
      multilingual: "1",
    }),
    u = new URL(path, "https://api.scryfall.com");
  expect(u.searchParams.get("unique")).toBe("prints");
  expect(u.searchParams.get("include_multilingual")).toBe("true");
  expect(u.searchParams.get("include_extras")).toBe("true");
  expect(u.searchParams.get("page")).toBe("2");
  expect(() =>
    cardSearchPath({ q: "x", page: 1, order: "arbitrary" }),
  ).toThrow();
  expect(() => cardSearchPath({ q: "x", page: 101 })).toThrow();
});
