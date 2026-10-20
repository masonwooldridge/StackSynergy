import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { Card, Document } from "../shared/model";
import { assertDiscussionFacts } from "../shared/aiResponseSafety";
const cards = JSON.parse(
  readFileSync(
    new URL("./fixtures/discussionEvidenceCards.json", import.meta.url),
    "utf8",
  ),
).cards as Card[];
const card = (name: string) => cards.find((c) => c.name === name)!;
const deck = {
  entries: [
    { card: card("Satya, Aetherflux Genius"), board: "commander", qty: 1 },
  ],
} as Document;
it("rejects the observed attacking token conclusion even when an earlier sentence is correct", () => {
  expect(() =>
    assertDiscussionFacts(
      "Attack triggers occur when attackers are declared. The token enters attacking, so Lightning Runner triggers when it attacks.",
      cards,
      deck,
    ),
  ).toThrow();
});
it("rejects possessive and already-run membership claims while permitting hypothetical inclusion", () => {
  expect(() =>
    assertDiscussionFacts(
      "Your Dolmen Gate protects the attacking commander.",
      cards,
      deck,
    ),
  ).toThrow();
  expect(() =>
    assertDiscussionFacts(
      "You already run Whispersilk Cloak for evasion.",
      cards,
      deck,
    ),
  ).toThrow();
  expect(() =>
    assertDiscussionFacts(
      "If you run Dolmen Gate, it prevents combat damage to your attackers.",
      cards,
      deck,
    ),
  ).not.toThrow();
  expect(() =>
    assertDiscussionFacts("Dolmen Gate is not in your deck.", cards, deck),
  ).not.toThrow();
});
it("rejects an artifact-type legend rule loophole and incorrect copy entry claims", () => {
  expect(() =>
    assertDiscussionFacts(
      "An artifact copy avoids the legend rule because its card type differs.",
      cards,
      deck,
    ),
  ).toThrow();
  expect(() =>
    assertDiscussionFacts(
      "Clone does not copy the entry abilities of the creature it copies.",
      cards,
      deck,
    ),
  ).toThrow();
});
it("does not equate combat damage prevention with evasion or complete removal protection", () => {
  expect(() =>
    assertDiscussionFacts("Dolmen Gate makes Satya unblockable.", cards, deck),
  ).toThrow();
  expect(() =>
    assertDiscussionFacts("Dolmen Gate prevents exile removal.", cards, deck),
  ).toThrow();
});

import {
  discussionCardFacts,
  discussionGrounding,
} from "../shared/discussionGrounding";
import { discussionSearches } from "../shared/aiDiscussion";
import { parseAIRequest } from "../shared/aiConstraints";
import { assertDiscussionAdditions } from "../shared/aiResponseSafety";
it("grounds actual creature draw separately from noncreature combat payoffs", () => {
  const creature = discussionCardFacts(card("Enduring Curiosity"), deck),
    enchantment = discussionCardFacts(card("Reconnaissance Mission"), deck);
  expect(creature.isCreatureCard).toBe(true);
  expect(creature.draw?.onCreatureCard).toBe(true);
  expect(creature.draw?.patterns).toContain("combat-damage-triggered");
  expect(enchantment.isCreatureCard).toBe(false);
  expect(enchantment.draw?.onCreatureCard).toBe(false);
  const request = parseAIRequest([
    { role: "user", content: "Explain repeatable creature draw for my deck." },
  ]);
  expect(() =>
    assertDiscussionFacts(
      "Repeatable creature draw engines: Reconnaissance Mission rewards combat damage.",
      cards,
      deck,
      request,
      "Explain repeatable creature draw for my deck.",
    ),
  ).toThrow("noncreature");
  expect(() =>
    assertDiscussionFacts(
      "Reconnaissance Mission is an enchantment payoff, not a creature card; Enduring Curiosity is a creature draw option.",
      cards,
      deck,
      request,
      "Explain repeatable creature draw for my deck.",
    ),
  ).not.toThrow();
});
it("provides actual clone exceptions and distinguishes copy replacement from entry triggers", () => {
  for (const name of [
    "Auton Soldier",
    "Spark Double",
    "Phyrexian Metamorph",
    "Clone",
  ])
    expect(discussionCardFacts(card(name), deck).copy?.entryReplacement).toBe(
      true,
    );
  expect(
    discussionCardFacts(card("Auton Soldier"), deck).copy?.exceptions,
  ).toMatch(/isn.t legendary/);
  expect(
    discussionCardFacts(card("Spark Double"), deck).copy?.exceptions,
  ).toMatch(/legendary/);
  expect(() =>
    assertDiscussionFacts(
      "A copy with an explicit nonlegendary exception can avoid the legend rule. Merely adding artifact does not avoid the legend rule.",
      cards,
      deck,
    ),
  ).not.toThrow();
});
it("distinguishes prevention, evasion, shroud and setup from verified text", () => {
  expect(
    discussionCardFacts(card("Dolmen Gate"), deck).limits.join(" "),
  ).toContain("does not prevent blocking");
  expect(
    discussionCardFacts(card("Whispersilk Cloak"), deck).limits.join(" "),
  ).toContain("targeting other objects");
  expect(
    discussionCardFacts(card("Whispersilk Cloak"), deck).setup?.equipMana,
  ).toBe(2);
  expect(
    discussionCardFacts(card("Aethertide Whale"), deck).limits.join(" "),
  ).toContain("none universally guarantees");
});
it("tracks canonical membership on sideboards without presenting installed or rejected cards as new options", () => {
  const enduring = card("Enduring Curiosity"),
    ownedDeck = {
      ...deck,
      entries: [
        ...deck.entries,
        {
          card: { ...enduring, id: crypto.randomUUID() },
          board: "sideboard",
          qty: 2,
        },
      ],
    } as Document;
  const facts = discussionCardFacts(enduring, ownedDeck);
  expect(facts.membership).toEqual({
    inDocument: true,
    inMainDeck: false,
    quantity: 2,
    boards: ["sideboard"],
  });
  const question = "Explain repeatable creature draw for my deck.",
    request = parseAIRequest([{ role: "user", content: question }]);
  const guide = discussionGrounding(cards, ownedDeck, request, question, [
    "faerie mastermind",
  ]);
  expect(guide.installedDiscussionIds).toContain(enduring.id);
  expect(guide.newOptionDiscussionIds).not.toContain(enduring.id);
  expect(guide.newOptionDiscussionIds).not.toContain(
    card("Faerie Mastermind").id,
  );
  expect(
    guide.newOptionDiscussionIds.every((id) =>
      /Creature/.test(
        card(cards.find((c) => c.id === id)!.name).type_line || "",
      ),
    ),
  ).toBe(true);
});
it("adds standalone evasion searches rather than substituting damage prevention", () => {
  const goal = "Explain standalone evasion for my Satya deck. No edits.",
    queries = discussionSearches(
      goal,
      parseAIRequest([{ role: "user", content: goal }]),
    );
  expect(queries[0].query).toContain("Rogue's Passage");
  expect(queries[0].query).toContain("Access Tunnel");
  expect(queries[1].query).toContain("can't be blocked");
  expect(queries.some((q) => q.query.includes("Dolmen Gate"))).toBe(false);
});
it("does not let an irrelevant negation excuse the original false attack-trigger claim", () => {
  expect(() =>
    assertDiscussionFacts(
      "That token enters attacking; it does not need to be declared and will cause attack triggers to trigger.",
      cards,
      deck,
    ),
  ).toThrow("entering attacking");
});
it("blocks direct additions of installed/rejected cards but permits explaining them", () => {
  const enduring = card("Enduring Curiosity"),
    installed = {
      ...deck,
      entries: [
        ...deck.entries,
        { card: enduring, board: "mainboard", qty: 1 },
      ],
    } as Document;
  expect(() =>
    assertDiscussionAdditions(
      "Add Enduring Curiosity for repeatable draw.",
      cards,
      installed,
      [],
    ),
  ).toThrow("already in");
  expect(() =>
    assertDiscussionAdditions(
      "Consider adding Faerie Mastermind.",
      cards,
      deck,
      ["faerie mastermind"],
    ),
  ).toThrow("rejected");
  expect(() =>
    assertDiscussionAdditions(
      "Why Faerie Mastermind was discussed: it draws on the second-card event.",
      cards,
      deck,
      ["faerie mastermind"],
    ),
  ).not.toThrow();
});
