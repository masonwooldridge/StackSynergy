import { manaAvailability } from "./mtgCardFunctions";
import { interactionProfile } from "./interactionProfile";
import type { Card } from "./model";
import { frontText } from "./cardFunction";
import { frontFaceType } from "./landAllocation";
import { tokenProductionProfile } from "./tokenPlan";
const quantities: Record<string, number> = {
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
  twelve: 12,
};
/** Availability and timing evidence, never a rules simulation or a chosen X payment. */
export function roleConfidence(card: Card, context: Card[] = []) {
  const text = frontText(card),
    notes: string[] = [];
  const answers = interactionProfile(card, context);
  const { variableCounter, restrictedCounter, fixedTax } = answers;
  notes.push(...answers.notes, ...manaAvailability(card, context).notes);
  const opponentLand =
    /players who control[^.\n]*more lands than you|opponent[^.\n]*(?:more lands than you|lands than you)|player controls more lands than you/i.test(
      text,
    );
  if (opponentLand)
    notes.push(
      "Opponent-dependent land catch-up: requires another player to be ahead on lands. Not unconditional acceleration and does not fill the primary ramp quota; a land-sacrifice or low-land plan may still use it.",
    );
  const matches = [
    ...text.matchAll(
      /(?:has|have|with) (\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve) or more ([a-z]+) counters/gi,
    ),
  ];
  const deathThreshold = matches.find((m) => {
    const start = text.lastIndexOf("\n", m.index) + 1;
    const end = text.indexOf("\n", m.index);
    const line = text.slice(start, end < 0 ? undefined : end);
    return (
      /whenever[^.\n]*creature[^.\n]*you control dies/i.test(text) &&
      /draw[^.\n]*if|if[^.\n]*draw/i.test(line)
    );
  });
  const unique = [
    ...new Map(
      context
        .filter((c) => (c.oracle_id || c.id) !== (card.oracle_id || card.id))
        .map((c) => [c.oracle_id || c.id, c]),
    ).values(),
  ];
  const bodies = unique.filter(
    (c) =>
      /Creature/.test(frontFaceType(c)) ||
      tokenProductionProfile(c).ownCreature,
  ).length;
  const outlets = unique.filter(
    (c) =>
      /^[^:\n]*sacrifice (?:a|an|another) creature[^:\n]*:/im.test(
        frontText(c),
      ) && !/sacrifice (?:this|~)/i.test(frontText(c)),
  ).length;
  const supportedDeath = !!deathThreshold && bodies >= 6 && outlets > 0;
  const independentBurst =
    /when[^.\n]*enters[^.\n]*draw (?:two|three|four|five|six|seven) cards/i.test(
      text,
    );
  if (deathThreshold) {
    const threshold =
      Number(deathThreshold[1]) || quantities[deathThreshold[1].toLowerCase()];
    notes.push(
      `Delayed death engine: the draw condition needs ${threshold} ${deathThreshold[2]} counters. ${bodies} distinct creature/token sources and ${outlets} sacrifice outlets are selected. ${supportedDeath ? "Own-deck support exists, but events, deaths and time to the threshold are not guaranteed." : "Reliable draw is not established; scrying or other setup value is not card draw."} Density is a conservative support check, not a turn estimate.`,
    );
  } else if (matches.length)
    notes.push(
      "Counter-threshold payoff: requires accumulated counters before its full benefit. Selected cards and printed mana value do not establish the turn when it becomes active.",
    );
  return {
    variableCounter,
    restrictedCounter,
    fixedTax,
    opponentLand,
    delayedDeath: !!deathThreshold,
    drawThreshold: deathThreshold
      ? Number(deathThreshold[1]) || quantities[deathThreshold[1].toLowerCase()]
      : null,
    supportedDeath,
    bodies,
    outlets,
    independentBurst,
    notes,
  };
}
export function dependableRole(card: Card, role: string, context: Card[] = []) {
  const p = roleConfidence(card, context);
  return !(
    (role === "interaction" && !interactionProfile(card, context).primary) ||
    (role === "ramp" && p.opponentLand) ||
    (role === "advantage" &&
      p.delayedDeath &&
      !p.supportedDeath &&
      !p.independentBurst)
  );
}
