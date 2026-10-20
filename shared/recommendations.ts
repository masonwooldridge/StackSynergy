import { manaProfile } from "./mtgCardFunctions";
import type { Card, Document } from "./model";
import { matchesDeckRules } from "./discovery";
export const roles = [
  "synergy",
  "ramp",
  "draw",
  "interaction",
  "protection",
  "wipes",
  "mana",
] as const;
export type Role = (typeof roles)[number];
export const roleNames: Record<Role, string> = {
  synergy: "Commander synergy",
  ramp: "Ramp",
  draw: "Card draw",
  interaction: "Interaction",
  protection: "Protection",
  wipes: "Board wipes",
  mana: "Mana base",
};
export const mechanics = [
  "counters",
  "tokens",
  "graveyard",
  "spells",
  "artifacts",
  "lifegain",
] as const;
export type Mechanic = (typeof mechanics)[number];
export type Strategy = "auto" | "any" | Mechanic;
export const cardText = (card: Card) =>
  [
    card.oracle_text || "",
    ...(card.card_faces || []).map((face) => face.oracle_text || ""),
  ].join("\n");
const tests: Record<Mechanic, (card: Card) => boolean> = {
  counters: (card) =>
    /proliferate|[+-]1\/[+-]1 counters?|(?:put|with|remove)[^.\n]*counters?/i.test(
      cardText(card),
    ),
  tokens: (card) => /creat[^.\n]*tokens?/i.test(cardText(card)),
  graveyard: (card) => /graveyard/i.test(cardText(card)),
  spells: (card) =>
    /Instant|Sorcery/.test(card.type_line || "") ||
    /(?:cast|casting)[^.\n]*(?:instant|sorcery)/i.test(cardText(card)),
  artifacts: (card) =>
    /Artifact/.test(card.type_line || "") || /artifact/i.test(cardText(card)),
  lifegain: (card) => /lifelink|gain[^.\n]*life/i.test(cardText(card)),
};
export function commanderMechanic(commanders: Card[]): Mechanic | null {
  const text = commanders.map(cardText).join("\n");
  if (/proliferate|[+-]1\/[+-]1 counters?|charge counters?/i.test(text))
    return "counters";
  if (/creat[^.\n]*tokens?/i.test(text)) return "tokens";
  if (/graveyard/i.test(text)) return "graveyard";
  if (/cast[^.\n]*(?:instant|sorcery)/i.test(text)) return "spells";
  if (/artifact/i.test(text)) return "artifacts";
  if (/lifelink|gain[^.\n]*life/i.test(text)) return "lifegain";
  return null;
}
export function focusMechanic(commanders: Card[], strategy: Strategy) {
  return strategy === "auto" || strategy === "any"
    ? commanderMechanic(commanders)
    : strategy;
}
export const mechanicQueries: Record<Mechanic, string> = {
  counters: '(o:proliferate or o:"+1/+1 counter")',
  tokens: "o:token",
  graveyard: "o:graveyard",
  spells: "(t:instant or t:sorcery)",
  artifacts: "(t:artifact or o:artifact)",
  lifegain: '(o:lifelink or o:"gain life" or o:"gain 1 life")',
};
export const roleQueries: Record<Exclude<Role, "synergy">, string> = {
  ramp: '(o:"add {" or o:"add one mana" or o:"add two mana" or (o:"search your library" o:"land card")) -t:land',
  draw: '(o:"draw a card" or o:"draw two cards" or o:"draw three cards" or o:"draw cards")',
  interaction:
    '(o:"counter target" or o:"destroy target" or o:"exile target" or o:"return target")',
  protection:
    '(o:hexproof or o:indestructible or o:"protection from" or o:ward)',
  wipes: '(o:"destroy all" or o:"exile all" or (o:damage o:"each creature"))',
  mana: 't:land (o:"any color" or o:"any type" or o:"add {")',
};
export type Suggestion = {
  card: Card;
  reasons: { role: Role; text: string }[];
};
export function suggestionsFor(
  cards: Card[],
  commanders: Card[],
  strategy: Strategy,
): Suggestion[] {
  const mechanic = focusMechanic(commanders, strategy);
  return cards
    .map((card) => {
      const text = cardText(card),
        reasons: Suggestion["reasons"] = [];
      if (mechanic && tests[mechanic](card))
        reasons.push({
          role: "synergy",
          text:
            strategy === "auto" || strategy === "any"
              ? `Rules text or card type supports ${mechanic}, a mechanic mentioned by your commander. Review the exact interaction.`
              : `Rules text or card type supports your chosen ${mechanic} strategy. Review the exact interaction.`,
        });
      // Conservative ramp accounting: reminder text on opposing Treasure and mana filtering
      // must not satisfy the deck's reliable mana-development target.
      const functional = text.replace(/\([^()]*\)/g, "");
      const permanent =
        /\b(?:Artifact|Creature|Enchantment|Planeswalker)\b/.test(
          card.type_line || "",
        );
      const profile = manaProfile(card);
      const repeatable =
        permanent &&
        profile.reliableAcceleration &&
        card.mana_cost !== "" &&
        (!/commander.s color identity/i.test(functional) ||
          commanders.some((c) => (c.color_identity || []).length));
      const battlefieldLand =
        /search your library[^.\n]*land cards?[^]*?put[^.\n]*onto the battlefield/i.test(
          functional,
        ) && !/sacrifice a land/i.test(functional);
      if (!/Land/.test(card.type_line || "") && (repeatable || battlefieldLand))
        reasons.push({
          role: "ramp",
          text: "Has a repeatable tap-for-mana ability or puts searched lands onto the battlefield; review restrictions.",
        });
      if (
        /draw (?:a|two|three|four|five|six|seven|x|that many|cards)/i.test(text)
      )
        reasons.push({
          role: "draw",
          text: "Rules text includes card draw; check its cost and trigger conditions.",
        });
      if (
        /\bcounter target\b|(?:destroy|exile|return)[^.\n]{0,60}\btarget\b/i.test(
          text,
        )
      )
        reasons.push({
          role: "interaction",
          text: "Can interact with a target; check what it can affect.",
        });
      const protectiveText = text.replace(
        /(?:lose|loses|can't have|cannot have)[^.\n]*/gi,
        "",
      );
      if (
        /(?:^|\n)(?:hexproof|indestructible|ward|protection from)\b|(?:gain|gains|have|has|with)[^.\n]{0,60}(?:hexproof|indestructible|ward|protection from)\b|(?:hexproof|indestructible|ward) counter/i.test(
          protectiveText,
        )
      )
        reasons.push({
          role: "protection",
          text: "Mentions a protection mechanic; check who receives it and for how long.",
        });
      if (
        /(?:destroy|exile) all[^.\n]{0,40}(?:creatures|artifacts|enchantments|lands|permanents)|damage to each creature/i.test(
          text,
        )
      )
        reasons.push({
          role: "wipes",
          text: "Can affect multiple permanents; review which boards or card types it affects.",
        });
      if (/Land/.test(card.type_line || ""))
        reasons.push({
          role: "mana",
          text: "A mana-base candidate; inspect colors produced and enters-tapped conditions.",
        });
      return { card, reasons };
    })
    .filter((suggestion) => suggestion.reasons.length > 0);
}
export function suggestionPrice(card: Card): number | null {
  const finish = card.finishes?.includes("nonfoil")
    ? "nonfoil"
    : card.finishes?.[0] || "nonfoil";
  const raw =
    card.prices?.[
      finish === "foil"
        ? "usd_foil"
        : finish === "etched"
          ? "usd_etched"
          : "usd"
    ];
  if (typeof raw !== "string" || !raw.trim()) return null;
  const price = Number(raw);
  return Number.isFinite(price) && price >= 0 ? price : null;
}
export function ownedCopies(card: Card, documents: Document[]) {
  return documents
    .filter((document) => document.kind === "collection" && !document.deleted)
    .flatMap((document) => document.entries)
    .filter(
      (entry) =>
        (entry.card.oracle_id || entry.card.name) ===
        (card.oracle_id || card.name),
    )
    .reduce((sum, entry) => sum + entry.qty, 0);
}
export function filterSuggestions(
  suggestions: Suggestion[],
  deck: Document,
  documents: Document[],
  options: {
    role: Role | "all";
    strategy: Strategy;
    rules: boolean;
    owned: boolean;
    maxPrice: number | null;
  },
) {
  return suggestions.filter(
    ({ card, reasons }) =>
      matchesDeckRules(card, deck, "mainboard", options.rules) &&
      (options.role === "all" ||
        reasons.some((reason) => reason.role === options.role)) &&
      (options.strategy === "auto" ||
        options.strategy === "any" ||
        tests[options.strategy](card)) &&
      (!options.owned || ownedCopies(card, documents) > 0) &&
      (options.maxPrice === null ||
        (suggestionPrice(card) !== null &&
          suggestionPrice(card)! <= options.maxPrice)),
  );
}
