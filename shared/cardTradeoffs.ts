import type { Card } from "./model";
import { frontText } from "./cardFunction";
export type CardTradeoff = {
  recipient:
    "target-controller" | "affected-player" | "opponent" | "each-player";
  resource: "tokens" | "permanent" | "land" | "cards" | "life" | "other";
  optional: boolean;
  timing: "resolution" | "triggered" | "later-condition";
  oracleClause: string;
  note: string;
};
/** Factual recipients and permissions only; no invented exchange rate for opponent resources. */
export function cardTradeoffs(card: Card): CardTradeoff[] {
  const text = frontText(card).replace(/\([^()]*\)/g, ""),
    out: CardTradeoff[] = [];
  for (const line of text.split("\n"))
    for (const part of line.split(/\.(?:\s|$)/)) {
      const clause = part.trim();
      if (!clause) continue;
      const action = clause.replace(/^(?:When|Whenever|At|If)\b[^,]*,\s*/i, "");
      const match =
        /(\b(?:its|their|that (?:creature|permanent)'s) controller|\bthat player|\b(?:target|each|an?|your) opponents?|\beach player)\s+(may\s+)?(creates?|gains?|draws?|search(?:es)?|put(?:s)?|gets?)\b[^.\n]*/i.exec(
          action,
        );
      if (!match) continue;
      const recipient: CardTradeoff["recipient"] = /controller/i.test(match[1])
        ? "target-controller"
        : /that player/i.test(match[1])
          ? "affected-player"
          : /each player/i.test(match[1])
            ? "each-player"
            : "opponent";
      const effect = match[0];
      const resource: CardTradeoff["resource"] = /creat[^.]*tokens?/i.test(
        effect,
      )
        ? "tokens"
        : /put[^.]*permanent[^.]*hand[^.]*battlefield/i.test(effect)
          ? "permanent"
          : /search[^.]*land|put[^.]*land[^.]*battlefield/i.test(effect)
            ? "land"
            : /draw/i.test(match[3])
              ? "cards"
              : /gain[^.]*life/i.test(effect)
                ? "life"
                : "other";
      const timing: CardTradeoff["timing"] = /^(?:When|Whenever|At|If)\b/i.test(
        clause,
      )
        ? /leaves the battlefield|dies|put into a graveyard/i.test(
            clause.split(",")[0],
          )
          ? "later-condition"
          : "triggered"
        : "resolution";
      const who =
        recipient === "target-controller"
          ? "the affected permanent's controller (which may be you)"
          : recipient === "affected-player"
            ? "the affected player"
            : recipient === "each-player"
              ? "each player, including you"
              : "the specified opponent";
      out.push({
        recipient,
        resource,
        optional: !!match[2],
        timing,
        oracleClause: clause,
        note: `Resource tradeoff for ${who}: ${clause}. ${timing === "later-condition" ? "This depends on the stated later trigger/condition. " : ""}The exact resource and board state matter; no mana-equivalent price or automatic net advantage is assumed.`,
      });
    }
  return [...new Map(out.map((x) => [x.oracleClause, x])).values()];
}
