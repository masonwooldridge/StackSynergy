import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { Card, Document } from "../shared/model";
import { newEntry } from "../shared/deckEditing";
import { constructionRoles } from "../shared/constructionPlan";
import { energyFunction, oneShotManaFilter } from "../shared/cardFunction";
import { packageMatches } from "../shared/themePackages";
import {
  assessAIUpgrade,
  requestedRoles,
  recommendAIUpgrades,
  aiCandidateQueries,
} from "../shared/aiUpgradeQuality";
import { previewUpgrade } from "../shared/deckUpgrade";
import { providerTurns } from "../src/aiConversation";
const facts = JSON.parse(
  readFileSync(
    new URL("./fixtures/aiQualityCards.json", import.meta.url),
    "utf8",
  ),
).cards as Card[];
const card = (name: string) =>
  structuredClone(facts.find((c) => c.name === name)!);
const satya = card("Satya, Aetherflux Genius"),
  hill = card("Hill Giant"),
  wall = card("Wall of Omens"),
  sextant = card("Barbed Sextant"),
  prison = card("Static Prison");
function deck() {
  const basic: Card = {
    id: crypto.randomUUID(),
    oracle_id: crypto.randomUUID(),
    name: "Plains",
    type_line: "Basic Land — Plains",
    color_identity: ["W"],
    legalities: { commander: "legal" },
    prices: { usd: "0.1" },
    finishes: ["nonfoil"],
    cmc: 0,
  };
  return {
    id: crypto.randomUUID(),
    name: "Synthetic Satya quality evaluation",
    kind: "deck",
    format: "commander",
    commanderBracket: 3,
    revision: 0,
    notes: "",
    entries: [
      { ...newEntry(satya), board: "commander" },
      { ...newEntry(basic), qty: 36 },
      newEntry(hill),
      ...Array.from({ length: 62 }, (_, i) =>
        newEntry({
          ...hill,
          id: crypto.randomUUID(),
          oracle_id: crypto.randomUUID(),
          name: "Synthetic filler " + i,
        }),
      ),
    ],
  } as Document;
}
it("does not call Barbed Sextant a draw engine or mana acceleration for Satya", () => {
  expect(oneShotManaFilter(sextant)).toBe(true);
  expect(constructionRoles(sextant, satya)).not.toContain("advantage");
  expect(constructionRoles(sextant, satya)).not.toContain("ramp");
  const d = deck(),
    cut = { ...newEntry(card("Chaos Warp")) };
  expect(assessAIUpgrade(d, cut, sextant, "Improve draw").accepted).toBe(false);
});
it("separates energy maintenance from production and recognizes Guide of Souls generation", () => {
  expect(energyFunction(prison)).toEqual({
    producer: true,
    repeatableProducer: false,
    usefulOutlet: false,
  });
  expect(packageMatches(prison, satya)).not.toContain("Energy engines");
  expect(energyFunction(card("Guide of Souls")).repeatableProducer).toBe(true);
  expect(energyFunction(card("Whirler Virtuoso")).usefulOutlet).toBe(true);
});
it("recognizes creature-entry draw for a copy commander and rejects unrelated removal for a draw goal", () => {
  expect(constructionRoles(wall, satya)).toContain("advantage");
  const d = deck(),
    cut = d.entries[2];
  const assessment = assessAIUpgrade(d, cut, wall, "Improve draw");
  expect(assessment.accepted).toBe(true);
  expect(assessment.quality?.summary).toContain("reuse with its copies");
  expect(assessment.quality?.curveChange).toContain("4 → 2");
  expect(assessment.quality?.tradeoff).toContain("body");
  expect(assessAIUpgrade(d, cut, prison, "Improve draw").accepted).toBe(false);
});
it("chooses a requested cut and cheaper reusable draw instead of the recorded energy/removal and filter substitutions", () => {
  const d = deck(),
    before = JSON.stringify(d),
    result = recommendAIUpgrades(
      d,
      [prison, sextant, wall, card("Inspiring Overseer")],
      [],
      2,
      false,
      "Cut Hill Giant to improve card advantage.",
    );
  expect(result.plan.pairs).toHaveLength(1);
  const pair = result.plan.pairs[0];
  expect(pair.cutName).toBe("Hill Giant");
  expect(pair.add.name).toBe("Wall of Omens");
  expect(pair.cut?.id).toBe(hill.id);
  expect(pair.addPrice).toBe(0.34);
  expect(pair.quality?.roleChange).toContain("card advantage 0 → 1");
  const preview = previewUpgrade(result.plan, d, [pair.id], []);
  expect(preview.document.entries.reduce((n, e) => n + e.qty, 0)).toBe(100);
  expect(JSON.stringify(d)).toBe(before);
});
it("rejects cosmetic same-role swaps and a large curve increase rather than forcing a recommendation", () => {
  const d = deck();
  d.entries[2] = newEntry(wall);
  expect(
    assessAIUpgrade(d, d.entries[2], card("Spirited Companion"), "More draw")
      .accepted,
  ).toBe(false);
  const expensive = {
    ...wall,
    id: crypto.randomUUID(),
    oracle_id: crypto.randomUUID(),
    cmc: 8,
  };
  expect(
    assessAIUpgrade(deck(), newEntry(hill), expensive, "More draw").accepted,
  ).toBe(false);
});
it("preserves legality, budget, ownership, protected cards and exact singleton identities", () => {
  const d = deck();
  const invalid = [
    { ...wall, color_identity: ["G"] },
    { ...wall, legalities: { commander: "banned" } },
    { ...wall, prices: { usd: null } },
  ];
  for (const c of invalid)
    expect(
      recommendAIUpgrades(d, [c], [], 10, false, "More draw").plan.pairs,
    ).toHaveLength(0);
  expect(
    recommendAIUpgrades(d, [wall], [], 0.1, false, "More draw").plan.pairs,
  ).toHaveLength(0);
  expect(
    recommendAIUpgrades(d, [wall], [], 0, true, "More draw").plan.pairs,
  ).toHaveLength(0);
  d.notes = "Keep Hill Giant";
  expect(
    recommendAIUpgrades(
      d,
      [wall],
      [],
      5,
      false,
      "Cut Hill Giant for draw",
    ).plan.pairs.every((p) => p.cutName !== "Hill Giant"),
  ).toBe(true);
});
it("offers only exact paired options and prioritizes the requested role in candidate search", () => {
  const queries = aiCandidateQueries([satya], "I need creature-entry draw");
  expect(queries.some((q) => q.query.includes("t:creature o:enters"))).toBe(
    true,
  );
  expect(queries).toHaveLength(3);
});
it("long assistant replies remain visible while bounded provider history stays valid for follow-up", () => {
  const turns = [
    { role: "assistant" as const, content: "a".repeat(5500) },
    { role: "user" as const, content: "Show me the proposed cards." },
  ];
  const sent = providerTurns(turns);
  expect(sent[0].content).toHaveLength(2000);
  expect(turns[0].content).toHaveLength(5500);
  expect(sent[1].content).toBe(turns[1].content);
});

it("does not confuse keeping removal with a request for removal replacements", () => {
  expect(requestedRoles("Improve draw while keeping removal")).toEqual([
    "advantage",
  ]);
  const d = deck(),
    cut = newEntry(card("Chaos Warp"));
  expect(
    assessAIUpgrade(d, cut, wall, "Improve draw while keeping removal")
      .accepted,
  ).toBe(false);
});

it("does not label delayed one-shot cantrips as draw engines or self-countering spells as interaction", () => {
  const d = deck();
  const clairvoyance = {
    ...wall,
    name: "Clairvoyance",
    type_line: "Instant",
    oracle_text:
      "Look at target player's hand. Draw a card at the beginning of the next turn's upkeep.",
  };
  expect(constructionRoles(clairvoyance, satya)).not.toContain("advantage");
  const artisans = {
    ...wall,
    name: "Goblin Artisans",
    oracle_text:
      "{T}: Flip a coin. If you win the flip, draw a card. If you lose the flip, counter target artifact spell you control.",
  };
  expect(constructionRoles(artisans, satya)).not.toContain("interaction");
  expect(assessAIUpgrade(d, d.entries[2], artisans, "More draw").accepted).toBe(
    false,
  );
});

it("does not count exchanging an artifact/land for one card as a generic draw engine or ignore X costs", () => {
  const filter = {
    ...wall,
    name: "Resource filter",
    oracle_text: "{1}{R}, {T}, Sacrifice an artifact or land: Draw a card.",
  };
  expect(constructionRoles(filter, satya)).not.toContain("advantage");
  const d = deck(),
    xdraw = {
      ...wall,
      name: "Variable draw",
      mana_cost: "{X}{U}",
      cmc: 1,
      oracle_text:
        "Draw four cards. Then choose X cards in your hand and discard the rest.",
    };
  expect(assessAIUpgrade(d, d.entries[2], xdraw, "Improve draw").accepted).toBe(
    false,
  );
});
