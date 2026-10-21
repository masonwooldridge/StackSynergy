import { cardTradeoffs } from "./cardTradeoffs";
import type { Card } from "./model";
import { frontText } from "./cardFunction";
import { frontFaceType } from "./landAllocation";
import { tokenProductionProfile } from "./tokenPlan";
export type AnswerKind = "counter" | "bounce" | "exile" | "destroy" | "shuffle";
export type AnswerFact = {
  kind: AnswerKind;
  target: string;
  breadth: "general" | "type-limited" | "value-limited" | "conditional";
  duration:
    | "stack-answer"
    | "hand"
    | "exile"
    | "temporary-exile"
    | "linked-exile"
    | "blink"
    | "graveyard"
    | "library";
  route: "spell" | "activated" | "granted" | "triggered";
  primary: boolean;
  additionalModeCost?: string;
  alternativeCost?: string;
  activationCost?: string;
  limitations: string[];
};
/** Bounded Oracle-text capabilities shared by construction, analytics and grounded discussion. */
export function interactionProfile(card: Card, context: Card[] = []) {
  const text = frontText(card).replace(/\([^()]*\)/g, ""),
    effects: AnswerFact[] = [],
    notes: string[] = [];
  const variableCounter =
    /counter target[^.\n]*spell[^.\n]*(?:pays? \{X\}|mana value (?:(?:equal to|of) )?X)/i.test(
      text,
    );
  const restrictedCounter =
    /counter target spell that targets (?:(?:a|an|one or more) (?:creatures?|players?|permanents?|artifacts?|enchantments?)|you)/i.test(
      text,
    );
  const fixedTax =
    /counter target[^.\n]*spell unless[^.\n]*pays? \{[1-9]/i.test(text);
  const cleave = /\bCleave\s*((?:\{[^}]+\})+)/i.exec(text)?.[1];
  const bodies = [
    ...new Map(context.map((c) => [c.oracle_id || c.id, c])).values(),
  ].filter(
    (c) =>
      /Creature/.test(frontFaceType(c)) ||
      tokenProductionProfile(c).ownCreature,
  ).length;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const modeCost = /^\+\s*((?:\{[^}]+\})+)\s*[—–-]/.exec(line)?.[1];
    const variants = [
      { line, alternativeCost: undefined as string | undefined },
    ];
    if (cleave && /\[[^\]]+\]/.test(line))
      variants.push({
        line: line.replace(/\[[^\]]+\]/g, ""),
        alternativeCost: cleave,
      });
    for (const variant of variants) {
      const clause = variant.line;
      const matches = [
        ...clause.matchAll(
          /\b(counter target[^.\n]{0,90}?(?:spell|ability)|return target[^.\n]*?to (?:its|their|that permanent's) owner's hand|(?:destroy|exile) target[^.\n]*?(?:creature|artifact|enchantment|permanent)(?: card)?|owner of target (?:nonland )?permanent shuffles it into their library)/gi,
        ),
      ];
      for (const m of matches) {
        const kind: AnswerKind = /^counter/i.test(m[0])
          ? "counter"
          : /^return/i.test(m[0])
            ? "bounce"
            : /^exile/i.test(m[0])
              ? "exile"
              : /^destroy/i.test(m[0])
                ? "destroy"
                : "shuffle";
        const prefix = clause.slice(0, m.index),
          granted = /\b(?:gains?|has|have)\s*["“]?[^\n]*:/i.test(prefix),
          activated = !granted && prefix.includes(":"),
          triggered = /^(?:When|Whenever|At the beginning)/i.test(clause);
        const route: AnswerFact["route"] = granted
          ? "granted"
          : activated
            ? "activated"
            : triggered
              ? "triggered"
              : "spell";
        const limitations: string[] = [];
        const timed =
          kind === "exile" &&
          /time counters?|gains suspend|\bsuspend\b/i.test(clause);
        const linked =
          kind === "exile" &&
          (/until[^.\n]*leaves the battlefield/i.test(clause) ||
            /return (?:all )?(?:cards|permanents|creatures) exiled with (?:it|this)/i.test(
              text,
            ));
        const blink =
          kind === "exile" &&
          !timed &&
          !linked &&
          /(?:then |and |, )return (?:it|that card|the exiled card)[^.\n]*battlefield|return the exiled card to the battlefield/i.test(
            clause,
          );
        const duration: AnswerFact["duration"] =
          kind === "counter"
            ? "stack-answer"
            : kind === "bounce"
              ? "hand"
              : kind === "destroy"
                ? "graveyard"
                : kind === "shuffle"
                  ? "library"
                  : timed
                    ? "temporary-exile"
                    : linked
                      ? "linked-exile"
                      : blink
                        ? "blink"
                        : "exile";
        const targetText = clause.slice(m.index).split(/[.\n]/)[0];
        const valueLimited = /mana value|\bpower\b|\btoughness\b/i.test(
          targetText,
        );
        const conditional =
          /\b(?:if|unless|that targets|wasn.t cast|attacking|blocking|tapped|untapped|flying|same name|kicked|combat damage)\b/i.test(
            targetText,
          );
        const typeLimited =
          /target (?:noncreature|creature|artifact|enchantment|nonland)/i.test(
            m[0],
          );
        let breadth: AnswerFact["breadth"] = valueLimited
          ? "value-limited"
          : conditional
            ? "conditional"
            : typeLimited
              ? "type-limited"
              : "general";
        const unsupported =
          /counter target spell if it was kicked|counter target[^.\n]*same name|target[^.\n]*you own|target (?:attacking|blocking) creature|target creature that(?:'s| is) attacking|target creature that (?:blocked|was blocked|attacked|dealt|has dealt)|target creature (?:with|without) flying|target creature[^.\n]*power[^.\n]*life total|target nonland permanent with the lowest mana value|blocked or was blocked|flip a coin|roll a (?:d\d+|six-sided|twenty-sided)|each player votes/i.test(
            clause,
          );
        const graveyard =
          /target (?:artifact|creature|permanent) card (?:from|in)[^.\n]*graveyard/i.test(
            clause,
          );
        const ownBounce =
          ["bounce", "exile", "destroy"].includes(kind) &&
          /target[^.\n]*\byou control/i.test(clause);
        const colorRestricted =
          /target (?:white|blue|black|red|green|colorless) (?:creature|artifact|enchantment|permanent)|target[^.\n]*(?:that(?:'s| is)|is) (?:white|blue|black|red|green)/i.test(
            clause,
          );
        const variable =
          kind === "counter" &&
          /pays? \{X\}|mana value (?:(?:equal to|of) )?X/i.test(clause);
        const restricted = kind === "counter" && /that targets/i.test(clause);
        if (
          colorRestricted ||
          restricted ||
          ownBounce ||
          graveyard ||
          unsupported
        )
          breadth = "conditional";
        if (colorRestricted)
          limitations.push(
            "Target is restricted by color; this does not provide broad primary coverage against other targets.",
          );
        if (ownBounce)
          limitations.push(
            "Targets your own permanent: protection/recursion utility, not opposing-board removal.",
          );
        if (graveyard)
          limitations.push(
            "Targets a graveyard card rather than an existing battlefield permanent.",
          );
        if (unsupported && !colorRestricted && !ownBounce)
          limitations.push(
            "Additional target/event restriction prevents broad primary coverage; read the exact eligible target and timing.",
          );
        const primary =
          !granted &&
          !blink &&
          !graveyard &&
          !ownBounce &&
          !unsupported &&
          !colorRestricted &&
          !variable &&
          !restricted &&
          !/whenever[^.\n]*deals?[^.\n]*combat damage/i.test(clause);
        if (kind === "bounce")
          limitations.push(
            "Bounce returns the eligible target to hand; it is tempo, not permanent removal.",
          );
        if (timed)
          limitations.push(
            "Temporary exile with time counters/suspend; the exiled card may be cast later under its permission. It is not permanent exile.",
          );
        if (linked)
          limitations.push(
            "Exile has a linked return condition or ability; read its exact trigger and do not assume it is permanent.",
          );
        if (blink)
          limitations.push(
            "Blink returns the exiled permanent; do not count it as lasting removal.",
          );
        if (kind === "counter")
          limitations.push(
            "Countering answers an eligible spell/ability on the stack, not a permanent already on the battlefield.",
          );
        if (valueLimited)
          limitations.push(
            "Apply the exact mana-value/power/toughness restriction; a narrow efficient answer is not universal coverage.",
          );
        if (/\{X\}|\bX\b/.test(clause) && /\{X\}/.test(card.mana_cost || ""))
          limitations.push(
            "The chosen X payment depends on the target/effect; printed mana value does not establish full payment.",
          );
        if (granted)
          limitations.push(
            `Grants an activated ability, rather than performing the answer immediately. ${bodies} distinct creature/token sources are selected; a legal untapped recipient and tap/summoning-sickness timing still matter. It does not fill the primary interaction quota.`,
          );
        else if (activated)
          limitations.push(
            `Requires activation payment ${prefix.slice(0, prefix.lastIndexOf(":")).trim()} and its timing; casting the permanent alone does not perform this answer.`,
          );
        if (cleave && !variant.alternativeCost && /\[/.test(clause))
          limitations.push(
            "Normal-cost mode retains the bracketed target restriction.",
          );
        if (variant.alternativeCost)
          limitations.push(
            `Broader cleave mode replaces the normal casting cost with ${variant.alternativeCost} and removes bracketed text; printed mana value is unchanged.`,
          );
        if (modeCost)
          limitations.push(
            `This mode requires additional payment ${modeCost}; selecting another mode does not provide this answer.`,
          );
        effects.push({
          kind,
          target: targetText,
          breadth,
          duration,
          route,
          primary,
          additionalModeCost: modeCost,
          alternativeCost: variant.alternativeCost,
          activationCost: activated
            ? prefix.slice(0, prefix.lastIndexOf(":")).trim()
            : undefined,
          limitations,
        });
      }
    }
  }
  if (variableCounter)
    notes.push(
      "Variable-payment counter: no X payment or opponent mana is assumed; it does not fill the primary interaction quota.",
    );
  if (restrictedCounter)
    notes.push(
      "Target-dependent counter: situational protection rather than broad primary interaction.",
    );
  if (fixedTax)
    notes.push(
      "Tax counter: useful early interaction, but an opponent with sufficient mana may pay.",
    );
  for (const e of effects.filter((e) => e.limitations.length)) {
    notes.push(`${e.kind}: ${e.target}. ${e.limitations.join(" ")}`);
  }
  const tradeoffs = cardTradeoffs(card);
  notes.push(...tradeoffs.map((t) => t.note));
  return {
    tradeoffs,
    alternativeCosts: cleave ? [{ kind: "cleave", cost: cleave }] : [],
    present: effects.length > 0,
    primary: effects.some((e) => e.primary),
    effects,
    variableCounter,
    restrictedCounter,
    fixedTax,
    notes: [...new Set(notes)],
  };
}
