import { usefulCopiedEntry, energyFunction } from "./cardFunction";
import type { Card } from "./model";
import { commanderSignals } from "./commanderRelevance";
import { frontFaceType, isLandSlot } from "./landAllocation";
export function packageTargets(commander: Card): Record<string, number> {
  const s = commanderSignals([commander]);
  if (s.energy && s.copyCreature)
    return { "Energy engines": 3, "Copy value": 4, "Attack access": 2 };
  if (s.typal.length) return { "Typal fuel": 8, "Typal engines": 3 };
  if (s.permanentReplay) return { "Graveyard fuel": 3, "Sacrifice value": 6 };
  if (s.spells) return { "Cheap spell selection": 6, "Spell engines": 2 };
  return {};
}
export function packageMatches(card: Card, commander: Card): string[] {
  if (isLandSlot(card)) return [];
  const s = commanderSignals([commander]),
    text = card.card_faces?.[0]?.oracle_text ?? card.oracle_text ?? "",
    type = frontFaceType(card),
    creature = /Creature/.test(type),
    permanent = /Creature|Artifact|Enchantment|Planeswalker|Battle/.test(type),
    roles: string[] = [];
  if (
    s.energy &&
    /\{E\}|energy counter/i.test(text) &&
    (energyFunction(card).repeatableProducer ||
      energyFunction(card).usefulOutlet)
  )
    roles.push("Energy engines");
  if (s.copyCreature && creature && usefulCopiedEntry(card))
    roles.push("Copy value");
  if (
    s.attacks &&
    ((!creature &&
      /(?:creatures? you control|equipped creature|enchanted creature)[^.\n]*(?:haste|can't be blocked)/i.test(
        text,
      )) ||
      /additional combat/i.test(text))
  )
    roles.push("Attack access");
  if (s.typal.length) {
    if (
      s.typal.some(
        (t) =>
          new RegExp("\\b" + t + "\\b", "i").test(type) ||
          new RegExp("creat[^.\n]*" + t + "[^.\n]*token", "i").test(text),
      )
    )
      roles.push("Typal fuel");
    if (
      s.typal.some((t) =>
        new RegExp(
          t +
            "[^.\n]*(?:cost|haste|you control)|(?:sacrifice|other)[^.\n]*" +
            t,
          "i",
        ).test(text),
      ) ||
      /whenever[^.\n]*creature[^.\n]*enters[^]*?damage to each opponent/i.test(
        text,
      )
    )
      roles.push("Typal engines");
  }
  if (s.permanentReplay && permanent) {
    if (
      /mill[^.\n]*(?:cards?|that many)|put[^.\n]*library[^.\n]*graveyard/i.test(
        text,
      )
    )
      roles.push("Graveyard fuel");
    if (
      /sacrifice/i.test(text) &&
      !/opponent sacrifices|each opponent sacrifices/i.test(text)
    )
      roles.push("Sacrifice value");
  }
  if (s.spells) {
    if (
      /Instant|Sorcery/.test(type) &&
      (card.cmc || 0) <= 2 &&
      card.mana_cost !== "" &&
      /draw a card|scry|surveil/i.test(text)
    )
      roles.push("Cheap spell selection");
    if (
      permanent &&
      /whenever you cast[^.\n]*(?:instant|sorcery|noncreature)/i.test(text) &&
      /draw|create[^.\n]*token/i.test(text)
    )
      roles.push("Spell engines");
  }
  return roles;
}
