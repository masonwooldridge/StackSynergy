import {deckPlanReadiness} from "./planReadiness";
import { manaAvailability } from "./mtgCardFunctions";
import { interactionProfile } from "./interactionProfile";
import { activeDeckCards } from "./deckContext";
import type { Card, Document } from "./model";
import type { AIRequest } from "./aiConstraints";
import { sameSuggestedCard } from "./suggestionMembership";
import { frontText } from "./cardFunction";
import { strategicProfile } from "./strategicQuality";
export const DISCUSSION_GROUNDING_VERSION = "oracle-evidence-v2";
const rulesSource =
  "https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.txt";
export const discussionRules = [
  {
    rule: "508.4",
    source: rulesSource,
    note: "A creature put onto the battlefield attacking was not declared as an attacker; its own attack event did not occur. Combat damage can still happen.",
  },
  {
    rule: "603.6a, 707.2",
    source: rulesSource,
    note: "A copy normally has the copied rules text; counters and tapped status are not copied. Its applicable entry triggers can trigger when it enters; merely entering as a copy is a replacement effect.",
  },
  {
    rule: "704.5j",
    source: rulesSource,
    note: "The legend rule checks legendary permanents with the same name under one player. An additional card type alone does not exempt a copy.",
  },
  {
    rule: "707.9b",
    source: rulesSource,
    note: "Exceptions built into a copy effect can be copiable. Check the actual exception, including whether the result remains legendary.",
  },
];
/** Read-only evidence, not a simulation, net-advantage guarantee or power rating. */
export function discussionCardFacts(card: Card, deck?: Document) {
  const text = frontText(card),
    type = card.card_faces?.[0]?.type_line || card.type_line || "";
  const entries =
    deck?.entries.filter((e) => e.qty > 0 && sameSuggestedCard(e.card, card)) ||
    [];
  const creature = /\bCreature\b/.test(type),
    draw = /\bdraw\b/i.test(text),
    copy = /\benter(?:s)?[^.\n]*as a copy/i.test(text);
  const drawPatterns = [
    ...(draw && /when[^.\n]*enters[^.\n]*draw/i.test(text)
      ? ["entry-triggered"]
      : []),
    ...(draw && /whenever[^.\n]*deals? combat damage[^.\n]*draw/i.test(text)
      ? ["combat-damage-triggered"]
      : []),
    ...(draw && /^[^:\n]+:[^\n]*draw/im.test(text) ? ["activated"] : []),
    ...(draw && /whenever|at the beginning/i.test(text)
      ? ["recurring-trigger-with-conditions"]
      : []),
  ];
  const limits: string[] = [];
  if (
    drawPatterns.includes("entry-triggered") &&
    !drawPatterns.some(
      (p) => p === "activated" || p === "recurring-trigger-with-conditions",
    )
  )
    limits.push(
      "One entry event; reuse requires another entry/copy/recursion event, not an autonomous draw engine.",
    );
  if (
    draw &&
    /discard|put[^.\n]*cards?[^.\n]*(?:back|on top|into your library)/i.test(
      text,
    )
  )
    limits.push(
      "Drawing plus filtering costs is not automatically net card advantage.",
    );
  if (
    /once each turn|only once|one or more|second card|power 2 or less/i.test(
      text,
    )
  )
    limits.push(
      "Apply the exact per-turn, event and eligible-creature conditions in Oracle text.",
    );
  if (/\b(?:flying|menace|trample)\b/i.test(text))
    limits.push(
      "Flying/menace/trample have blocking or damage restrictions; none universally guarantees an unblocked attacker.",
    );
  if (
    /prevent all combat damage[^.\n]*attacking creatures you control/i.test(
      text,
    )
  )
    limits.push(
      "Prevents specified combat damage; does not prevent blocking, exile, bounce, sacrifice or targeted removal.",
    );
  if (/\bshroud\b/i.test(text))
    limits.push(
      "Shroud stops all targeting of that permanent, including your own. It does not disable its abilities targeting other objects.",
    );
  const commander = deck?.entries.find(
    (e) => e.board === "commander" && e.qty > 0,
  )?.card;
  const strategy = commander
    ? strategicProfile(
        card,
        commander,
        deck?.commanderBracket || 3,
        undefined,
        deck?.entries
          .filter(
            (e) =>
              e.qty > 0 && (e.board === "mainboard" || e.board === "commander"),
          )
          .map((e) => e.card) || [],
      )
    : undefined;
  return {
    id: card.id,
    name: card.name,
    type,
    isCreatureCard: creature,
    membership: {
      inDocument: entries.length > 0,
      inMainDeck: entries.some(
        (e) => e.board === "mainboard" || e.board === "commander",
      ),
      quantity: entries.reduce((n, e) => n + e.qty, 0),
      boards: [...new Set(entries.map((e) => e.board))],
    },
    draw: draw ? { onCreatureCard: creature, patterns: drawPatterns } : null,
    copy: copy
      ? {
          entryReplacement: true,
          exceptions:
            text.match(/except[^.\n]*/i)?.[0] ||
            "No explicit exception in this text; normal copied characteristics apply.",
        }
      : null,
    interaction: interactionProfile(card, deck ? activeDeckCards(deck) : []),
    manaAvailability: manaAvailability(card, deck ? activeDeckCards(deck) : []),
    attackTrigger: !!strategy?.attackTrigger,
    combatDamageTrigger: !!strategy?.combatDamageTrigger,
    setup: strategy
      ? {
          printedManaValue: strategy.castMana,
          deployment: strategy.deployment,
          equipMana: strategy.firstEquipMana,
          minimumAnyNonManaActivationMana: strategy.activationMana,
        }
      : null,
    limits: [...limits, ...(strategy?.notes || [])].slice(0, 4),
  };
}
export function discussionGrounding(
  cards: Card[],
  deck: Document | undefined,
  request: AIRequest,
  goal: string,
  excludedNames: string[] = [],
) {
  const creatureDraw =
    /(?:^|[\s-])creatures?\b/i.test(goal) && /draw|card advantage/i.test(goal);
  const answerRequest =
    /interaction|removal|counterspells?|bounce|cleave|temporary exile/i.test(
      goal,
    );
  const interested = (c: Card) => {
    const t = frontText(c),
      type = c.card_faces?.[0]?.type_line || c.type_line || "";
    if (answerRequest && !creatureDraw) return interactionProfile(c).present;
    return creatureDraw
      ? /Creature/.test(type) && /\bdraw\b/i.test(t)
      : /clone|cop(?:y|ies)/i.test(goal)
        ? /enter(?:s)?[^.\n]*as a copy/i.test(t)
        : /evasion|unblockable|blockers|connect|can't be blocked/i.test(goal)
          ? /can.t be blocked|unblockable|flying|menace|trample|can.t block/i.test(
              t,
            )
          : /protect/i.test(goal)
            ? /prevent|hexproof|shroud|indestructible/i.test(t)
            : /combat|attack/i.test(goal)
              ? /attacks|combat damage|combat phase/i.test(t)
              : false;
  };
  const eligible = [
    ...new Map(
      cards.filter(interested).map((c) => [c.oracle_id || c.id, c]),
    ).values(),
  ];
  const installed = (card: Card) =>
    !!deck?.entries.some((e) => e.qty > 0 && sameSuggestedCard(e.card, card));
  const existing = eligible.filter(installed).slice(0, 2);
  const options = eligible
    .filter(
      (card) =>
        !installed(card) &&
        !excludedNames.includes(card.name.toLocaleLowerCase()),
    )
    .sort((a, b) => {
      const recurring = (card: Card) =>
        /whenever|at the beginning|^[^:\n]+:[^\n]*draw/im.test(frontText(card))
          ? 1
          : 0;
      return creatureDraw ? recurring(b) - recurring(a) : 0;
    })
    .slice(0, 6);
  const focus = [...existing, ...options];
  return {
    version: DISCUSSION_GROUNDING_VERSION,
    planReadiness:deckPlanReadiness(deck),
    rules: discussionRules,
    requestedCreatureDraw: creatureDraw,
    preferredDiscussionIds: focus.map((c) => c.id),
    installedDiscussionIds: existing.map((c) => c.id),
    newOptionDiscussionIds: options.map((c) => c.id),
    evidence: [
      ...new Map(
        [
          ...focus,
          ...cards.filter((c) =>
            goal.toLocaleLowerCase().includes(c.name.toLocaleLowerCase()),
          ),
        ].map((c) => [c.oracle_id || c.id, c]),
      ).values(),
    ]
      .slice(0, 12)
      .map((c) => discussionCardFacts(c, deck)),
    instruction:
      "Use actual creature cards for a creature-card draw request. Noncreature payoffs may be contrasts, explicitly labeled. Discuss installed cards as installed and candidates as candidates; only propose additions from validatedSwapOptions. Read full supplied Oracle text for all limits. These notes are evidence, not a guaranteed combo, lethal route or proof of strategic quality. Use planReadiness to distinguish structural completion from strategic readiness; explain shortfalls and offer explicit user choices rather than silently changing constraints or budget.",
    requestMode: request.mode,
  };
}
