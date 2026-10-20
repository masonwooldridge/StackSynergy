import type { Card } from "./model";
export const frontText = (card: Card) =>
  card.card_faces?.[0]?.oracle_text ?? card.oracle_text ?? "";
export function selfEntryTrigger(card: Card) {
  const name = card.card_faces?.[0]?.name || card.name.split(" // ")[0];
  const names = [name, name.split(",")[0]]
    .filter((n) => n.length > 2)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const subject = [
    ...names,
    "this(?: creature| permanent| artifact| enchantment)?",
  ].join("|");
  return (
    frontText(card).match(
      new RegExp(
        "when(?:ever)? (?:" +
          subject +
          ")(?: or another[^,\n]*)? enters\\b[^\n]*",
        "i",
      ),
    )?.[0] || ""
  );
}
export function usefulCopiedEntry(card: Card) {
  const text = selfEntryTrigger(card);
  return (
    !!text &&
    !/if you cast|if it was cast|cards? named/i.test(text) &&
    !(
      /discard/i.test(text) &&
      /draw a card/i.test(text) &&
      !/draw (?:two|three|four)/i.test(text)
    ) &&
    /draw|destroy|exile target (?:creature|artifact|enchantment|nonland|permanent)|search your library|return[^.\n]*graveyard/i.test(
      text,
    )
  );
}
export function exchangesAllDrawnCards(text: string) {
  const numbers: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
  };
  const draw = /draw (one|two|three|four|five|six|seven|[0-9]+) cards?/i.exec(
      text,
    ),
    discard =
      /(?:^|[.\n] |, |then )discard (one|two|three|four|five|six|seven|[0-9]+) cards?/i.exec(
        text,
      );
  return (
    !!draw &&
    !!discard &&
    (numbers[discard[1].toLowerCase()] || Number(discard[1])) >=
      (numbers[draw[1].toLowerCase()] || Number(draw[1]))
  );
}

export function sacrificesItself(card: Card) {
  const names = [
    card.card_faces?.[0]?.name || card.name,
    card.name.split(",")[0],
  ].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(
    "sacrifice (?:this(?: artifact| creature| permanent)?|" +
      names.join("|") +
      ")\\b",
    "i",
  ).test(frontText(card));
}
export function oneShotManaFilter(card: Card) {
  return (
    sacrificesItself(card) &&
    /\{[1-9]\}[^:\n]*:\s*Add (?:one mana|\{[WUBRGC]\})(?!\{)/i.test(
      frontText(card),
    )
  );
}
export function energyFunction(card: Card) {
  const text = frontText(card),
    producer = /you (?:get|gain[^.\n]{0,35}and get)[^.\n]*\{E\}/i.test(text);
  const repeatableProducer =
    producer &&
    text.split(/[.\n]/).some(
      (clause) =>
        /(?:whenever|at the beginning|\{T\})/i.test(clause) &&
        /you (?:get|gain[^.\n]{0,35}and get)[^.\n]*\{E\}/i.test(clause) &&
        !selfEntryTrigger({
          ...card,
          card_faces: undefined,
          oracle_text: clause,
        }),
    );
  const usefulOutlet =
    /pay[^.\n]*\{E\}[^.\n]*(?:draw|create|copy|additional combat|exile target|cast)/i.test(
      text,
    ) && !/unless you pay/i.test(text);
  return { producer, repeatableProducer, usefulOutlet };
}

export function singleDrawExchangesPermanent(card: Card) {
  return /sacrifice[^:\n]*(?:artifact|land)[^:\n]*:\s*(?:you )?draw a card/i.test(
    frontText(card),
  );
}
