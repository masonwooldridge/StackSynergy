import type { AIRequest } from "./aiConstraints";
/** Retrieval topics for discussion, not permission to purchase or mutate. */
export function discussionSearches(goal: string, request: AIRequest) {
  if (request.mode !== "explain") return [];
  const names = (cards: string[]) =>
    "(" + cards.map((n) => "!" + JSON.stringify(n)).join(" or ") + ")";
  if (
    /repeatable|ongoing|draw engine/i.test(goal) &&
    /draw|card advantage/i.test(goal)
  )
    return [
      {
        name: "Creature draw engines",
        query:
          names([
            "Enduring Curiosity",
            "Faerie Mastermind",
            "Welcoming Vampire",
            "Tandem Lookout",
          ]) + " t:creature",
      },
      {
        name: "Recurring creature draw",
        query:
          't:creature (o:whenever or o:"at the beginning") (o:"draw a card" or o:"draw two cards")',
      },
      {
        name: "Creature draw activations",
        query: 't:creature o:"draw a card" (o:"{T}" or o:"whenever")',
      },
    ];
  if (
    /evasion|unblockable|can.t be blocked|evade blockers|help[^.\n]*connect/i.test(
      goal,
    )
  )
    return [
      {
        name: "Standalone evasion reference options",
        query: names([
          "Whispersilk Cloak",
          "Trailblazer's Boots",
          "Rogue's Passage",
          "Access Tunnel",
          "Aqueous Form",
          "Slip Through Space",
        ]),
      },
      {
        name: "Direct unblockability",
        query: '(o:"can\'t be blocked" or o:"unblockable") mv<=4',
      },
      {
        name: "Conditional evasion and setup",
        query:
          '(t:equipment or t:enchantment or t:land) (o:menace or o:flying or o:"can\'t be blocked")',
      },
    ];
  if (/protect|protection/i.test(goal))
    return [
      {
        name: "Combat and commander protection",
        query: names([
          "Dolmen Gate",
          "Swiftfoot Boots",
          "Whispersilk Cloak",
          "Boros Charm",
          "Selfless Spirit",
        ]),
      },
      {
        name: "Board protection effects",
        query:
          'o:"creatures you control" (o:indestructible or o:hexproof or o:"prevent all combat damage")',
      },
      {
        name: "Protection setup options",
        query:
          '(t:artifact or t:instant) (o:hexproof or o:indestructible or o:shroud or o:"prevent all combat damage") mv<=3',
      },
    ];
  if (/finisher/i.test(goal) && /creature/i.test(goal)) {
    const range =
        /mana values?\s+(?:from\s+)?(\d+|six|seven|eight)\s+(?:through|to|and)\s+(\d+|six|seven|eight)/i.exec(
          goal,
        ),
      number = (s: string) =>
        ({ six: 6, seven: 7, eight: 8 })[s.toLowerCase()] ?? Number(s);
    const bounds = range
      ? " mv>=" + number(range[1]) + " mv<=" + number(range[2])
      : "";
    return [
      {
        name: "Creature finisher reference options",
        query:
          names([
            "Terror of Mount Velus",
            "Molten Primordial",
            "Combustible Gearhulk",
            "Auton Soldier",
          ]) +
          " t:creature" +
          bounds,
      },
      {
        name: "Immediate creature impact",
        query: "t:creature o:enter" + bounds,
      },
      { name: "Creature finisher range", query: "t:creature" + bounds },
    ];
  }
  return [];
}
