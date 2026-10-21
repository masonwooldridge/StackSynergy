import { deploymentCost } from "./deploymentCost";
export const STRATEGIC_QUALITY_VERSION = "2026-10-21.6";
import type { Card } from "./model";
import { frontText } from "./cardFunction";
import { manaProfile } from "./mtgCardFunctions";

/** Transparent ranking heuristics, not a power rating or a rules simulation. */
export function strategicProfile(
  card: Card,
  commander: Card,
  bracket = 3,
  explicitManaValue = false,
  context: Card[] = [],
) {
  const text = frontText(card),
    cmd = frontText(commander),
    type = card.card_faces?.[0]?.type_line || card.type_line || "";
  const mv = card.cmc ?? 0,
    equipment = /Equipment/.test(type);
  const manaCost = (cost: string) =>
    [...cost.matchAll(/\{([^}]+)\}/g)].reduce(
      (n, m) =>
        n +
        (/^\d+$/.test(m[1])
          ? Number(m[1])
          : /^[WUBRGC](?:\/[WUBRGC])?$/.test(m[1])
            ? 1
            : 0),
      0,
    );
  const equip = equipment
    ? [...text.matchAll(/(?:^|\n)Equip ((?:\{[^}]+\})+)/gi)].map((m) =>
        manaCost(m[1]),
      )
    : [];
  const equipCost = equip.length ? Math.min(...equip) : null;
  const activated = [...text.matchAll(/^([^:\n]+):\s*([^\n]+)/gm)].filter(
    (m) => !/^Add /i.test(m[2]),
  );
  const activationCosts = activated.map((m) => manaCost(m[1]));
  const activationCost = activationCosts.length
    ? Math.min(...activationCosts)
    : 0;
  const reusableTap =
    /Creature/.test(type) && activated.some((m) => /\{T\}/.test(m[1]));
  const attackTrigger =
    /whenever[^.\n]*attacks|whenever[^.\n]*attack,|exert[^.\n]*as (?:it|this creature) attacks/i.test(
      text,
    );
  const combatDamageTrigger = /whenever[^.\n]*deals combat damage/i.test(text);
  const targetCopy =
    /copy[^.\n]*target[^.\n]*creature|target[^.\n]*creature[^.\n]*copy/i.test(
      cmd,
    );
  const copyPlan = /copy/i.test(cmd) && /creature/i.test(cmd);
  const entersAttacking =
    /(?:tapped and attacking|enters[^.\n]*attacking)/i.test(cmd);
  const singleEntryDraw =
    /Creature/.test(type) &&
    /when[^.\n]*enters[^.\n]*draw a card/i.test(text) &&
    !/draw (?:two|three|four)|whenever|additional combat|double strike/i.test(
      text,
    );
  const symmetricExposure =
    /(?:creatures|all creatures) (?:can't|cannot) block\b/i.test(text) &&
    !/opponents control|your opponents/i.test(text);
  const combatProtection =
    /prevent all combat damage[^.\n]*attacking creatures you control/i.test(
      text,
    );
  const payments = deploymentCost(card, undefined, context);
  const notes: string[] = [...payments.notes];
  let adjustment = 0;
  if (reusableTap && !/\bhaste\b/i.test(text))
    notes.push(
      "Creature tap abilities usually wait until a later turn unless haste is supplied.",
    );
  if (attackTrigger && entersAttacking && copyPlan) {
    adjustment -= 6;
    notes.push(
      "Entering attacking does not trigger this creature’s own attack trigger; later declared attacks need appropriate untap/haste support.",
    );
  }
  if (combatDamageTrigger)
    notes.push(
      "Combat-damage value requires connecting; a token entering attacking can still deal combat damage.",
    );
  if (targetCopy && /\bshroud\b/i.test(text)) {
    adjustment -= 12;
    notes.push(
      "Shroud on the intended copy target prevents the commander targeting it.",
    );
  }
  if (bracket >= 4 && singleEntryDraw && mv >= 3) {
    adjustment -= 18;
    notes.push(
      "A single-card entry cantrip is lower-impact support for this faster target despite thematic synergy.",
    );
  }
  if (symmetricExposure) {
    adjustment -= bracket >= 4 ? 16 : 8;
    notes.push(
      "Symmetrical inability to block also exposes your board; review the specific lethal plan.",
    );
  }
  if (combatProtection && /attacks|combat damage/i.test(cmd)) {
    adjustment += 12;
    notes.push(
      "Protects attacking creatures from combat damage without equipping each attacker; does not stop removal.",
    );
  }
  const ramp = manaProfile(card);
  if (bracket >= 4 && ramp.reliableAcceleration && !explicitManaValue) {
    if (mv <= 2 && !ramp.entersTapped) {
      adjustment += 6;
      notes.push(
        "Early untapped acceleration can precede the commander; colors and activation still matter.",
      );
    } else if (mv >= 3) {
      adjustment -= Math.min(12, (mv - 2) * 4);
      notes.push(
        "Slower ramp competes with the early deployment sequence; this is not a turn-by-turn simulation.",
      );
    }
  }
  return {
    adjustment,
    castMana: mv,
    firstEquipMana: equipCost,
    firstDeploymentMana: equipment ? mv + payments.equipMana : mv,
    activationMana: activationCost,
    attackTrigger,
    combatDamageTrigger,
    singleEntryDraw,
    symmetricExposure,
    combatProtection,
    deployment: payments,
    notes: [...new Set(notes)],
  };
}

/** One ramp card, one untapped land each turn, no opponents; colors/hand availability assumed. */
export function rampSequence(card: Card, targetMana: number) {
  const profile = manaProfile(card),
    mv = card.cmc;
  if (
    !profile.reliableAcceleration ||
    profile.conditionalMana ||
    mv === undefined ||
    mv < 1
  )
    return null;
  const ability = profile.abilities
    .filter((a) => a.net !== null && !a.selfSacrifice && !a.conditional)
    .sort((a, b) => (b.net || 0) - (a.net || 0))[0];
  if (!ability || ability.output === null) return null;
  const creature = /Creature/.test(
    card.card_faces?.[0]?.type_line || card.type_line || "",
  );
  const delayed =
    profile.entersTapped || (creature && !/\bhaste\b/i.test(frontText(card)));
  let rampTurn: number | null = null;
  for (let turn = 1; turn <= 8; turn++) {
    const canUse = turn > mv || (turn === mv && !delayed);
    const remaining = turn - (turn === mv ? mv : 0);
    const mana =
      turn < mv
        ? turn
        : remaining +
          (canUse && remaining >= ability.manaCost
            ? ability.output - ability.manaCost
            : 0);
    if (mana >= targetMana) {
      rampTurn = turn;
      break;
    }
  }
  return {
    baselineTurn: Math.ceil(targetMana),
    rampTurn,
    assumptions:
      "One ramp card available, one untapped land per turn, sufficient colors, no interaction; not a goldfish or win-rate simulation.",
  };
}
