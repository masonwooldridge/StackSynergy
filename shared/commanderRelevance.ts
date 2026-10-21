import {tokenProductionProfile} from "./tokenPlan";
import { usefulCopiedEntry, energyFunction } from "./cardFunction";
import {
  evidenceFor,
  evidenceUrl,
  evidenceReviewedAt,
} from "./commanderEvidence";
import type { Card } from "./model";
import { cardText } from "./recommendations";
import {
  normalizeSelection,
  selectionMatches,
  typeMatches,
  type StrategySelection,
} from "./strategySelection";
export interface CardRanking {
  card: Card;
  score: number;
  reasons: string[];
}
export function commanderSignals(commanders: Card[]) {
  const text = commanders.map(cardText).join("\n");
  const subtypeWords = commanders
    .flatMap((c) => (c.type_line?.split("—")[1] || "").trim().split(/\s+/))
    .filter(Boolean);
  const typal = [
    ...new Set(
      subtypeWords.filter((type) =>
        new RegExp(
          "\\b" + type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "s?\\b",
          "i",
        ).test(text),
      ),
    ),
  ];
  return {
    castTypes: ["Enchantment", "Artifact", "Creature"].filter(type => new RegExp("whenever you cast (?:an? |your (?:first|second) )?" + type + " spell", "i").test(text) || (type === "Enchantment" && /whenever (?:an? |another )?enchantment[^.\n]*enters/i.test(text))),
    energy: /\{E\}|energy counter/i.test(text),
    copyCreature: /copy[^.\n]*creature|creature[^.\n]*copy/i.test(text),
    tokens: /creat[^.\n]*token|tap[^.\n]*untapped tokens|sacrifice[^.\n]*tokens you control|tokens you control/i.test(text),
    attacks: /whenever[^.\n]*attacks|combat damage/i.test(text),
    blink: /exile[^.\n]*return|return[^.\n]*exiled/i.test(text),
    graveyard: /graveyard/i.test(text),
    spells: /cast[^.\n]*(?:instant|sorcery)/i.test(text),
    permanentReplay: /cast[^.\n]*permanent[^.\n]*graveyard/i.test(text),
    typal,
  };
}
export function commanderCandidateQueries(commanders: Card[]) {
  const s = commanderSignals(commanders),
    queries: { name: string; query: string }[] = [
      {
        name: "Efficient mana sources",
        query:
          't:artifact mv<=3 (o:"add {" or o:"any color" or o:"add one mana" or o:"add two mana")',
      },
    ];
  for (const kind of s.castTypes) queries.push({name: kind + " cast engine support", query: "t:" + kind.toLowerCase() + " mv<=4"});
  if (s.typal.length)
    queries.push({
      name: "Commander creature types",
      query:
        "(" +
        s.typal
          .map(
            (type) =>
              `(t:${JSON.stringify(type)} or o:${JSON.stringify(type)} or o:changeling)`,
          )
          .join(" or ") +
        ")",
    });
  if (s.spells)
    queries.push({
      name: "Efficient spell triggers",
      query: "(t:instant or t:sorcery) mv<=3",
    });
  if (s.spells)
    queries.push({
      name: "Spell payoff engines",
      query: 't:creature o:"instant or sorcery" (o:draw or o:token) mv<=5',
    });
  if (s.permanentReplay)
    queries.push({
      name: "Reusable graveyard permanents",
      query:
        "(t:creature or t:artifact or t:enchantment) (o:sacrifice or o:mill or o:enters) mv<=4",
    });
  if (s.permanentReplay)
    queries.push({
      name: "Graveyard fuel",
      query: "(t:creature or t:artifact or t:enchantment) o:mill mv<=4",
    });
  if (s.energy)
    queries.push({ name: "Energy engine", query: '(o:"{E}" or o:energy)' });
  if (s.copyCreature || s.blink)
    queries.push({
      name: "Reusable creature enters abilities",
      query:
        "t:creature o:enters (o:draw or o:destroy or o:exile or o:return or o:damage) mv<=7",
    });
  if (s.tokens)
    queries.push({
      name: "Token support",
      query: "(o:token (o:additional or o:twice or o:populate))",
    });
  if (s.attacks)
    queries.push({
      name: "Attack support",
      query:
        '(o:"additional combat" or (o:"creatures you control" o:haste) or (t:equipment (o:haste or o:"can\'t be blocked")))',
    });
  if (s.graveyard)
    queries.push({
      name: "Graveyard engine",
      query: "(o:graveyard (o:return or o:cast))",
    });
  const evidence = evidenceFor(commanders);
  if (evidence)
    queries.unshift({
      name: "Reviewed commander recommendations",
      query:
        "(" +
        evidence.cards.map((name) => "!" + JSON.stringify(name)).join(" or ") +
        ")",
    });
  return queries.slice(0, evidence ? 6 : 5);
}
export function rankCommanderCards(
  cards: Card[],
  commanders: Card[],
  selection: StrategySelection = normalizeSelection(null),
  referenceIds: string[] = [],
): CardRanking[] {
  const s = commanderSignals(commanders),
    refs = new Set(referenceIds),
    commandersSet = new Set(commanders.map((c) => c.oracle_id || c.id));
  return cards
    .map((card) => {
      let score = 0;
      const reasons: string[] = [];
      const text = card.card_faces?.[0]?.oracle_text ?? card.oracle_text ?? "",
        type =
          card.card_faces?.[0]?.type_line ||
          card.type_line?.split(" // ")[0] ||
          "",
        creature = /Creature/.test(type);
      const add = (points: number, reason: string) => {
        score += points;
        reasons.push(reason);
      };
      if (s.typal.some((type) => typeMatches(card, type)))
        add(
          30,
          "Matches a creature type explicitly referenced by the commander.",
        );
      if (s.castTypes.some(kind => new RegExp("\\b" + kind + "\\b").test(type)))
        add(36 - Math.min(card.cmc || 0, 10) * 2, "A matching permanent spell directly triggers the commander; lower costs support repeated casts.");
      if (s.spells && /\b(?:Instant|Sorcery)\b/.test(type))
        add(
          24 - Math.min(card.cmc || 0, 12),
          "Casting an instant or sorcery triggers the commander; lower mana value leaves room for more casts.",
        );
      if (
        s.permanentReplay &&
        /\b(?:Creature|Artifact|Enchantment|Planeswalker|Battle)\b/.test(type)
      ) {
        add(
          12,
          "A permanent can be replayed by the commander from the graveyard.",
        );
        if (/sacrifice|mill|(?:when|whenever)[^.\n]{0,100}enters/i.test(text))
          add(
            14,
            "Has sacrifice, self-mill or enters text to review for recurring permanent value.",
          );
      }
      if (s.energy && /\{E\}|energy counter/i.test(text)) {
        const energy = energyFunction(card),
          repeatable = energy.repeatableProducer || energy.usefulOutlet;
        add(
          repeatable ? 34 : 14,
          repeatable
            ? "Repeatable energy production or a useful energy outlet supports the commander engine."
            : "One-shot energy support; not a repeatable engine.",
        );
      }
      if (s.energy && /proliferate/i.test(text))
        add(
          12,
          "Can increase the commander’s energy counters; check all proliferate targets.",
        );
      if (s.copyCreature && creature && usefulCopiedEntry(card))
        add(
          30,
          "A creature with an enters/dies trigger can provide value when copied.",
        );
      if (s.copyCreature && creature && usefulCopiedEntry(card))
        add(
          8,
          "Its creature enters trigger provides cards, removal or recursion when copied.",
        );
      if (
        s.copyCreature &&
        /(?:token|copy)[^.\n]*(?:additional|twice)|(?:additional|twice)[^.\n]*(?:token|copy)|populate/i.test(
          text,
        )
      )
        add(22, "Interacts with creature copies or the number of tokens.");
      if (
        s.copyCreature &&
        /whenever[^.\n]*creature[^.\n]*(?:enters|dies)/i.test(text) &&
        !/nontoken|if you cast/i.test(text) &&
        /draw|damage|\{E\}|energy/i.test(text)
      )
        add(18, "Can reward the commander’s creature entering or dying.");
      if (
        s.tokens &&
        (tokenProductionProfile(card).ownCreature || tokenProductionProfile(card).ownResource)
      )
        add(6, "Creates tokens relevant to the commander’s token plan.");
      if (s.attacks && /additional combat|untap all creatures/i.test(text))
        add(
          22,
          "Can provide another attack or untap attackers for the commander.",
        );
      if (
        s.attacks &&
        !creature &&
        /creatures?[^.\n]*(?:have|gain)[^.\n]*haste/i.test(text)
      )
        add(12, "Can enable attacks without waiting a turn.");
      if (
        s.blink &&
        creature &&
        /(?:when|whenever)[^.\n]{0,100}enters/i.test(text)
      )
        add(
          25,
          "An enters trigger can be reused by the commander’s blink effect.",
        );
      if (
        s.graveyard &&
        /return[^.\n]*graveyard|cast[^.\n]*graveyard/i.test(text)
      )
        add(
          18,
          "Can reuse cards from the graveyard mentioned by your commander.",
        );
      for (const label of selectionMatches(card, selection))
        add(14, "Matches selected " + label + ".");
      if (refs.has(card.oracle_id || card.id))
        add(
          16,
          "Already used in one of your decks with this commander; not counted as owned unless in a binder.",
        );
      const evidence = evidenceFor(commanders);
      if (evidence && evidence.cards.includes(card.name) && score > 0)
        add(
          12,
          "Reviewed " +
            evidence.theme +
            " example (" +
            evidenceReviewedAt +
            "): " +
            evidenceUrl(evidence.slug) +
            ". Inclusion is evidence, not a guarantee.",
        );
      if (
        card.mana_cost === "" &&
        !/Land/.test(type) &&
        !card.card_faces?.[0]?.mana_cost
      ) {
        score -= 45;
        reasons.push(
          "No normal mana cost; requires another casting route. Not treated as a free spell.",
        );
      }
      if (score > 0 && card.cmc) {
        score -= Math.max(0, card.cmc - 4) * 3;
      }
      if (commandersSet.has(card.oracle_id || card.id)) {
        score = 0;
        reasons.length = 0;
      }
      return { card, score, reasons };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.card.cmc || 0) - (b.card.cmc || 0) ||
        a.card.name.localeCompare(b.card.name),
    );
}
