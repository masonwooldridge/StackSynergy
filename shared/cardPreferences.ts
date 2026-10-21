import type { Card } from "./model";
export type CardPreference = {
  cardId: string;
  oracleId?: string;
  name: string;
  state: "rejected" | "allowed" | "suggested";
  at: string;
};
export const MAX_CARD_PREFERENCES = 200;
export const preferenceKey = (c: Pick<Card, "id" | "oracle_id">) =>
  c.oracle_id || c.id;
export function normalizePreferences(input: unknown): CardPreference[] {
  if (!Array.isArray(input)) return [];
  const result = new Map<string, CardPreference>();
  for (const p of input)
    if (
      p &&
      typeof p.cardId === "string" &&
      typeof p.name === "string" &&
      ["rejected", "allowed", "suggested"].includes(p.state)
    ) {
      const key = p.oracleId || p.cardId;
      result.set(key, {
        cardId: p.cardId,
        oracleId: typeof p.oracleId === "string" ? p.oracleId : undefined,
        name: p.name.slice(0, 300),
        state: p.state,
        at: typeof p.at === "string" ? p.at : "",
      });
    }
  return [...result.values()];
}
export function setCardPreference(
  current: CardPreference[],
  card: Card,
  state: CardPreference["state"],
): CardPreference[] {
  const key = preferenceKey(card),
    index = current.findIndex(
      (p) => (p.oracleId || p.cardId) === key || p.cardId === card.id,
    );
  if (index < 0 && current.length >= MAX_CARD_PREFERENCES)
    throw Error(
      "Remembered card choices are full (200). Clear remembered choices to continue; nothing was forgotten automatically.",
    );
  const value: CardPreference = {
    cardId: card.id,
    oracleId: card.oracle_id,
    name: card.name,
    state,
    at: new Date().toISOString(),
  };
  if (index >= 0) return current.map((p, i) => (i === index ? value : p));
  return [...current, value];
}
export function preferenceFor(current: CardPreference[], card: Card) {
  return current.find(
    (p) =>
      (p.oracleId && p.oracleId === card.oracle_id) || p.cardId === card.id,
  );
}
export function namedCardReferences(text:string,cards:Card[]):Card[]{
 const normalized=text.replace(/’/g,"'");
 return cards.filter(card=>{const escaped=card.name.replace(/’/g,"'").replace(/[.*+?^${}()|[\]\\]/g,"\\$&");return new RegExp("(^|[^a-z0-9])"+escaped+"(?=$|[^a-z0-9])","i").test(normalized);});
}
export function messagePreferences(
  current: CardPreference[],
  text: string,
  known: Card[],
  prior: Card[] = [],
) {
  // Protect full card names (including commas) before separating explicit instructions.
  const named = new Map<string, Card>();
  for (const card of [...known, ...prior])
    if (!named.has(card.name.toLocaleLowerCase()))
      named.set(card.name.toLocaleLowerCase(), card);
  const cards = [...named.values()].sort(
    (a, b) => b.name.length - a.name.length,
  );
  let marked = text.replace(/’/g, "'");
  cards.forEach((card, index) => {
    const escaped = card.name
      .replace(/’/g, "'")
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    marked = marked.replace(
      new RegExp("(^|[^a-z0-9])" + escaped + "(?=$|[^a-z0-9])", "gi"),
      (_all, prefix) => prefix + "§" + index + "§",
    );
  });
  const clauses = marked.split(
    /[.!?;\n]+|,\s*|\b(?:but|however|instead)\b|\band\s+(?=(?:keep|protect|reconsider|allow|reject|avoid|exclude|stop|don't|do not)\b)/i,
  );
  let result = current;
  for (let clause of clauses) {
    if(/^\s*(?:why|explain|compare|what about)\b/i.test(clause))continue;
    clause = clause.replace(
      /\b(?:do not|don't|never)\s+(?:reject|avoid|exclude)\b/gi,
      "allow",
    );
    const targets = [...clause.matchAll(/§(\d+)§/g)].map(
      (m) => cards[Number(m[1])],
    ).filter((card):card is Card=>!!card);
    const negative = /^\s*(?:not|no)\s+§\d+§/i.test(clause)||
      /\b(?:reject|avoid|exclude|don't (?:want|use|recommend|keep|include)|do not (?:want|use|recommend|keep|include)|stop recommending|no thanks|not that|not those)\b/i.test(
        clause,
      );
    const reversal =
      /\b(?:reconsider|allow(?: again)?|undo (?:the )?rejection|revisit|try again|keep|protect)\b/i.test(
        clause,
      ) && !negative;
    const dismissPrior =
      /\b(?:no thanks|not (?:that|those)|(?:reject|avoid|exclude) (?:them|these|those|that|(?:all |these |those )?(?:suggestions|recommendations))|(?:don't|do not) (?:want|use|recommend) (?:them|these|those|that))\b/i.test(
        clause,
      );
    for (const card of negative
      ? targets.length
        ? targets
        : dismissPrior
          ? prior
          : []
      : reversal
        ? targets
        : [])
      result = setCardPreference(
        result,
        card,
        negative ? "rejected" : "allowed",
      );
  }
  return result;
}

export function cardPreferenceStorageKey(
  owner: string,
  scope: "guest" | "account",
  deckId: string,
  commanderId = "",
) {
  return (
    "cardchasm-ai-preferences-v1:" +
    owner +
    ":" +
    scope +
    ":" +
    (deckId || "idea:" + commanderId)
  );
}
export function migrateCardPreferences(
  turns: {
    role: string;
    content: string;
    cards?: Card[];
    review?: { pairs: { add: Card }[] } | null;
  }[],
  known: Card[],
  installed: Card[],
) {
  let choices: CardPreference[] = [];
  let prior: Card[] = [];
  for (const turn of turns) {
    if (turn.role === "user")
      choices = messagePreferences(choices, turn.content, known, prior);
    else if (turn.role === "assistant") {
      prior = turn.review?.pairs.map((p) => p.add) || turn.cards || [];
      for (const card of prior)
        if (
          !installed.some((c) => preferenceKey(c) === preferenceKey(card)) &&
          preferenceFor(choices, card)?.state !== "rejected"
        )
          choices = setCardPreference(choices, card, "suggested");
    }
  }
  return choices;
}
