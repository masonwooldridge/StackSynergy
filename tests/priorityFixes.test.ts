import { expect, it } from "vitest";
import type { Card, Document } from "../shared/model";
import { validateDeck } from "../shared/model";
import { newEntry } from "../shared/deckEditing";
import { documentSchema } from "../shared/documentSchema";
import { reproductionReason, isMainDeckCard } from "../shared/deckEligibility";
import {
  mechanicalPrerequisites,
  acceleration,
} from "../shared/mechanicalSupport";
import { constructionRoles } from "../shared/constructionPlan";
import { buildCommanderDeck } from "../shared/deckBuilder";
import {
  assertTotalBudget,
  budgetConflict,
  deckMarketValue,
} from "../shared/assistantBudget";
import {
  previewUpgrade,
  upgradeSignature,
  type UpgradePlan,
} from "../shared/deckUpgrade";
const card = (
  name: string,
  text = "",
  type = "Creature",
  price = "1",
): Card => ({
  id: crypto.randomUUID(),
  oracle_id: crypto.randomUUID(),
  name,
  oracle_text: text,
  type_line: type,
  cmc: 2,
  prices: { usd: price },
  color_identity: ["G"],
  legalities: { commander: "legal" },
  finishes: ["nonfoil"],
});
const cmd = card("Leader", "", "Legendary Creature"),
  land = card("Forest", "{T}: Add {G}.", "Basic Land — Forest", "0.1");
const deck = (): Document => ({
  id: crypto.randomUUID(),
  name: "Disposable",
  kind: "deck",
  format: "commander",
  notes: "",
  revision: 0,
  entries: [
    { ...newEntry(cmd), board: "commander" },
    { ...newEntry(land), qty: 36 },
    ...Array.from({ length: 63 }, (_, i) => newEntry(card("Body " + i))),
  ],
});
it("keeps collectibles searchable but distinguishes printing eligibility, with acknowledgement preserved", () => {
  const d = deck();
  d.entries[2].card = { ...d.entries[2].card, set: "30a" };
  expect(isMainDeckCard(d.entries[2].card)).toBe(true);
  expect(validateDeck(d).warnings.join()).toContain("non-tournament");
  d.casualProxyAccepted = true;
  expect(documentSchema.parse(d).casualProxyAccepted).toBe(true);
  expect(validateDeck(d).warnings.join()).toContain(
    "still not tournament eligible",
  );
  for (const set of ["ced", "cei", "wc99"])
    expect(reproductionReason({ ...land, set })).toBeTruthy();
  expect(reproductionReason({ ...land, set: "m21" })).toBeNull();
});
it("checks clash prerequisites and Adventure engine density without card-name rules", () => {
  const echo = card(
    "Unrelated name",
    "Whenever you win a clash, you may draw a card.",
    "Enchantment",
  );
  expect(mechanicalPrerequisites(echo, [cmd])).toHaveLength(1);
  expect(
    mechanicalPrerequisites(echo, [card("Enabler", "Clash with an opponent.")]),
  ).toEqual([]);
  const draw = card(
    "Adventure engine",
    "Whenever you cast a creature spell that has an Adventure, draw a card.",
  );
  const adventure = { ...card("Adventure"), layout: "adventure" };
  expect(mechanicalPrerequisites(draw, [adventure])).toHaveLength(1);
  expect(
    mechanicalPrerequisites(
      draw,
      Array.from({ length: 6 }, (_, i) => ({
        ...adventure,
        id: crypto.randomUUID(),
        oracle_id: String(i),
      })),
    ),
  ).toEqual([]);
  expect(
    mechanicalPrerequisites(
      card(
        "Conditional land search",
        "You may put that card onto the battlefield tapped if you control a land named Wastes.",
      ),
      [land],
    ),
  ).toHaveLength(1);
});
it("separates ordinary lands, acceleration, narrow wipes and conditional protection/draw", () => {
  expect(acceleration(land)).toBe(false);
  expect(acceleration(card("Mana rock", "{T}: Add {G}.", "Artifact"))).toBe(
    true,
  );
  expect(
    acceleration(
      card(
        "Land ramp",
        "Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.",
        "Sorcery",
      ),
    ),
  ).toBe(true);
  for (const text of [
    "This deals X damage to each creature with flying.",
    "This deals X damage to each creature without flying.",
  ])
    expect(
      constructionRoles(card("Narrow", text, "Sorcery"), cmd),
    ).not.toContain("wipes");
  expect(
    constructionRoles(card("Broad", "Destroy all creatures.", "Sorcery"), cmd),
  ).toContain("wipes");
  expect(
    constructionRoles(
      card(
        "Low life",
        "Creatures you control get +1/+1. Fateful hour — If you have 5 or less life, those creatures gain indestructible.",
        "Instant",
      ),
      cmd,
    ),
  ).not.toContain("protection");
  expect(
    constructionRoles(
      card(
        "Blocked draw",
        "Whenever equipped creature becomes blocked by a creature, draw two cards.",
        "Artifact",
      ),
      cmd,
    ),
  ).not.toContain("advantage");
});
it("full generation excludes unsupported clash and reproduction candidates without deleting collector facts", () => {
  const echo = card(
    "Sylvan Echoes",
    "Whenever you win a clash, you may draw a card.",
    "Enchantment",
    "0.01",
  );
  const proxy = { ...card("Cheap reproduction"), set: "30a" };
  const candidates = [
    land,
    echo,
    proxy,
    ...Array.from({ length: 90 }, (_, i) =>
      card("Body " + i, "", "Creature", "0.1"),
    ),
  ];
  const result = buildCommanderDeck({
    commander: cmd,
    candidates,
    documents: [],
    mode: "buy",
    budget: 200,
    budgetMeaning: "deck",
    fetchedAt: "fixture",
  });
  expect(result.complete).toBe(true);
  expect(
    result.document.entries.some((e) =>
      [echo.id, proxy.id].includes(e.card.id),
    ),
  ).toBe(false);
});
it("distinguishes total budget including commander/lands/owned cards and unknown selected finishes", () => {
  const d = deck();
  expect(deckMarketValue(d)).toBe(67.6);
  expect(() => assertTotalBudget(d, 67)).toThrow("including commander");
  expect(() => assertTotalBudget(d, 68)).not.toThrow();
  d.entries[2].finish = "foil";
  expect(deckMarketValue(d)).toBeNull();
  expect(() => assertTotalBudget(d, 1000)).toThrow("no USD quote");
});
it("clarifies conflicting prose instead of silently switching controls", () => {
  expect(
    budgetConflict("My $200 total budget includes commander", 200, "purchases"),
  ).toContain("controls differ");
  expect(
    budgetConflict("Keep my total deck budget at $200", 200, "deck"),
  ).toBeNull();
  expect(
    budgetConflict("New purchases budget is $25", 200, "purchases"),
  ).toBeTruthy();
  expect(budgetConflict("Keep Seedborn Muse", 200, "deck")).toBeNull();
  expect(
    budgetConflict("My total budget is $200.50", 200.5, "deck"),
  ).toBeNull();
});
it("rechecks total cap for every selected subset, including a free owned addition", () => {
  const d = deck(),
    a = card("Owned expensive", "", "Creature", "10"),
    b = card("Cheaper", "", "Creature", "0.01");
  d.entries[3].card.prices = { usd: "10" };
  const make = (cut: number, add: Card) => ({
    id: crypto.randomUUID(),
    cutId: d.entries[cut].id,
    cutName: d.entries[cut].card.name,
    add,
    purchase: 0,
    owned: true,
    reason: "fixture",
  });
  const pairs = [make(2, a), make(3, b)];
  const p: UpgradePlan = {
    deckId: d.id,
    revision: d.revision,
    signature: upgradeSignature(d),
    collectionSignature: JSON.stringify([]),
    budget: 77,
    budgetMeaning: "deck",
    totalBudget: 77,
    ownedOnly: false,
    pairs,
    retrievedAt: "fixture",
  };
  expect(() =>
    previewUpgrade(
      p,
      d,
      pairs.map((p) => p.id),
      [],
    ),
  ).not.toThrow();
  expect(() => previewUpgrade(p, d, [pairs[0].id], [])).toThrow(
    "Total deck value",
  );
});

it("does not equate a color-restricted destruction spell with a broad wipe", () => {
  expect(
    constructionRoles(
      card("Restricted sweep", "Destroy all nonblack creatures.", "Sorcery"),
      cmd,
    ),
  ).not.toContain("wipes");
});
