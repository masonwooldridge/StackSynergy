import { expect, it } from "vitest";
import type { Card } from "../shared/model";
import { defaultSearchFilters } from "../shared/searchFilters";
import { matchesOwnedSearch, sortOwnedSearch } from "../shared/ownedCardSearch";
const card = {
  id: "owned",
  name: "Local draw creature",
  lang: "en",
  colors: ["W", "U"],
  color_identity: ["W", "U"],
  type_line: "Legendary Creature — Angel",
  oracle_text: "When this enters, draw a card.",
  mana_cost: "{2}{W}{U}",
  set: "mkm",
  rarity: "rare",
  artist: "John Avon",
  layout: "normal",
  cmc: 4,
  power: "2",
  toughness: "3",
  finishes: ["foil", "nonfoil"],
  prices: { usd: "0" },
  legalities: { commander: "legal" },
};
it("applies real cached ownership filters without an oracle-ID query size limit", () => {
  const f = {
    ...defaultSearchFilters,
    colors: ["W", "U"],
    type: "Legendary Creature",
    oracle: "draw a card",
    mana: "{2}{W}{U}",
    set: "mkm",
    rarity: "rare",
    artist: "Avon",
    layout: "normal",
    finish: "foil",
    maxMana: "4",
    minPrice: "0",
    maxPrice: "0",
    minPower: "1",
    maxToughness: "3",
    formats: ["commander"],
  };
  expect(matchesOwnedSearch(card, f, "draw")).toBe(true);
  expect(matchesOwnedSearch(card, { ...f, maxMana: "3" }, "draw")).toBe(false);
  expect(
    matchesOwnedSearch(card, { ...f, artist: "Other artist" }, "draw"),
  ).toBe(false);
  expect(
    Array.from({ length: 1000 }, (_, i) => ({ ...card, id: String(i) })).filter(
      (c) => matchesOwnedSearch(c, f, "draw"),
    ),
  ).toHaveLength(1000);
});
it("distinguishes unknown prices from zero, rejects missing numeric facts and sorts unknown last", () => {
  const unknown: Card = {
    ...card,
    id: "unknown",
    prices: { usd: null },
    power: "*",
  };
  expect(
    matchesOwnedSearch(unknown, { ...defaultSearchFilters, minPrice: "0" }, ""),
  ).toBe(false);
  expect(
    matchesOwnedSearch(unknown, { ...defaultSearchFilters, minPower: "0" }, ""),
  ).toBe(false);
  expect(sortOwnedSearch([unknown, card], defaultSearchFilters)[0]).toBe(card);
});
