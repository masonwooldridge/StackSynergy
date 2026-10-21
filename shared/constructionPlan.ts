import { interactionProfile } from "./interactionProfile";
import { roleConfidence } from "./roleConfidence";
import { deploymentPenalty } from "./deploymentCost";
import { reliableRole } from "./mechanicalSupport";
import {
  normalizeBuildIntent,
  tokenProductionProfile,
  type BuildIntent,
} from "./tokenPlan";
import {
  exchangesAllDrawnCards,
  singleDrawExchangesPermanent,
  sacrificesItself,
  oneShotManaFilter,
  usefulCopiedEntry,
} from "./cardFunction";
import type { Card } from "./model";
import { suggestionsFor } from "./recommendations";
import { commanderSignals } from "./commanderRelevance";
export const constructionSources = [
  {
    title: "Brian Cain: How to Build a Commander Deck",
    url: "https://edhrec.com/guides/how-to-build-a-commander-deck",
  },
  {
    title: "Cooper Gottfried: Upgrading Your Commander Deck",
    url: "https://edhrec.com/guides/edhrec-guide-to-upgrading-your-commander-deck",
  },
  {
    title: "Tomer Abramovici: Budget Commander checklist",
    url: "https://www.mtggoldfish.com/articles/shrine-tribal-50-100-200-budget-commander",
  },
];
export type ConstructionRole =
  | "production"
  | "untap"
  | "haste"
  | "ramp"
  | "advantage"
  | "interaction"
  | "wipes"
  | "protection"
  | "finisher"
  | "synergy";
export const supportQueries = [
  '(t:artifact mv<=3 (o:"add {" or o:"any color")) or (o:"search your library" o:"onto the battlefield" o:land)',
  '(o:"draw two cards" or o:"draw three cards" or (o:"draw a card" (o:whenever or o:"at the beginning")))',
  '(t:instant or t:sorcery) mv<=4 (o:"destroy target" or o:"exile target" or o:"counter target spell" or o:"return target")',
  '(o:"destroy all" or o:"exile all" or o:"damage to each creature") -t:land',
  '(t:instant or t:sorcery or t:enchantment) (o:indestructible or o:hexproof or o:"phase out" or o:"phases out")',
  '(o:"additional combat" or (o:"creatures you control" (o:"double strike" or o:"get +")) or (o:"each opponent" o:damage (o:enters or o:whenever)))',
  't:land -t:basic (o:"any color" or o:"add {")',
  "t:basic usd<=0.15",
];
export const constructionText = (card: Card) =>
  card.card_faces?.[0]?.oracle_text ?? card.oracle_text ?? "";
export function constructionRoles(
  card: Card,
  commander: Card,
  context: Card[] = [],
): ConstructionRole[] {
  const text = constructionText(card).replace(/\([^()]*\)/g, ""),
    signal = commanderSignals([commander]),
    roles: ConstructionRole[] = [];
  if (
    suggestionsFor(
      [
        {
          ...card,
          oracle_text: text,
          card_faces: undefined,
          type_line: card.card_faces?.[0]?.type_line || card.type_line,
        },
      ],
      [commander],
      "any",
    )[0]?.reasons.some((r) => r.role === "ramp") &&
    !oneShotManaFilter(card)
  )
    roles.push("ramp");
  const tokens = tokenProductionProfile(card);
  if (tokens.reliableCreatureMaker) roles.push("production");
  if (tokens.untapSupport) roles.push("untap");
  if (tokens.teamHaste) roles.push("haste");
  const repeat =
    !/Instant|Sorcery/.test(
      card.card_faces?.[0]?.type_line || card.type_line || "",
    ) &&
    /whenever|at the beginning|\{T\}[^\n]*draw|\{\d+\}[^\n]*draw/i.test(text);
  if (
    !exchangesAllDrawnCards(text) &&
    ((/draw (?:two|three|four|five|six|seven|x|cards|a number|that many)/i.test(
      text,
    ) &&
      !(
        /discard|shuffle a card from your hand/i.test(text) &&
        !/draw (?:three|four|five|six|seven)/i.test(text)
      )) ||
      (/draw a card/i.test(text) &&
        ((repeat &&
          !sacrificesItself(card) &&
          (!singleDrawExchangesPermanent(card) || signal.permanentReplay)) ||
          (signal.permanentReplay && /enters|sacrifice/i.test(text)) ||
          ((signal.copyCreature || signal.blink) &&
            /Creature/.test(
              card.card_faces?.[0]?.type_line || card.type_line || "",
            ) &&
            usefulCopiedEntry(card)))) ||
      /exile the top (?:two|three)[^]*?(?:play|cast) (?:those|the exiled) cards/i.test(
        text,
      ))
  )
    roles.push("advantage");
  if (interactionProfile(card, context).present) roles.push("interaction");
  const damageSweep =
    /\b(?:deals?|deal) (x|[0-9]+|one|two|three|four|five|six|seven|eight|nine|ten) damage to each creature\b/i.exec(
      text,
    );
  const sweepDamage = damageSweep
    ? ({
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10,
      }[damageSweep[1].toLowerCase()] ?? Number(damageSweep[1]))
    : 0;
  if (
    (/(?:destroy|exile) all[^.\n]{0,45}(?:creatures|nonland permanents)/i.test(
      text,
    ) &&
      !/(?:destroy|exile) all[^.\n]{0,30}(?:creatures|permanents) you control|didn't attack|did not attack/i.test(
        text,
      )) ||
    (damageSweep && (damageSweep[1].toLowerCase() === "x" || sweepDamage >= 3))
  )
    roles.push("wipes");
  if (
    (/(?:gain|gains|have|has)[^.\n]{0,80}(?:hexproof|indestructible|protection from)/i.test(
      text,
    ) &&
      /(?:you control|target creature|target permanent)/i.test(text) &&
      !/target (?:creature|permanent)[^.\n]{0,30}opponent[^.\n]*controls/i.test(
        text,
      )) ||
    /target[^.\n]*(?:phases out|phase out)/i.test(text) ||
    /prevent all combat damage[^.\n]*attacking creatures you control|equipped creature[^.\n]{0,80}(?:has|gains)[^.\n]*(?:shroud|hexproof|indestructible)/i.test(
      text,
    )
  )
    roles.push("protection");
  if (
    /additional combat|you win the game|creatures you control[^.\n]*(?:get \+|have double strike)|whenever[^]*?(?:enters|dies)[^]*?(?:each opponent|each player)[^]*?(?:damage|loses)|whenever[^]*?(?:enters|dies)[^]*?damage to each opponent/i.test(
      text,
    )
  )
    roles.push("finisher");
  return roles.filter((role) => reliableRole(card, role, commander, context));
}
export function constructionTargets(commander: Card, intent?: BuildIntent) {
  const plan = normalizeBuildIntent(intent);
  if (plan.primary === "tokens")
    return {
      production: plan.tokenEngine === "lasting" ? 18 : 22,
      untap: plan.tokenEngine === "lasting" ? 5 : 0,
      haste: plan.combat === "large-hasty" ? 3 : 0,
      ramp: 8,
      advantage: plan.supplementalDraw === "reduced" ? 5 : 8,
      interaction: 7,
      wipes: 3,
      protection: 3,
      finisher: 5,
    };
  const s = commanderSignals([commander]);
  return {
    production: 0,
    untap: 0,
    haste: 0,
    ramp: 10,
    advantage: 10,
    interaction: s.typal.length ? 7 : 8,
    wipes: s.typal.length ? 2 : 3,
    protection: 3,
    finisher: 4,
  };
}
export const roleBudgetShares: Record<ConstructionRole, number> = {
  production: 0,
  untap: 0,
  haste: 0,
  ramp: 0.15,
  advantage: 0.18,
  interaction: 0.14,
  wipes: 0.08,
  protection: 0.07,
  finisher: 0.12,
  synergy: 0.26,
};
export function supportQuality(
  card: Card,
  role: ConstructionRole,
  commander: Card,
) {
  const text = constructionText(card),
    mv = card.cmc || 0,
    s = commanderSignals([commander]),
    creature = /Creature/.test(
      card.card_faces?.[0]?.type_line || card.type_line || "",
    );
  let score = 30 - Math.min(mv, 10) * 2;
  if (role === "production") score += tokenProductionProfile(card).score;
  if (role === "untap")
    score += tokenProductionProfile(card).recurringUntap ? 100 : 40;
  if (role === "haste")
    score += tokenProductionProfile(card).teamHaste ? 40 : -100;
  if (role === "ramp") {
    score += 20 - Math.min(mv, 8) * 5;
    if (
      /search your library[^]*?(?:land|Forest|Plains)[^]*?onto the battlefield/i.test(
        text,
      )
    )
      score += 25;
  }
  if (role === "finisher") {
    const profile = tokenProductionProfile(card);
    score +=
      Math.max(0, 18 - Math.log2(Math.max(1, card.edhrec_rank || 200000))) * 3;
    if (
      /creatures you control[^.\n]*(?:\+[3-9]\/\+[3-9]|\+X\/\+X|double strike)/i.test(
        text,
      )
    )
      score += 65;
    if (profile.teamPump && /trample/i.test(text)) score += 25;
    if (/equipped creatures|artifact creatures/i.test(text)) score -= 25;
  }
  if (role === "advantage") {
    if (/whenever|at the beginning/i.test(text)) score += 16;
    if (/draw (?:two|three|four|five|six|seven)/i.test(text)) score += 12;
  }
  if (role === "interaction") {
    if (/exile target|counter target spell|nonland permanent/i.test(text))
      score += 12;
    if (/artifact.*enchantment|creature.*planeswalker/i.test(text)) score += 8;
  }
  if (["interaction", "protection", "wipes"].includes(role) && !creature)
    score += 14;
  if (
    s.permanentReplay &&
    /Creature|Artifact|Enchantment/.test(card.type_line || "")
  )
    score += 12;
  score -= deploymentPenalty(card, role, [commander]);
  const confidence = roleConfidence(card, [commander]);
  if (role === "advantage" && confidence.delayedDeath) score -= 8;
  if (/activate only/i.test(text)) score -= 5;
  return score;
}
