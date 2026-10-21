import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import type { Card } from "../shared/model";
import { cardTradeoffs } from "../shared/cardTradeoffs";
import { interactionProfile } from "../shared/interactionProfile";
import { constructionRoles } from "../shared/constructionPlan";
import { parseAIRequest } from "../shared/aiConstraints";
import { selectedReviewBudget } from "../shared/assistantBudget";
const facts = JSON.parse(
  readFileSync(
    new URL("./fixtures/tradeoffCards.json", import.meta.url),
    "utf8",
  ),
) as Card[];
const card = (name: string) => {
  const c = facts.find((c) => c.name === name);
  if (!c) throw Error(name);
  return c;
};
const cmd = {
  id: "fixture",
  name: "Fixture commander",
  oracle_text: "",
  type_line: "Legendary Creature",
  cmc: 3,
} as Card;
it("describes the actual resources and recipients while keeping efficient staples as interaction", () => {
  for (const [name, resource, optional] of [
    ["Swords to Plowshares", "life", false],
    ["Path to Exile", "land", true],
    ["Angelic Ascension", "tokens", false],
    ["Divine Gambit", "permanent", true],
  ] as const) {
    const c = card(name),
      facts = cardTradeoffs(c);
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({
      resource,
      optional,
      timing: "resolution",
    });
    expect(interactionProfile(c).tradeoffs).toEqual(facts);
    expect(constructionRoles(c, cmd)).toContain("interaction");
    expect(interactionProfile(c).notes.join(" ")).toContain(
      "no mana-equivalent price",
    );
  }
  expect(cardTradeoffs(card("Angelic Ascension"))[0].oracleClause).toContain(
    "4/4",
  );
  expect(cardTradeoffs(card("Swords to Plowshares"))[0].recipient).toBe(
    "target-controller",
  );
});
it("distinguishes a later replacement trigger, each-player resources and an opponent event that grants them nothing", () => {
  expect(cardTradeoffs(card("Baffling End"))[0]).toMatchObject({
    recipient: "opponent",
    resource: "tokens",
    timing: "later-condition",
  });
  expect(cardTradeoffs(card("Party Dude"))[0]).toMatchObject({
    recipient: "each-player",
    resource: "tokens",
    timing: "triggered",
  });
  expect(cardTradeoffs(card("The Unagi of Kyoshi Island"))).toEqual([]);
  expect(
    cardTradeoffs({
      ...cmd,
      oracle_text: "You draw two cards. Create a Treasure token.",
    }),
  ).toEqual([]);
});
it("lets explicit type reconsideration recover from a conflict without discarding the other constraints", () => {
  const first = {
    role: "user",
    content: "Only exactly 5 mana creatures. No creatures. No artifacts.",
  };
  expect(parseAIRequest([first]).errors.length).toBeGreaterThan(0);
  const fixed = parseAIRequest([
    first,
    { role: "user", content: "Allow creatures. Replace them instead." },
  ]);
  expect(fixed.errors).toEqual([]);
  expect(fixed.excludedTypes).toEqual(["Artifact"]);
  expect(fixed.manaValue).toBe(5);
  expect(fixed.relation).toBe("exact");
  expect(
    parseAIRequest([
      first,
      { role: "user", content: "Do not allow creatures." },
    ]).errors.length,
  ).toBeGreaterThan(0);
  expect(
    parseAIRequest([first, { role: "user", content: "Other options." }]).errors
      .length,
  ).toBeGreaterThan(0);
});
const review = {
  budget: 200,
  budgetMeaning: "deck" as const,
  totalBudget: 200,
  deckValue: 190,
  pairs: [
    { id: "saving", purchase: 5, cutPrice: 30, addPrice: 5 },
    { id: "expensive", purchase: 20, cutPrice: 5, addPrice: 20 },
  ],
};
it("previews each selected subset instead of using the full proposal value", () => {
  expect(selectedReviewBudget(review, ["expensive"])).toMatchObject({
    valid: false,
    deckValue: 215,
  });
  expect(selectedReviewBudget(review, ["saving", "expensive"])).toMatchObject({
    valid: true,
    deckValue: 190,
  });
  expect(selectedReviewBudget(review, ["saving"])).toMatchObject({
    valid: true,
    deckValue: 175,
  });
  expect(selectedReviewBudget(review, []).valid).toBe(false);
});
it("does not confuse owned purchase zero with market zero or permit unknown subset totals", () => {
  const owned = {
    ...review,
    pairs: [review.pairs[0], { ...review.pairs[1], purchase: 0 }],
  };
  expect(selectedReviewBudget(owned, ["expensive"])).toMatchObject({
    purchase: 0,
    deckValue: 215,
    valid: false,
  });
  const unknown = {
    ...review,
    pairs: [{ ...review.pairs[0], cutPrice: null }, review.pairs[1]],
  };
  expect(selectedReviewBudget(unknown, ["expensive"])).toMatchObject({
    deckValue: null,
    valid: false,
  });
  expect(selectedReviewBudget(unknown, ["saving", "expensive"]).valid).toBe(
    true,
  );
  expect(
    selectedReviewBudget(
      { ...review, budgetMeaning: "purchases", budget: 10 },
      ["expensive"],
    ).valid,
  ).toBe(false);
});

it("does not mistake a compensation amount or replacement-token keyword for a target restriction", () => {
  const swords = interactionProfile(card("Swords to Plowshares"));
  expect(swords.effects[0].breadth).toBe("type-limited");
  expect(swords.notes.join(" ")).not.toContain(
    "exact mana-value/power/toughness restriction",
  );
  expect(interactionProfile(card("Angelic Ascension")).effects[0].breadth).toBe(
    "type-limited",
  );
});
