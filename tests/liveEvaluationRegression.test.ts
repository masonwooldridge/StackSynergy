import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { Card } from "../shared/model";
import { manaProfile, cardFunctionFacts } from "../shared/mtgCardFunctions";
import { matchesAIRequest, parseAIRequest } from "../shared/aiConstraints";
import { aiCandidateQueries } from "../shared/aiUpgradeQuality";
import { rampSequence } from "../shared/strategicQuality";
const cards = JSON.parse(
  readFileSync(
    new URL("./fixtures/liveEvaluationCards.json", import.meta.url),
    "utf8",
  ),
).cards as Card[];
const card = (name: string) => cards.find((c) => c.name === name)!;
it("treats actual Cryptex evidence collection as conditional mana rather than guaranteed early acceleration", () => {
  const c = card("Cryptex");
  expect(manaProfile(c).manaRock).toBe(true);
  expect(manaProfile(c).conditionalMana).toBe(true);
  expect(manaProfile(c).reliableAcceleration).toBe(false);
  expect(rampSequence(c, 4)).toBeNull();
  expect(
    matchesAIRequest(
      c,
      parseAIRequest([
        { role: "user", content: "two mana rocks, no conditional mana" },
      ]),
    ),
  ).toBe(false);
});
it("retrieves clone discussion from clone sources instead of substituting generic ETB creatures", () => {
  const request = parseAIRequest([
    {
      role: "user",
      content:
        "Explain which creature clone options fit my Satya bracket 4 deck. Evaluate ETB value and legendary-copy restrictions. No edits.",
    },
  ]);
  expect(request.mode).toBe("explain");
  expect(request.clarifications).toEqual([]);
  expect(request.mechanics).toContain("clone");
  const queries = aiCandidateQueries(
    [],
    "creature clone options with ETB value",
    request,
  );
  expect(queries[0].query).toContain("Spark Double");
  expect(queries[0].query).toContain("Auton Soldier");
  expect(queries[0].query).not.toContain("Wall of Omens");
  expect(queries[1].query).toContain("copy of");
});
it("recognizes a canonical enter-as-copy creature without pretending it has a literal entry trigger", () => {
  expect(cardFunctionFacts(card("Auton Soldier")).flags.clone).toBe(true);
  expect(cardFunctionFacts(card("Cryptex")).flags.clone).toBe(false);
});
