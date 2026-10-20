import type { Card } from "./model";
import { manaProfile } from "./mtgCardFunctions";
import { frontText } from "./cardFunction";
/** Concise evidence from actual card text, not popularity or a power claim. */
export function suggestionExplanation(card: Card, commanders: Card[]) {
  const oracle = frontText(card)
      .replace(/\([^()]*\)/g, "")
      .trim(),
    mana = manaProfile(card),
    commander = commanders[0]?.name.split(",")[0] || "your commander";
  const entry = /(?:when|whenever)[^.\n]*enters[^.\n]*/i.exec(oracle)?.[0];
  const excerpt = (
    entry ||
    oracle
      .split("\n")
      .find((line) => !/^flying|^trample|^vigilance/i.test(line)) ||
    oracle
  ).slice(0, 190);
  if (mana.manaRock || mana.manaDork)
    return `${mana.conditionalMana ? "Conditional mana — check its resource costs." : mana.entersTapped ? "Mana support that enters tapped." : "Reusable mana for your next plays."} ${excerpt}`;
  if (
    entry &&
    /copy[^.\n]*creature|creature[^.\n]*copy/i.test(
      commanders.map(frontText).join(" "),
    )
  )
    return `${commander} can reuse this creature’s entry effect: ${excerpt}`;
  if (
    /graveyard/i.test(commanders.map(frontText).join(" ")) &&
    /sacrifice|graveyard|mill/i.test(oracle)
  )
    return `A graveyard option for ${commander}. ${excerpt}`;
  return excerpt || "Open the card to review its rules and fit before adding.";
}
export function uniqueRoleLabels<T extends string>(roles: T[]): T[] {
  return [...new Set(roles)];
}
