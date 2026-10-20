import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { Card } from "../shared/model";
import { cardFunctionFacts, manaProfile } from "../shared/mtgCardFunctions";
import { matchesMTGTerm } from "../shared/mtgGlossary";
import {
  parseAIRequest,
  matchesAIRequest,
  requestSummary,
  hasIncreaseTarget,
} from "../shared/aiConstraints";
import { aiCandidateQueries } from "../shared/aiUpgradeQuality";
const cards = JSON.parse(
    readFileSync(
      new URL("./fixtures/mtgTermCards.json", import.meta.url),
      "utf8",
    ),
  ).cards as Card[],
  card = (name: string) => {
    const c = cards.find((c) => c.name === name);
    if (!c) throw Error("Missing canonical fixture " + name);
    return c;
  };
const req = (s: string) => parseAIRequest([{ role: "user", content: s }]);
it.each([
  "Sol Ring",
  "Arcane Signet",
  "Boros Signet",
  "Mind Stone",
  "Commander's Sphere",
  "Darksteel Ingot",
  "Gilded Lotus",
])(
  "identifies canonical mana-producing artifact %s as a reusable rock",
  (name) => {
    expect(matchesMTGTerm(card(name), "mana-rock")).toBe(true);
  },
);
it.each([
  "Llanowar Elves",
  "Cultivate",
  "Dark Ritual",
  "Cloud Key",
  "Prophetic Prism",
  "Lotus Petal",
  "Seat of the Synod",
])("does not conflate %s with reusable mana rocks", (name) => {
  expect(matchesMTGTerm(card(name), "mana-rock")).toBe(false);
});
it("handles activation payments, alternative sacrifice draw, conditional dependencies and hybrids", () => {
  expect(manaProfile(card("Boros Signet")).abilities[0].net).toBe(1);
  expect(manaProfile(card("Mind Stone")).manaRock).toBe(true);
  expect(manaProfile(card("Springleaf Drum")).conditionalMana).toBe(true);
  expect(manaProfile(card("Silver Myr")).manaRock).toBe(true);
  expect(manaProfile(card("Silver Myr")).manaDork).toBe(true);
  expect(manaProfile(card("Lotus Petal")).oneShotArtifactMana).toBe(true);
  expect(matchesMTGTerm(card("Ashnod's Altar"), "sacrifice-outlet")).toBe(true);
});
it("distinguishes ramp, fixing, cost reduction and land-to-hand tutors", () => {
  expect(matchesMTGTerm(card("Cultivate"), "land-ramp")).toBe(true);
  expect(matchesMTGTerm(card("Sylvan Scrying"), "land-ramp")).toBe(false);
  expect(matchesMTGTerm(card("Sylvan Scrying"), "tutor")).toBe(true);
  expect(matchesMTGTerm(card("Prophetic Prism"), "fixing")).toBe(true);
  expect(matchesMTGTerm(card("Cloud Key"), "cost-reduction")).toBe(true);
  expect(matchesMTGTerm(card("Dark Ritual"), "ritual")).toBe(true);
  expect(matchesMTGTerm(card("Manamorphose"), "ritual")).toBe(false);
});
it("preserves exact cost, no-tapped restriction and money budget for the combined user request", () => {
  const r = req("more two mana rocks under $5, no tapped rocks");
  expect(r.manaValue).toBe(2);
  expect(r.relation).toBe("exact");
  expect(r.mechanics).toEqual(["mana-rock"]);
  expect(r.types).toEqual(["Artifact"]);
  expect(r.noTapped).toBe(true);
  expect(r.purchaseBudget).toBe(4.99);
  expect(matchesAIRequest(card("Boros Signet"), r)).toBe(true);
  expect(matchesAIRequest(card("Coldsteel Heart"), r)).toBe(false);
  expect(matchesAIRequest(card("Llanowar Elves"), r)).toBe(false);
  expect(requestSummary(r)).toContain("Mana rocks");
});
it("recognizes negative roles, explicit unions and exclusions without treating them as a positive count target", () => {
  const r = req("ramp but no rocks");
  expect(matchesAIRequest(card("Cultivate"), r)).toBe(true);
  expect(matchesAIRequest(card("Sol Ring"), r)).toBe(false);
  const union = req("(rocks or dorks) under three mana but no rituals");
  expect(union.clarifications).toEqual([]);
  expect(union.manaValue).toBe(2);
  expect(union.relation).toBe("max");
  expect(matchesAIRequest(card("Boros Signet"), union)).toBe(true);
  expect(matchesAIRequest(card("Llanowar Elves"), union)).toBe(true);
  expect(matchesAIRequest(card("Dark Ritual"), union)).toBe(false);
  expect(hasIncreaseTarget(req("No rocks"))).toBe(false);
});
it("does not turn land-ramp terminology into a requirement for Land cards", () => {
  const r = req("No more rocks; improve land ramp instead");
  expect(r.types).toEqual([]);
  expect(r.mechanics).toEqual(["land-ramp"]);
  expect(matchesAIRequest(card("Cultivate"), r)).toBe(true);
  expect(matchesAIRequest(card("Arcane Signet"), r)).toBe(false);
});
it("keeps price and mana-value bounds separate and checks output colors", () => {
  const r = req("rocks under $3 that cost two mana or less");
  expect(r.manaValue).toBe(2);
  expect(r.relation).toBe("max");
  expect(r.purchaseBudget).toBe(2.99);
  const color = req("Mana rocks for blue or black mana that enter untapped");
  expect(color.noTapped).toBe(true);
  expect(matchesAIRequest(card("Dimir Signet"), color)).toBe(true);
  expect(matchesAIRequest(card("Sol Ring"), color)).toBe(false);
});
it("uses registry-backed typo correction and asks genuinely ambiguous questions", () => {
  expect(req("More mana roks").mechanics).toEqual(["mana-rock"]);
  expect(req("More mana roks").terminology?.corrections.length).toBeGreaterThan(
    0,
  );
  expect(req("I need more counters").clarifications?.length).toBeGreaterThan(0);
  expect(
    req("Keep Sol Ring, replace other expensive rocks").clarifications?.length,
  ).toBeGreaterThan(0);
  expect(req("Explain The Rock deck").clarifications?.length).toBeGreaterThan(
    0,
  );
  expect(req("What are mana rocks?").mode).toBe("explain");
});
it("separates cantrip/loot/rummage, blink/bounce, and self-sacrifice from general outlets", () => {
  expect(matchesMTGTerm(card("Ponder"), "cantrip")).toBe(true);
  expect(matchesMTGTerm(card("Faithless Looting"), "loot")).toBe(true);
  expect(matchesMTGTerm(card("Thrill of Possibility"), "rummage")).toBe(true);
  expect(matchesMTGTerm(card("Ephemerate"), "blink")).toBe(true);
  expect(matchesMTGTerm(card("Ephemerate"), "bounce")).toBe(false);
  expect(matchesMTGTerm(card("Unsummon"), "bounce")).toBe(true);
  expect(matchesMTGTerm(card("Sakura-Tribe Elder"), "sacrifice-outlet")).toBe(
    false,
  );
  expect(matchesMTGTerm(card("Sakura-Tribe Elder"), "land-ramp")).toBe(true);
});
it("recognizes actual mixed card functions without claiming all are reliable ramp or draw advantage", () => {
  expect(cardFunctionFacts(card("Commander's Sphere")).flags["card-draw"]).toBe(
    true,
  );
  expect(cardFunctionFacts(card("Swiftfoot Boots")).flags.voltron).toBe(true);
  expect(cardFunctionFacts(card("Heroic Intervention")).flags.protection).toBe(
    true,
  );
  expect(cardFunctionFacts(card("Cyclonic Rift")).flags["board-wipe"]).toBe(
    true,
  );
  expect(
    cardFunctionFacts(card("Counterspell")).flags["permanent-counters"],
  ).toBe(false);
});
it("retrieval plans prioritize term examples and preserve the exact-mana constraint on every query", () => {
  const r = req("more two mana rocks under $5, no tapped rocks"),
    queries = aiCandidateQueries(
      [],
      "more two mana rocks under $5, no tapped rocks",
      r,
    );
  expect(queries[0].query).toContain("Arcane Signet");
  expect(queries.every((q) => q.query.includes("mv=2"))).toBe(true);
  expect(queries[0].query).toContain("t:artifact");
});
it("keeps follow-up negations and accepts an explicit reversal instead of permanently excluding a role", () => {
  const r = parseAIRequest([
    { role: "user", content: "more rocks, no dorks" },
    { role: "user", content: "No rocks; add dorks" },
    { role: "user", content: "Actually allow rocks; add rocks again" },
  ]);
  expect(r.excludedMechanics).not.toContain("mana-rock");
  expect(matchesAIRequest(card("Sol Ring"), r)).toBe(true);
});
