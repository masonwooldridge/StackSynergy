import type { AIRequest } from "./aiConstraints";
import { sameSuggestedCard } from "./suggestionMembership";
import type { Card, Document } from "./model";
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Narrow checks for observed factual failures; not a complete Magic rules engine. */
export function assertDiscussionFacts(
  reply: string,
  cards: Card[],
  deck?: Document,
  request?: AIRequest,
  question = "",
) {
  const commander = deck?.entries.find((e) => e.board === "commander")?.card;
  const text =
    commander?.card_faces?.[0]?.oracle_text || commander?.oracle_text || "";
  if (/tapped and attacking|enters[^.\n]*attacking/i.test(text)) {
    for (const sentence of reply.split(/(?<=[.!?])\s+|\n/)) {
      const token = /\btoken|enter(?:s|ing)?[^.\n]*attacking/i.test(sentence);
      const positive =
        /\bwill cause attack triggers[^.\n]{0,100}\bto trigger|\b(?:will|does|do) trigger\s*["“]?(?:when(?:ever)? (?:this creature|a creature you control) attacks|attack triggers)|\btriggers? (?:when(?:ever)? (?:it|this creature|the creature) attacks)|\bcounts? as attacking for[^.\n]*(?:when|whenever)[^.\n]*attacks/i.test(
          sentence,
        );
      const corrected =
        /\b(?:incorrect|false|wrong|not true)\b|later declared|later declare|(?:does not|do not|doesn.t|don.t|never|will not)\s+(?:cause[^.\n]{0,80}to\s+)?trigger/i.test(
          sentence,
        );
      if (token && positive && !corrected)
        throw Error(
          "AI explanation conflicts with an attacking-token rule: entering attacking does not trigger “when this attacks” abilities. No changes saved.",
        );
    }
  }
  for (const sentence of reply.split(/(?<=[.!?])\s+|\n/)) {
    const negated =
      /\b(?:does not|do not|doesn.t|don.t|cannot|can.t|not true|incorrect|false)\b/i.test(
        sentence,
      );
    if (
      !negated &&
      /(?:artifact|card type|different type)/i.test(sentence) &&
      /(?:avoids?|bypasses?|ignores?|exempt[^.]*from)[^.]*legend rule/i.test(
        sentence,
      )
    )
      throw Error(
        "AI proposed an unsupported card-type exception to the legend rule. No changes saved.",
      );
    if (
      /(?:clone|copy|copies)/i.test(sentence) &&
      /(?:does not|doesn.t|cannot|can.t) copy[^.]*entr(?:y|ers|y-triggered) abilit/i.test(
        sentence,
      )
    )
      throw Error(
        "AI denied copied entry abilities without a supported exception. No changes saved.",
      );
    if (
      /Dolmen Gate/i.test(sentence) &&
      !negated &&
      /makes?[^.]*unblockable|prevents?[^.]*exile|stops?[^.]*targeted removal/i.test(
        sentence,
      )
    )
      throw Error(
        "AI extended combat-damage prevention beyond the card text. No changes saved.",
      );
  }
  const creatureDraw =
    !!request?.types.includes("Creature") &&
    (/draw|card advantage/i.test(question) ||
      request.mechanics?.includes("card-draw"));
  if (
    creatureDraw &&
    !/^\s*(?:why|compare|what about|explain why)/i.test(question)
  ) {
    const mentioned = cards.filter((card) =>
      reply.toLowerCase().includes(card.name.toLowerCase()),
    );
    const creatures = mentioned.filter((card) =>
      /\bCreature\b/.test(
        card.card_faces?.[0]?.type_line || card.type_line || "",
      ),
    );
    if (
      mentioned.length &&
      !creatures.length &&
      !/noncreature|not (?:a |the )?creature|artifact|enchantment|no (?:eligible |matching )?creature|missing creature|lack[^.]*creature/i.test(
        reply,
      )
    )
      throw Error(
        "AI substituted noncreature payoffs for the requested creature-card draw options. No changes saved.",
      );
  }
  if (deck) {
    for (const card of cards) {
      if (
        deck.entries.some((e) => e.qty > 0 && sameSuggestedCard(e.card, card))
      )
        continue;
      const name = escape(card.name);
      for (const sentence of reply.split(/(?<=[.!?])\s+|\n/)) {
        const hypothetical =
          /^\s*(?:if|once|when you add|should you|consider)|\b(?:could add|would add|not in|isn.t in|aren.t in|don.t (?:run|have)|do not (?:run|have))\b/i.test(
            sentence,
          );
        const installed = new RegExp(
          name +
            "\\s*(?:\\([^)]*\\)\\s*)?(?:is|are)\\s+(?:already\\s+)?(?:present\\s+)?in\\s+(?:(?:your|the)\\s+)?deck\\b|\\byour\\s+(?:existing\\s+|copy of\\s+)?" +
            name +
            "\\b|\\byou\\s+(?:already\\s+)?(?:run|have|play|include)\\b[^.!?\\n]{0,45}\\b" +
            name,
          "i",
        );
        if (installed.test(sentence) && !hypothetical)
          throw Error(
            "AI confused a retrieved candidate with an installed card (" +
              card.name +
              "). No changes saved.",
          );
      }
    }
  }
}
export function readableAIReply(reply: string) {
  const id = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  return reply
    .replace(new RegExp("\\s*\\((?:id\\s+)?" + id + "\\)", "gi"), "")
    .replace(new RegExp("\\bid\\s+" + id, "gi"), "")
    .replace(new RegExp(id, "gi"), "[card reference]");
}

/** Narrow imperative-add check; discussing an earlier card remains valid. */
export function assertDiscussionAdditions(
  reply: string,
  cards: Card[],
  deck: Document | undefined,
  excludedNames: string[],
) {
  for (const card of cards) {
    const present = deck?.entries.some(
      (e) => e.qty > 0 && sameSuggestedCard(e.card, card),
    );
    const rejected = excludedNames.includes(card.name.toLocaleLowerCase());
    if (!present && !rejected) continue;
    const recommendation = new RegExp(
      "(?:^|[;:\\n])\\s*(?:[-*]\\s*)?(?:add|include|buy|pick up|consider adding|try adding)\\s+(?:a |an |one |1 )?" +
        escape(card.name) +
        "\\b",
      "i",
    );
    if (recommendation.test(reply))
      throw Error(
        present
          ? "AI recommended adding a card already in this deck. No changes saved."
          : "AI repeated a rejected or previous alternative as a new addition. No changes saved.",
      );
  }
}
