import { interactionProfile } from "./interactionProfile";
import { roleConfidence, dependableRole } from "./roleConfidence";
import { castThresholdProfile, thresholdSupportNote } from "./castThreshold";
import type { Card } from "./model";
import { frontText } from "./cardFunction";
import { manaProfile } from "./mtgCardFunctions";
import { frontFaceType, isLandSlot } from "./landAllocation";

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Counts distinct own-deck sources, including typed tokens, not guaranteed token quantities. */
export function typeSupportCount(type: string, context: Card[]): number {
  const word = escape(type);
  return [
    ...new Map(context.map((c) => [c.oracle_id || c.id, c])).values(),
  ].filter(
    (c) =>
      new RegExp("\\b" + word + "s?\\b", "i").test(frontFaceType(c)) ||
      (new RegExp("creat[^.\\n]*\\b" + word + "\\b[^.\\n]*tokens?", "i").test(
        frontText(c),
      ) &&
        !/(?:opponent|its controller) creates?/i.test(frontText(c))),
  ).length;
}
export function eligibleAdventure(card: Card): boolean {
  return (
    /\bCreature\b/.test(frontFaceType(card)) &&
    (card.layout === "adventure" ||
      !!card.card_faces?.some((f) => /Adventure/.test(f.type_line || "")))
  );
}
export function creatureTypes(card: Card): string[] {
  const type = frontFaceType(card);
  if (!/\b(?:Creature|Kindred|Tribal)\b/.test(type)) return [];
  return (type.split("—")[1] || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}
export function sharedTypeCastCount(
  commanders: Card[],
  context: Card[],
): number {
  const types = new Set(commanders.flatMap(creatureTypes));
  const ids = new Set(commanders.map((c) => c.oracle_id || c.id));
  if (!types.size) return 0;
  return [
    ...new Map(context.map((c) => [c.oracle_id || c.id, c])).values(),
  ].filter(
    (c) =>
      !ids.has(c.oracle_id || c.id) &&
      ((/^(?:Changeling)\b/im.test(frontText(c)) &&
        /Creature|Kindred|Tribal/.test(frontFaceType(c))) ||
        creatureTypes(c).some((t) => types.has(t))),
  ).length;
}

export function conditionalRoleNotes(
  card: Card,
  context: Card[] = [],
): string[] {
  const text = frontText(card),
    notes: string[] = [...roleConfidence(card, context).notes];
  if (
    /cast this spell only after combat|blocked by target|whenever[^.\n]*(?:attacks|deals?[^.\n]*combat damage|becomes blocked)|target creature[^.\n]*(?:that blocked|was blocked|attacking)/i.test(
      text,
    )
  )
    notes.push(
      "Combat-dependent effect; not a guaranteed broad answer or acceleration source.",
    );
  if (/whenever[^.\n]*spells?[^.\n]*(?:is|are) countered/i.test(text))
    notes.push(
      "Draw requires a countered spell; opponents or a separate countering engine must supply that event.",
    );
  if (/target creature[^.\n]*power[^.\n]*life total/i.test(text))
    notes.push("Removal target is restricted by your life total.");
  const thresholdNote = thresholdSupportNote(card, context);
  if (thresholdNote) notes.push(thresholdNote.slice(card.name.length + 2));
  return notes;
}

/** Conservative, rules-text prerequisites. Unknown mechanics still require human review. */
export function mechanicalPrerequisites(
  card: Card,
  context: Card[],
  commanders: Card[] = [],
): string[] {
  const text = frontText(card),
    others = [
      ...new Map(
        [...context, ...commanders]
          .filter((c) => (c.oracle_id || c.id) !== (card.oracle_id || card.id))
          .map((c) => [c.oracle_id || c.id, c]),
      ).values(),
    ];
  const notes: string[] = [];
  if (
    /shares a creature type with (?:this creature|your commander)/i.test(text)
  ) {
    const leaders =
      /Commander creatures you own have|with your commander/i.test(text)
        ? commanders
        : [card];
    const count = sharedTypeCastCount(
      leaders,
      context.filter(
        (c) => (c.oracle_id || c.id) !== (card.oracle_id || card.id),
      ),
    );
    if (count < 6)
      notes.push(
        `Shared-type cast engine needs six other spells sharing an actual commander/engine creature type (${count} selected); token production is not a cast.`,
      );
  }
  if (
    /whenever you (?:win a |win the )?clash|if you win[^.\n]*clash/i.test(
      text,
    ) &&
    !others.some((c) => /\bclash with\b/i.test(frontText(c))) &&
    !/\bclash with\b/i.test(text)
  )
    notes.push("Needs a card that initiates clash; none is selected.");
  if (/whenever you cast[^.\n]*has an Adventure[^.\n]*draw/i.test(text)) {
    const count = others.filter((c) => eligibleAdventure(c)).length;
    if (count < 6)
      notes.push(
        `Adventure draw needs at least six other creature spells with Adventure for this conservative engine estimate (${count} selected).`,
      );
  }
  if (
    /if you control a land named Wastes/i.test(text) &&
    !others.some((c) => c.name === "Wastes")
  )
    notes.push("Needs Wastes for its battlefield-ramp mode; none is selected.");
  if (
    /search your library for (?:a|an) snow land/i.test(text) &&
    !others.some(
      (c) => /Snow/.test(frontFaceType(c)) && /Land/.test(frontFaceType(c)),
    )
  )
    notes.push("Needs a snow land search target; none is selected.");
  const required = new Set<string>();
  for (const match of text.matchAll(
    /blocked by target ([A-Z][a-z]+)|(?:blocked or was blocked|blocked|was blocked) by (?:a|an) ([A-Z][a-z]+)/g,
  ))
    required.add(match[1] || match[2]);
  for (const match of text.matchAll(
    /target ([A-Z][a-z]+)|Enchant ([A-Z][a-z]+)(?: you control)?/g,
  ))
    required.add(match[1] || match[2]);
  if (
    /Enchant snow land/i.test(text) &&
    !others.some(
      (c) => /Snow/.test(frontFaceType(c)) && /Land/.test(frontFaceType(c)),
    )
  )
    notes.push("Needs a snow land to enchant; none is selected.");
  if (
    /whenever you cycle/i.test(text) &&
    others.filter((c) => /cycling(?: [^.]*)?[—{]/i.test(frontText(c))).length <
      6
  )
    notes.push(
      "Cycling-triggered engine needs six other cycling sources for the conservative engine estimate.",
    );
  for (const match of text.matchAll(/\b([A-Z][a-z]+) creatures you control/g)) {
    if (
      !/^(?:All|Other|Attacking|Blocking|Enchanted|Untapped|Tapped|Nontoken|Token|Nonartifact|Nonblack|Nonwhite|Nonblue|Nongreen|Nonred|Legendary|Nonlegendary)$/.test(
        match[1],
      )
    )
      required.add(match[1]);
  }
  if (
    /whenever you cast a spell that targets a creature you control/i.test(text)
  ) {
    const count = others.filter(
      (c) =>
        /enchant creature/i.test(frontText(c)) ||
        (/Instant|Sorcery/.test(frontFaceType(c)) &&
          /target creature/i.test(frontText(c)) &&
          !/destroy|exile|return target/i.test(frontText(c))),
    ).length;
    if (count < 6)
      notes.push(
        `Targeted-creature spell engine needs six other own-creature targeting spells (${count} selected).`,
      );
  }
  for (const type of required)
    if (!typeSupportCount(type, [...others, card]))
      notes.push(
        `Needs own-deck ${type} creatures or token sources; none is selected. Opponent support is not assumed.`,
      );
  return notes;
}
export function acceleration(card: Card): boolean {
  if (isLandSlot(card)) return false;
  const text = frontText(card),
    mana = manaProfile(card);
  const conditionalSearch =
    /(?:if|unless) [^.\n]*(?:control|sacrificed|died)|morbid|fateful hour/i.test(
      text,
    );
  const granted = /enchanted (?:land|creature|permanent) (?:has|gains)/i.test(
    text,
  );
  const extraLandMana =
    /whenever enchanted land is tapped for mana,[^.\n]*(?:add|adds) /i.test(
      text,
    );
  if (extraLandMana) return true;
  return (
    (mana.reliableAcceleration &&
      (!granted ||
        mana.abilities.some((a) => (a.output || 0) > 1 && !a.conditional))) ||
    (mana.landRamp &&
      !conditionalSearch &&
      !/whenever[^.\n]*deals?[^.\n]*combat damage|whenever[^.\n]*attacks|becomes blocked/i.test(
        text,
      ))
  );
}
export function reliableRole(
  card: Card,
  role: string,
  commander?: Card,
  context: Card[] = [],
): boolean {
  const text = frontText(card);
  if (!dependableRole(card, role, context)) return false;
  if (
    mechanicalPrerequisites(card, context, commander ? [commander] : []).length
  )
    return false;
  if (role === "interaction") return interactionProfile(card, context).primary;
  if (role === "ramp")
    return (
      acceleration(card) &&
      !mechanicalPrerequisites(card, context, commander ? [commander] : [])
        .length
    );
  if (
    ["wipes", "advantage"].includes(role) &&
    /each player votes|gets more votes|vote is tied/i.test(text)
  )
    return false;
  if (
    role === "wipes" &&
    /(?:destroy|exile) all (?:un)?tapped creatures/i.test(text)
  )
    return false;
  if (
    ["wipes", "interaction", "advantage"].includes(role) &&
    /flip a coin[^]*if you (?:win|lose)|roll a (?:d\d+|six-sided|twenty-sided)/i.test(
      text,
    )
  )
    return false;
  if (
    role === "wipes" &&
    /(?:exile|destroy) all creatures with (?:power|toughness)|(?:exile|destroy) all[^.\n]*with mana value equal/i.test(
      text,
    )
  )
    return false;
  if (
    role === "wipes" &&
    (/Saga/.test(frontFaceType(card)) ||
      /at the beginning[^.\n]*upkeep[^.\n]*if/i.test(text))
  )
    return false;
  if (role === "advantage") {
    const threshold = castThresholdProfile(card, context);
    if (threshold && !threshold.supported && !threshold.entryBurst)
      return false;
    const effects = text.replace(
      /\b(?:When|Whenever|If) you draw a card,?/gi,
      "",
    );
    if (
      /draw a card/i.test(text) &&
      !/draw (?:a|two|three|four|five|six|seven|x|cards|that many|a number)/i.test(
        effects,
      )
    )
      return false;
    if (
      /whenever an opponent casts (?:a|an) (?:white|blue|black|red|green) spell/i.test(
        text,
      )
    )
      return false;
  }
  if (role === "finisher") {
    const tribe = /([A-Z][a-z]+) creatures you control/.exec(text)?.[1];
    if (
      tribe &&
      !/^(?:All|Other|Attacking|Blocking|Enchanted|Untapped|Tapped|Nontoken|Token|Legendary|Nonlegendary)$/.test(
        tribe,
      ) &&
      (!commander || !typeSupportCount(tribe, [commander]))
    )
      return false;
    if (
      /creatures you control[^.\n]*get \+[01]\/\+[012]/i.test(text) &&
      !/double strike|additional combat|for each|you win/i.test(text)
    )
      return false;
  }
  if (
    role === "advantage" &&
    /skip your draw (?:step|phase)|instead of drawing|whenever[^.\n]*deals?[^.\n]*damage/i.test(
      text,
    )
  )
    return false;
  if (
    role === "wipes" &&
    /(?:destroy|exile) all creatures that|each creature that|after combat|blocked by|that blocked/i.test(
      text,
    )
  )
    return false;
  if (
    role === "advantage" &&
    /whenever[^.\n]*spells?[^.\n]*(?:is|are) countered/i.test(text)
  )
    return false;
  if (
    role === "wipes" &&
    /each creature with(?:out)? flying|all (?:non\w+ |\w+ )?creatures with(?:out)? flying|all (?:non)?(?:white|blue|black|red|green|artifact|enchantment) creatures/i.test(
      text,
    )
  )
    return false;
  if (
    role === "protection" &&
    /fateful hour|if you (?:have|control)|unless|as long as/i.test(text)
  )
    return false;
  if (
    role === "finisher" &&
    /for each card named[^.\n]*graveyards?/i.test(text)
  )
    return false;
  if (
    role === "advantage" &&
    /becomes blocked|deals combat damage|if you win[^.\n]*clash|whenever you win a clash/i.test(
      text,
    )
  )
    return false;
  return true;
}
