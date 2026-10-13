export interface Card {
  id: string;
  oracle_id?: string;
  name: string;
  imageUrl?: string;
  type_line?: string;
  oracle_text?: string;
  cmc?: number;
  mana_cost?: string;
  color_identity?: string[];
  legalities?: Record<string, string>;
  set?: string;
  set_name?: string;
  collector_number?: string;
  lang?: string;
  prices?: Record<string, string | null>;
  scryfall_uri?: string;
  image_uris?: { normal: string };
  card_faces?: {
    name: string;
    image_uris?: { normal: string };
    oracle_text?: string;
  }[];
}
export type Board = "mainboard" | "sideboard" | "maybeboard" | "commander";
export interface Entry {
  id: string;
  card: Card;
  qty: number;
  board: Board;
  language: string;
  condition: string;
  finish: string;
  purchasePrice: string;
  notes: string;
  tags: string;
}
export interface Document {
  id: string;
  name: string;
  kind: "deck" | "collection" | "wishlist";
  format: string;
  notes: string;
  entries: Entry[];
  revision: number;
  deleted?: boolean;
}
export const formats = [
  "commander",
  "standard",
  "modern",
  "pioneer",
  "pauper",
  "legacy",
  "vintage",
] as const;
export const image = (c: Card, face = 0) =>
  c.card_faces?.[face]?.image_uris?.normal ||
  c.image_uris?.normal ||
  c.imageUrl;
export function validateDeck(d: Document) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const active = d.entries.filter((e) => e.board !== "maybeboard");
  const main = active.filter(
    (e) => e.board === "mainboard" || e.board === "commander",
  );
  const count = main.reduce((n, e) => n + e.qty, 0);
  const commanders = active.filter((e) => e.board === "commander");
  if (d.format === "commander") {
    if (count !== 100)
      errors.push(
        `Commander requires exactly 100 cards including commanders (${count}).`,
      );
    if (
      commanders.reduce((n, e) => n + e.qty, 0) < 1 ||
      commanders.reduce((n, e) => n + e.qty, 0) > 2
    )
      errors.push("Choose one commander or a supported pair.");
    if (active.some((e) => e.board === "sideboard"))
      errors.push("Commander has no sideboard.");
    for (const e of commanders)
      if (!(
        /Legendary.*Creature/.test(e.card.type_line || "") ||
        /can be your commander/.test(e.card.oracle_text || "") ||
        /Legendary.*Background/.test(e.card.type_line || "")
      ))
        errors.push(`${e.card.name}: commander eligibility not established.`);
    if (commanders.length === 2) {
      const [a, b] = commanders.map((e) => e.card);
      const at = a.oracle_text || "",
        bt = b.oracle_text || "";
      const pair =
        (/^Partner$/m.test(at) && /^Partner$/m.test(bt)) ||
        (at.includes(`Partner with ${b.name}`) &&
          bt.includes(`Partner with ${a.name}`)) ||
        (at.includes("Friends forever") && bt.includes("Friends forever")) ||
        (at.includes("Choose a Background") &&
          b.type_line?.includes("Background")) ||
        (bt.includes("Choose a Background") &&
          a.type_line?.includes("Background")) ||
        (at.includes("Doctor's companion") &&
          /Time Lord Doctor/.test(b.type_line || "")) ||
        (bt.includes("Doctor's companion") &&
          /Time Lord Doctor/.test(a.type_line || ""));
      if (!pair)
        errors.push(
          "These commanders do not have a supported pairing ability.",
        );
    }
    const colors = new Set(
      commanders.flatMap((e) => e.card.color_identity || []),
    );
    for (const e of main)
      if (e.card.color_identity?.some((c) => !colors.has(c)))
        errors.push(`${e.card.name} is outside commander color identity.`);
  } else {
    if (count < 60)
      errors.push(`At least 60 mainboard cards required (${count}).`);
    if (
      active
        .filter((e) => e.board === "sideboard")
        .reduce((n, e) => n + e.qty, 0) > 15
    )
      errors.push("Sideboard exceeds 15 cards.");
    if (commanders.length)
      errors.push("This format does not use a command zone.");
  }
  const groups = new Map<string, Entry[]>();
  for (const e of active) {
    const k = e.card.oracle_id || e.card.name;
    groups.set(k, [...(groups.get(k) || []), e]);
    if (!e.card.type_line || !e.card.legalities)
      warnings.push(
        `${e.card.name}: missing authoritative metadata; validation incomplete.`,
      );
    else {
      const legality = e.card.legalities[d.format];
      if (legality !== "legal" && legality !== "restricted")
        errors.push(
          `${e.card.name}: ${legality || "unknown legality"} in ${d.format}.`,
        );
    }
  }
  for (const entries of groups.values()) {
    const c = entries[0].card;
    const text = c.oracle_text || "";
    let limit = d.format === "commander" ? 1 : 4;
    if (c.legalities?.[d.format] === "restricted") limit = 1;
    if (
      /\bBasic\b/.test(c.type_line || "") ||
      /deck can have any number of cards named/i.test(text)
    )
      limit = Infinity;
    const special = text.match(/deck can have up to (\w+) cards named/i);
    if (special) {
      const numbers: Record<string, number> = { seven: 7, nine: 9 };
      limit = numbers[special[1]] || Number(special[1]);
      if (!limit)
        warnings.push(`${c.name}: copy exception needs manual review.`);
    }
    if (entries.reduce((n, e) => n + e.qty, 0) > limit)
      errors.push(
        `${c.name}: exceeds ${limit} copies across printings and boards.`,
      );
  }
  return {
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    count,
  };
}
