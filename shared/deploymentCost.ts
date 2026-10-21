import { interactionProfile } from "./interactionProfile";
import { roleConfidence } from "./roleConfidence";
import type { Card } from "./model";
import { frontText, energyFunction } from "./cardFunction";
import { frontFaceType } from "./landAllocation";
const roleEffects: Record<string, RegExp> = {
  interaction: /destroy target|exile target|counter target|return target/i,
  wipes: /destroy all|exile all|damage to each creature/i,
  protection: /hexproof|indestructible|protection from|phase out|phases out/i,
  ramp: /search your library|add\b|additional land/i,
  advantage: /draw|exile the top/i,
  production: /create[^.\n]*token/i,
  untap: /untap/i,
  haste: /haste/i,
  finisher:
    /creatures you control[^.\n]*(?:get|double strike)|additional combat/i,
};
/** Printed mana symbols only; life, cards, sacrifices, energy and taps receive no invented mana price. */
export function manaPayment(cost: string) {
  let mana = 0,
    variable = false,
    energy = 0;
  for (const m of cost.matchAll(/\{([^}]+)\}/g)) {
    const s = m[1];
    if (/^\d+$/.test(s)) mana += Number(s);
    else if (/^[WUBRGCS](?:\/[WUBRG])?$/.test(s)) mana++;
    else if (/^2\/[WUBRG]$/.test(s)) mana += 2;
    else if (s === "E") energy++;
    else if (/^[XYZ]$|\/P/.test(s)) variable = true;
  }
  return { mana, variable, energy };
}
export function deploymentCost(
  card: Card,
  role?: string,
  context: Card[] = [],
) {
  const text = frontText(card),
    notes: string[] = [...roleConfidence(card, context).notes],
    relevant = role ? roleEffects[role] : undefined;
  const modes = [
    ...text.matchAll(/^\+\s*((?:\{[^}]+\})+)\s*[—–-]\s*([^\n]+)/gm),
  ].map((m) => ({ cost: m[1], effect: m[2], ...manaPayment(m[1]) }));
  const roleModes = modes.filter((m) => !relevant || relevant.test(m.effect));
  const additionalMana =
    /\bSpree\b/i.test(text) && roleModes.length
      ? Math.min(...roleModes.map((m) => m.mana))
      : 0;
  if (modes.length)
    notes.push(
      "Additional spell modes cost " +
        modes.map((m) => m.cost).join(", ") +
        ". " +
        (role && roleModes.length
          ? `The ${role} mode adds at least ${additionalMana} mana to the printed cost.`
          : "Choose and pay the relevant mode; these payments do not change printed mana value."),
    );
  const abilities = [...text.matchAll(/^([^:\n]+):\s*([^\n]+)/gm)].map((m) => ({
    cost: m[1],
    effect: m[2],
    ...manaPayment(m[1]),
  }));
  const relevantAbilities = abilities.filter((a) =>
    relevant ? relevant.test(a.effect) : !/^Add\b/i.test(a.effect),
  );
  const primaryAnswers =
    role === "interaction"
      ? interactionProfile(card, context).effects.filter((e) => e.primary)
      : [];
  const answerPayments = primaryAnswers
    .filter((e) => e.activationCost)
    .map((e) => manaPayment(e.activationCost!).mana);
  const activationMana =
    role === "interaction"
      ? primaryAnswers.some((e) => !e.activationCost) || !answerPayments.length
        ? 0
        : Math.min(...answerPayments)
      : relevantAbilities.length
        ? Math.min(...relevantAbilities.map((a) => a.mana))
        : 0;
  const equipment = /Equipment/.test(frontFaceType(card));
  const equips = equipment
    ? [...text.matchAll(/(?:^|\n)Equip(?: [A-Za-z]+)? ((?:\{[^}]+\})+)/g)].map(
        (m) => ({ cost: m[1], ...manaPayment(m[1]) }),
      )
    : [];
  const automaticAttach =
    equipment &&
    /when[^.\n]*enters[^.\n]*attach/i.test(text) &&
    !/when[^.\n]*enters[^.\n]*(?:pay|if)/i.test(text);
  const equipMana =
    equips.length && !automaticAttach
      ? Math.min(...equips.map((m) => m.mana))
      : 0;
  if (equips.length)
    notes.push(
      automaticAttach
        ? "Entry attachment can supply the first benefit; a valid creature target is still required. Later equip costs " +
            equips.map((e) => e.cost).join(" or ") +
            "."
        : `Separate equip setup costs ${equips.map((e) => e.cost).join(" or ")}; casting alone does not equip it.`,
    );
  if (relevantAbilities.length && activationMana > 0)
    notes.push(
      role
        ? `The ${role} activation needs at least ${activationMana} additional mana; tapping, timing and other requirements remain separate.`
        : `One available non-mana activation starts at ${activationMana} mana; different abilities and targets can require different payments. Tapping, timing and other requirements remain separate.`,
    );
  const upkeep = [
    ...text.matchAll(
      /(?:At the beginning of[^\n]*?(?:upkeep|main phase)[^\n]*?(?:pay|unless you pay)\s*((?:\{[^}]+\})+)|Cumulative upkeep\s*((?:\{[^}]+\})+))/gi,
    ),
  ].map((m) => ({
    cost: m[1] || m[2],
    ...manaPayment(m[1] || m[2]),
    next: /your next upkeep/i.test(m[0]),
    cumulative: !!m[2],
  }));
  const delayedMana = upkeep
      .filter((p) => p.next)
      .reduce((n, p) => n + p.mana, 0),
    recurringMana = upkeep
      .filter((p) => !p.next)
      .reduce((n, p) => n + p.mana, 0),
    lossRisk =
      upkeep.length > 0 &&
      /if you (?:don't|do not)[^.\n]*lose the game/i.test(text);
  if (delayedMana)
    notes.unshift(
      `Next-upkeep payment is ${upkeep
        .filter((p) => p.next)
        .map((p) => p.cost)
        .join(
          " + ",
        )}.${lossRisk ? " Failure loses the game." : ""} It is deferred, not free mana.`,
    );
  if (recurringMana)
    notes.push(
      `Maintenance starts at ${upkeep
        .filter((p) => !p.next)
        .map((p) => p.cost)
        .join(
          " + ",
        )}${upkeep.some((p) => p.cumulative) ? " and increases with cumulative upkeep" : ""}; future payments are not part of printed mana value.`,
    );
  if (upkeep.some((p) => p.energy)) {
    const supplied = (
      text.match(/you get ((?:\{E\})+)/i)?.[1].match(/\{E\}/g) || []
    ).length;
    const repeat = context.filter(
      (c) =>
        (c.oracle_id || c.id) !== (card.oracle_id || card.id) &&
        energyFunction(c).repeatableProducer,
    ).length;
    notes.push(
      `Energy maintenance is ${upkeep
        .filter((p) => p.energy)
        .map((p) => p.cost)
        .join(
          " + ",
        )}. This card supplies ${supplied} initial energy; ${repeat} other repeatable energy sources are selected. Duration is conditional; energy is not priced as mana.`,
    );
  }
  const nonMana = [
    ...new Set(
      text.match(
        /sacrifice (?:a|an|another) (?:creature|artifact|permanent)|discard (?:a|another) card|exile (?:a|another) [^.\n]{0,30}card from your hand|pay \d+ life|lose \d+ life/gi,
      ) || [],
    ),
  ];
  if (nonMana.length)
    notes.push(
      "Resource conditions: " +
        nonMana.join("; ") +
        ". No mana-equivalent price is assigned; tokens, recursion and other synergies may support them.",
    );
  const alternative =
    interactionProfile(card, context).alternativeCosts.length > 0 ||
    /rather than pay (?:this spell's|the) mana cost|without paying (?:its|their|the) mana cost|\bconvoke\b|\bdelve\b|\baffinity\b/i.test(
      text,
    );
  if (alternative)
    notes.push(
      "Alternative payment or cost reduction is available, subject to its actual resources/permission. No free route or resource conversion is assumed.",
    );
  if (/\{X\}/.test(card.mana_cost || ""))
    notes.push(
      "X is additional chosen investment; printed mana value and a small printed fixed portion do not establish a cheap full effect.",
    );
  const setupCreatures = context.filter((c) =>
    /Creature/.test(frontFaceType(c)),
  ).length;
  const confidence =
    lossRisk || upkeep.length
      ? "maintenance-dependent"
      : nonMana.length || alternative || equipment
        ? "setup-dependent"
        : "direct";
  return {
    printedManaValue: card.cmc ?? null,
    additionalMana,
    activationMana,
    equipMana,
    automaticAttach,
    delayedMana,
    recurringMana,
    lossRisk,
    upkeep,
    nonMana,
    alternative,
    setupCreatures,
    confidence,
    notes,
  };
}
export function deploymentPenalty(
  card: Card,
  role: string,
  context: Card[] = [],
) {
  const p = deploymentCost(card, role, context);
  return (
    Math.min(
      24,
      p.additionalMana * 3 + p.activationMana * 4 + p.equipMana * 2,
    ) + Math.min(14, p.delayedMana * 2 + p.recurringMana)
  );
}
