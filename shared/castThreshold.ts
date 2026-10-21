import type { Card } from "./model";
import { frontText, selfEntryTrigger } from "./cardFunction";
export const MIN_ENGINE_SOURCES = 6;
type CastMode = {
  value: number | null;
  variables: number;
  normalCost: boolean;
  alternate: boolean;
  faceIndex: number;
  fused?: boolean;
};
const numbers: Record<string, number> = {
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
};
function costValue(cost: string | undefined, fallback?: number) {
  if (cost === undefined)
    return { value: fallback ?? null, variables: 0, normalCost: false };
  let value = 0,
    variables = 0;
  for (const m of cost.matchAll(/\{([^}]+)\}/g)) {
    const symbol = m[1];
    if (/^[XYZ]$/.test(symbol)) {
      variables++;
      continue;
    }
    if (/^\d+$/.test(symbol)) value += Number(symbol);
    else if (/^[WUBRGCS](?:\/[WUBRGP])?$/.test(symbol)) value++;
    else if (/^2\/[WUBRG]$/.test(symbol)) value += 2;
    else return { value: null, variables, normalCost: cost !== "" };
  }
  return { value, variables, normalCost: cost !== "" };
}
/** Normal face choices only. Does not model permission-changing effects, recursion or payment probability. */
export function castModes(card: Card): CastMode[] {
  const faces = card.card_faces,
    alternate = ["adventure", "modal_dfc", "split"].includes(card.layout || "");
  const sources = faces?.length
    ? alternate
      ? faces
      : faces.slice(0, 1)
    : card.layout === "split" && card.mana_cost?.includes(" // ")
      ? card.mana_cost.split(" // ").map((mana_cost, i) => ({
          mana_cost,
          type_line: card.type_line?.split(" // ")[i],
        }))
      : [{ mana_cost: card.mana_cost, type_line: card.type_line }];
  const modes: CastMode[] = sources.flatMap((face, i) =>
    /\bLand\b/.test(face.type_line || "")
      ? []
      : [
          {
            ...costValue(
              face.mana_cost ?? (i === 0 ? card.mana_cost : undefined),
              i === 0 && card.layout !== "split" ? card.cmc : undefined,
            ),
            alternate: i > 0 || card.layout === "modal_dfc",
            faceIndex: i,
          },
        ],
  );
  if (
    card.layout === "split" &&
    /\bFuse\b/i.test(
      [card.oracle_text, ...(faces || []).map((f) => f.oracle_text)].join(" "),
    ) &&
    modes.length === 2 &&
    modes.every((m) => m.value !== null)
  )
    modes.push({
      value: modes.reduce((n, m) => n + (m.value || 0), 0),
      variables: modes.reduce((n, m) => n + m.variables, 0),
      normalCost: false,
      alternate: true,
      fused: true,
      faceIndex: -1,
    });
  return modes;
}
export function castThreshold(card: Card) {
  const text = frontText(card);
  const match =
    /whenever you cast (?:an? |your (?:first|second) )?([^,.\n]{0,60}?)spells? with (?:mana value|converted mana cost) (\d+|one|two|three|four|five|six|seven|eight|nine|ten)(?: or (greater|more|less|fewer))?[^.\n]*draw (?:a|two|three|four|cards)/i.exec(
      text,
    );
  if (!match) return null;
  const threshold = numbers[match[2].toLowerCase()] ?? Number(match[2]),
    relation = match[3]
      ? /less|fewer/i.test(match[3])
        ? "max"
        : "min"
      : "exact";
  const qualifier = match[1].trim().toLowerCase();
  return { threshold, relation, qualifier };
}
export function castThresholdProfile(card: Card, context: Card[] = []) {
  const trigger = castThreshold(card);
  if (!trigger) return null;
  const match = (value: number) =>
    trigger.relation === "min"
      ? value >= trigger.threshold
      : trigger.relation === "max"
        ? value <= trigger.threshold
        : value === trigger.threshold;
  let eligible = 0,
    conditional = 0,
    alternate = 0,
    unknown = 0;
  const qualifierUnderstood = !trigger.qualifier
    .replace(
      /\b(?:noncreature|nonland|artifact|creature|enchantment|instant|sorcery|legendary|historic|another|or|and)\b/g,
      "",
    )
    .trim();
  const key = card.oracle_id || card.id;
  for (const other of new Map(
    context
      .filter((c) => (c.oracle_id || c.id) !== key)
      .map((c) => [c.oracle_id || c.id, c]),
  ).values()) {
    const type = other.card_faces?.[0]?.type_line || other.type_line || "";
    const types =
      trigger.qualifier.match(
        /\b(?:noncreature|artifact|creature|enchantment|instant|sorcery|legendary|historic)\b/g,
      ) || [];
    const qualifiesType = (index: number) => {
      const faceType = other.card_faces?.[index]?.type_line || type;
      if (!qualifierUnderstood) return false;
      return (
        !types.length ||
        (trigger.qualifier.includes(" or ")
          ? types.some.bind(types)
          : types.every.bind(types))((t) =>
          t === "historic"
            ? /Artifact|Legendary|Saga/.test(faceType)
            : t === "noncreature"
              ? !/Creature/.test(faceType)
              : new RegExp("\\b" + t + "\\b", "i").test(faceType),
        )
      );
    };
    let reliable = false,
      potential = false,
      hasAlternate = false,
      missing = false;
    // The index remains the printed face index even when a land face is excluded.
    const modes = castModes(other);
    for (const mode of modes) {
      const index = mode.faceIndex;
      if (!qualifiesType(index)) continue;
      if (mode.value === null) {
        missing = true;
        continue;
      }
      const variableMatches =
        mode.variables > 0 &&
        (trigger.relation === "min" || mode.value <= trigger.threshold);
      const fixedMatch =
        match(mode.value) &&
        mode.normalCost &&
        (!mode.variables || trigger.relation === "min");
      if (fixedMatch) {
        reliable = true;
        hasAlternate ||= mode.alternate;
      } else if (match(mode.value) || variableMatches) potential = true;
    }
    if (reliable) {
      eligible++;
      if (hasAlternate) alternate++;
    } else if (potential) conditional++;
    else if (missing) unknown++;
  }
  const entry = selfEntryTrigger(card) || "";
  const entryBurst =
    /draw (?:two|three|four|five) cards/i.test(entry) &&
    !/\bif\b|unless|pay|discard|sacrifice/i.test(entry);
  const entryCantrip =
    /draw a card/i.test(entry) &&
    !/\bif\b|unless|pay|discard|sacrifice/i.test(entry);
  return {
    ...trigger,
    eligible,
    conditional,
    alternate,
    unknown,
    entryCantrip,
    entryBurst,
    qualifierUnderstood,
    supported: qualifierUnderstood && eligible >= MIN_ENGINE_SOURCES,
  };
}
export function thresholdSupportNote(card: Card, context: Card[]) {
  const p = castThresholdProfile(card, context);
  if (!p) return null;
  if (!p.qualifierUnderstood)
    return `${card.name}: cast qualifier "${p.qualifier}" is not modeled; no repeated-engine support is assumed.`;
  return `${card.name}: ${p.entryCantrip ? "Entry cantrip; " : p.entryBurst ? "Entry draw burst; " : ""}cast-threshold draw has ${p.eligible} eligible fixed-cost sources, ${p.conditional} X/fused/permission-dependent sources and ${p.alternate} alternate-face sources. ${p.supported ? "Meets" : "Below"} the conservative six-source repeated-engine estimate; face choices, recursion and affordability need review.`;
}
