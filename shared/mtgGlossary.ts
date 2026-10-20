import type { Card } from "./model";
import { cardFunctionFacts } from "./mtgCardFunctions";
export const MTG_GLOSSARY_VERSION = "2026-10-20.2";
export interface MTGTerm {
  id: string;
  label: string;
  aliases: string[];
  definition: string;
  query: string;
  examples: string[];
  caveat?: string;
  primaryType?: string;
  role?: "ramp" | "advantage" | "interaction" | "wipes" | "protection";
}
const term = (
  id: string,
  label: string,
  aliases: string[],
  definition: string,
  query: string,
  examples: string[],
  extra: Partial<MTGTerm> = {},
): MTGTerm => ({ id, label, aliases, definition, query, examples, ...extra });
export const MTG_TERMS: MTGTerm[] = [
  term(
    "mana-rock",
    "Mana rocks",
    ["mana rocks", "mana rock", "artifact ramp", "rocks", "rock"],
    "Reusable mana-producing artifacts that provide positive or conditional mana acceleration; not every artifact is a rock.",
    't:artifact (o:"add {" or o:"add one mana" or o:"add two mana" or o:"add three mana")',
    [
      "Arcane Signet",
      "Boros Signet",
      "Mind Stone",
      "Commander's Sphere",
      "Darksteel Ingot",
      "Gilded Lotus",
    ],
    {
      primaryType: "Artifact",
      role: "ramp",
      caveat:
        "Artifact-creature hybrids also count as dorks. One-shot artifacts, rituals, Treasure makers and cost reducers are separate categories.",
    },
  ),
  term(
    "mana-dork",
    "Mana dorks",
    ["mana dorks", "mana dork", "dorks", "dork", "creature ramp"],
    "Creatures with reusable mana-producing abilities.",
    't:creature (o:"add {" or o:"add one mana")',
    ["Llanowar Elves", "Birds of Paradise", "Silver Myr"],
    {
      primaryType: "Creature",
      role: "ramp",
      caveat:
        "Artifact creatures may fit both dork and rock; tap abilities usually face summoning sickness.",
    },
  ),
  term(
    "land-ramp",
    "Land ramp",
    ["land ramp", "ramp lands", "extra land drops", "additional land drops"],
    "Effects that increase lands on the battlefield or permit additional land plays.",
    '(o:"search your library" o:land o:"battlefield") or o:"additional land"',
    ["Cultivate", "Rampant Growth", "Exploration"],
    {
      role: "ramp",
      caveat:
        "Finding a land for your hand or exchanging one land for another is not automatically ramp.",
    },
  ),
  term(
    "ramp",
    "Ramp",
    ["ramp", "mana acceleration", "accelerants"],
    "Mana development through reusable mana sources or additional lands.",
    '(o:"add {" or o:"add one mana" or (o:"search your library" o:land o:battlefield))',
    ["Sol Ring", "Llanowar Elves", "Cultivate"],
    {
      role: "ramp",
      caveat: "Fixing and cost reduction are related but distinct functions.",
    },
  ),
  term(
    "fixing",
    "Mana fixing",
    [
      "mana fixing",
      "color fixing",
      "colour fixing",
      "fixing",
      "fix colors",
      "fix colours",
    ],
    "Access to needed colors; it need not increase total mana.",
    'o:"any color" or o:"any type" or (o:"search your library" o:land)',
    ["Chromatic Lantern", "Prophetic Prism", "Farseek"],
  ),
  term(
    "cost-reduction",
    "Cost reducers",
    ["cost reducers", "cost reducer", "cost reduction", "discount effects"],
    "Effects reducing spell or ability costs, distinct from producing mana.",
    'o:"cost" (o:"less to cast" or o:"less to activate")',
    ["Cloud Key", "Goblin Electromancer"],
  ),
  term(
    "ritual",
    "Rituals",
    ["rituals", "ritual", "burst mana"],
    "Spells that produce a one-shot burst of mana.",
    '(t:instant or t:sorcery) (o:"add {" or o:"add mana")',
    ["Dark Ritual", "Seething Song"],
    { caveat: "One-shot mana is not a reusable rock or dork." },
  ),
  term(
    "one-shot-artifact-mana",
    "One-shot artifact mana",
    [
      "one shot artifact mana",
      "one-shot mana artifacts",
      "sacrificial mana artifacts",
    ],
    "Artifacts sacrificed for mana rather than remaining reusable sources.",
    't:artifact o:sacrifice (o:"add {" or o:"add one mana")',
    ["Lotus Petal"],
  ),
  term(
    "treasure",
    "Treasure makers",
    ["treasure makers", "treasure generator", "treasures", "treasure"],
    "Cards creating Treasure tokens; their token mana is distinct from a direct reusable mana ability.",
    "o:create o:treasure",
    ["Dockside Extortionist", "Big Score"],
  ),
  term(
    "card-draw",
    "Card draw",
    ["card draw", "draw cards", "more draw", "drawing cards", "refill", "draw"],
    "Drawing cards, including effects with costs or filtering; not every draw effect is net card advantage.",
    "o:draw",
    ["Divination", "Rhystic Study"],
  ),
  term(
    "cantrip",
    "Cantrips",
    ["cantrips", "cantrip"],
    "Small spells that replace their card, rather than functioning as persistent draw engines.",
    '(t:instant or t:sorcery) o:"draw a card"',
    ["Ponder", "Opt", "Brainstorm"],
  ),
  term(
    "loot",
    "Looting",
    ["looting", "loot"],
    "Draw followed by discard; usually selection rather than automatic card advantage.",
    "o:draw o:discard",
    ["Merfolk Looter", "Faithless Looting"],
  ),
  term(
    "rummage",
    "Rummaging",
    ["rummaging", "rummage"],
    "Discard before drawing, often as an additional cost.",
    "o:discard o:draw",
    ["Thrill of Possibility", "Tormenting Voice"],
  ),
  term(
    "removal",
    "Removal",
    ["spot removal", "targeted removal", "removal", "kill spells"],
    "Effects removing opposing permanents or threats; restrictions and compensation matter.",
    'o:"destroy target" or o:"exile target" or o:"owner of target"',
    ["Swords to Plowshares", "Chaos Warp"],
    { role: "interaction" },
  ),
  term(
    "board-wipe",
    "Board wipes",
    ["board wipes", "board wipe", "sweepers", "sweeper", "wraths", "wrath"],
    "Mass removal, including damage-based sweepers whose coverage depends on the board.",
    'o:"destroy all" or o:"exile all" or o:"damage to each creature"',
    ["Wrath of God", "Blasphemous Act"],
    { role: "wipes" },
  ),
  term(
    "counterspell",
    "Counterspells",
    [
      "counterspells",
      "counterspell",
      "counter spells",
      "permission",
      "stack interaction",
    ],
    "Interaction with spells or abilities on the stack, distinct from counters placed on permanents.",
    'o:"counter target"',
    ["Counterspell", "Arcane Denial"],
    { role: "interaction" },
  ),
  term(
    "permanent-counters",
    "Permanent counters",
    [
      "+1/+1 counters",
      "counter support",
      "counters on creatures",
      "proliferate",
    ],
    "Counters placed on permanents, not counterspells.",
    'o:proliferate or o:"counter on" or o:"+1/+1 counter"',
    ["Hardened Scales", "Evolution Sage"],
  ),
  term(
    "protection",
    "Protection",
    [
      "protection",
      "protect my commander",
      "protect the board",
      "protect my board",
    ],
    "Effects protecting your permanents through granted defenses, regeneration or phasing.",
    'o:hexproof or o:indestructible or o:"phase out" or o:regenerate',
    ["Heroic Intervention", "Swiftfoot Boots"],
    {
      role: "protection",
      caveat:
        "A durable artifact is not automatically protection for your commander.",
    },
  ),
  term(
    "blink",
    "Blink / flicker",
    ["blink", "flicker", "blinking", "flickering"],
    "Exile a permanent and return it to the battlefield; check targets and timing.",
    "o:exile o:return o:battlefield",
    ["Ephemerate", "Flickerwisp"],
  ),
  term(
    "bounce",
    "Bounce",
    ["bounce", "bouncing", "return to hand"],
    "Return battlefield permanents to hand, distinct from returning cards from a graveyard.",
    'o:"return target" o:"owner\'s hand"',
    ["Unsummon", "Cyclonic Rift"],
  ),
  term(
    "recursion",
    "Recursion",
    ["recursion", "recur", "graveyard value"],
    "Recover or replay cards from a graveyard.",
    "o:graveyard (o:return or o:cast or o:play)",
    ["Regrowth", "Eternal Witness"],
  ),
  term(
    "reanimation",
    "Reanimation",
    ["reanimation", "reanimate", "reanimator"],
    "Move creatures or permanents from graveyards directly to the battlefield.",
    "o:graveyard o:return o:battlefield",
    ["Reanimate", "Animate Dead"],
  ),
  term(
    "sacrifice-outlet",
    "Sacrifice outlets",
    ["sacrifice outlets", "sacrifice outlet", "sac outlets", "sac outlet"],
    "Repeatable activated outlets that can sacrifice other relevant permanents.",
    "(t:creature or t:artifact or t:enchantment) o:sacrifice",
    ["Viscera Seer", "Ashnod's Altar"],
    {
      caveat:
        "A self-sacrificing creature or one-shot sacrifice spell is not automatically a reusable outlet.",
    },
  ),
  term(
    "aristocrats",
    "Aristocrats",
    ["aristocrats", "death drain", "death payoffs"],
    "Payoffs for creatures dying, commonly life drain supported by sacrifice engines.",
    '(o:dies or o:die) (o:opponent or o:"gain life")',
    ["Blood Artist", "Zulaport Cutthroat"],
  ),
  term(
    "tokens",
    "Token makers",
    ["token makers", "token generators", "make tokens", "tokens"],
    "Cards making tokens you can use; inspect token type and conditions.",
    "o:create o:token",
    ["Raise the Alarm", "Krenko, Mob Boss"],
  ),
  term(
    "go-wide",
    "Go-wide",
    ["go wide", "go-wide"],
    "Build or reward a large creature board.",
    'o:token or (o:"creatures you control" o:"get +")',
    ["Raise the Alarm", "Overrun"],
  ),
  term(
    "voltron",
    "Voltron",
    ["voltron", "equipment plan", "aura plan"],
    "Support a single major attacker, often with Equipment, Auras and defenses.",
    't:equipment or t:aura or o:"equipped creature"',
    ["Swiftfoot Boots", "All That Glitters"],
  ),
  term(
    "clone",
    "Creature clones",
    [
      "clone",
      "clones",
      "cloning",
      "clone effects",
      "clone creatures",
      "creature clones",
    ],
    "Creature copy effects that enter as a copy of another creature. Copied entry abilities normally trigger when the copy enters; legendary-copy restrictions still apply unless an effect changes them.",
    't:creature o:"copy of" (o:"enter as" or o:"enters as" or o:"enter the battlefield as")',
    ["Spark Double", "Phyrexian Metamorph", "Clone", "Auton Soldier"],
    {
      primaryType: "Creature",
      caveat:
        "Entering as a copy is a replacement effect, not itself an ETB trigger. Check target-sacrifice clauses, copied exceptions and entering-attacking restrictions.",
    },
  ),
  term(
    "etb",
    "Entry triggers",
    ["etb", "etbs", "enters the battlefield", "entry triggers"],
    "Abilities triggered by permanents entering, distinct from cast triggers or attack triggers.",
    "o:enters",
    ["Wall of Omens", "Mulldrifter"],
  ),
  term(
    "death-trigger",
    "Death triggers",
    ["death triggers", "dies triggers", "death trigger"],
    "Triggered effects from creatures dying, not any text mentioning a graveyard.",
    'o:dies or o:"put into a graveyard from the battlefield"',
    ["Blood Artist", "Solemn Simulacrum"],
  ),
  term(
    "tutor",
    "Tutors",
    ["tutors", "tutor", "library search"],
    "Search the library for cards; scrying or looking at a few top cards is different.",
    'o:"search your library"',
    ["Demonic Tutor", "Enlightened Tutor"],
  ),
  term(
    "stax",
    "Stax / taxes",
    ["stax", "tax effects", "taxes", "prison effects"],
    "Effects restricting untaps, casts or searches, or taxing opposing spells.",
    'o:"cost" o:more or o:"players can\'t" or o:"can\'t cast more than"',
    ["Rule of Law", "Thalia, Guardian of Thraben"],
  ),
];
const keywords: Record<string, string> = {
  haste: "Allows creatures to act without waiting through summoning sickness.",
  flying: "Restricts which creatures can block.",
  trample: "Can assign excess combat damage beyond blockers.",
  vigilance: "Attacking does not cause the creature to tap.",
  deathtouch: "Damage can destroy creatures regardless of their toughness.",
  lifelink: "Damage also gains life for its source controller.",
  menace: "Requires more than one blocker.",
  reach: "Can block creatures with flying.",
  flash: "Permits casting at instant timing.",
  hexproof: "Restricts opposing targeted effects.",
  indestructible:
    "Prevents destruction but not every way of leaving the battlefield.",
  ward: "Taxes an opposing target, rather than forbidding it.",
  scry: "Look at top library cards and choose top or bottom.",
  surveil: "Look at top cards and choose library or graveyard.",
  mill: "Move top library cards into a graveyard.",
  flashback: "A graveyard casting permission with its own cost.",
  escape: "A graveyard casting permission with additional resource costs.",
  convoke: "Creatures can help pay casting costs.",
  delve: "Graveyard cards can help pay generic costs.",
  storm: "Copies a spell according to earlier spells cast this turn.",
  cascade: "A cast trigger finds an eligible lower-mana spell.",
  annihilator:
    "An attack trigger makes the defending player sacrifice permanents.",
  infect: "Changes relevant damage into poison or counters.",
  toxic: "Adds poison from combat damage according to its value.",
  investigate: "Creates a Clue token.",
  monarch: "A game designation with draw and combat-transfer rules.",
};
for (const [id, definition] of Object.entries(keywords))
  if (!MTG_TERMS.some((t) => t.id === id))
    MTG_TERMS.push(
      term(
        "keyword:" + id,
        id[0].toUpperCase() + id.slice(1),
        [id],
        definition,
        "o:" + id,
        [],
      ),
    );
export interface TermResolution {
  include: string[];
  exclude: string[];
  preserve: string[];
  anyOf?: string[][];
  freeSacrifice?: boolean;
  corrections: string[];
  clarifications: string[];
  noTapped: boolean;
  noConditional: boolean;
  mode: "explain" | "upgrade" | "conversation";
  recognized: {
    id: string;
    label: string;
    definition: string;
    caveat?: string;
    examples: string[];
  }[];
}
export const termById = (id: string) => MTG_TERMS.find((t) => t.id === id);
const normal = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‐‑–—-]/g, " ")
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function oneEdit(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0,
    j = 0,
    n = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++n > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return n + (i < a.length || j < b.length ? 1 : 0) === 1;
}
export function resolveMTGTerms(
  input: string,
  context?: { commander?: Card },
): TermResolution {
  const text = normal(input),
    r: TermResolution = {
      include: [],
      exclude: [],
      preserve: [],
      corrections: [],
      clarifications: [],
      noTapped:
        /\b(?:no|without|avoid|not) (?:any )?(?:enters? )?tapped\b/.test(text),
      noConditional: /\b(?:no|without|avoid) conditional\b/.test(text),
      mode: /\bwhat(?:'s|s| (?:is|are|does|do|exactly is))|\bexplain\b|\bdefine\b|difference between/.test(
        text,
      )
        ? "explain"
        : /\bmore|\badd|\bfind|\brecommend|\bneed|\bwant|\bupgrade|\breplace|\bsuggest|\buse\b/.test(
              text,
            )
          ? "upgrade"
          : "conversation",
      recognized: [],
    };
  if (/\b(?:enter|enters|come in) untapped\b/.test(text)) r.noTapped = true;
  const hits: {
    term: MTGTerm;
    start: number;
    end: number;
    phrase: string;
    typo: boolean;
  }[] = [];
  for (const t of MTG_TERMS) {
    for (const alias of t.aliases) {
      const a = normal(alias),
        rx = new RegExp("(^|[^a-z0-9])(" + esc(a) + ")(?=$|[^a-z0-9])", "g");
      for (const m of text.matchAll(rx))
        hits.push({
          term: t,
          start: m.index! + m[1].length,
          end: m.index! + m[0].length,
          phrase: a,
          typo: false,
        });
    }
  }
  const words = [...text.matchAll(/[a-z0-9+/]+/g)];
  for (const t of MTG_TERMS)
    for (const alias of t.aliases) {
      const a = normal(alias);
      if (
        a.replace(/\s/g, "").length < 7 ||
        hits.some((h) => h.term.id === t.id)
      )
        continue;
      const n = a.split(" ").length;
      for (let i = 0; i + n <= words.length; i++) {
        const part = words.slice(i, i + n),
          phrase = part.map((m) => m[0]).join(" ");
        if (phrase !== a && oneEdit(phrase, a))
          hits.push({
            term: t,
            start: part[0].index!,
            end: part[part.length - 1].index! + part[part.length - 1][0].length,
            phrase,
            typo: true,
          });
      }
    }
  hits.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const chosen: typeof hits = [];
  for (const h of hits)
    if (!chosen.some((c) => h.start < c.end && h.end > c.start)) chosen.push(h);
  for (const h of chosen) {
    const before = text.slice(Math.max(0, h.start - 70), h.start),
      after = text.slice(h.end, h.end + 20),
      segment = before.split(/[,;.]/).slice(-1)[0] || "";
    const preserving =
      /\b(?:keep|preserve|retain|don't cut|do not cut|don't remove|do not remove)\s+(?:(?:my|the|our|all|existing|current)\s+)*$/.test(
        segment,
      );
    const negated =
      /\b(?:no|not|without|avoid|don't (?:add|use|want)|do not (?:add|use|want))\s+(?:(?:any|more|new)\s+)*$/.test(
        segment,
      ) ||
      (/\b(?:no|without|avoid)\b[^.;]*\bor\s*$/.test(segment) &&
        !/\btapped\b|\bconditional\b/.test(segment));
    const contextOnly =
      /^\s+(?:deck|strategy|plan|theme)\b/.test(after) &&
      !/(?:more|add|need|want)\s*$/.test(segment);
    const bucket = preserving
      ? r.preserve
      : negated
        ? r.exclude
        : contextOnly
          ? null
          : r.include;
    if (bucket && !bucket.includes(h.term.id)) bucket.push(h.term.id);
    if (h.typo)
      r.corrections.push(
        "Interpreted “" + h.phrase + "” as " + h.term.label + ".",
      );
    if (!r.recognized.some((t) => t.id === h.term.id))
      r.recognized.push({
        id: h.term.id,
        label: h.term.label,
        definition: h.term.definition,
        caveat: h.term.caveat,
        examples: h.term.examples,
      });
  }
  if (
    /\bcounters\b/.test(text) &&
    !r.include.includes("counterspell") &&
    !r.include.includes("permanent-counters")
  ) {
    if (
      /\+1\/\+1|on (?:my |the )?creatures|proliferate/.test(text) ||
      /\+1\/\+1 counter|proliferate/i.test(
        context?.commander?.oracle_text || "",
      )
    )
      r.include.push("permanent-counters");
    else
      r.clarifications.push(
        "By “counters”, do you mean counterspells on the stack, or counters placed on permanents such as +1/+1 counters?",
      );
  }
  if (
    r.include.includes("ramp") &&
    r.include.some((id) => ["mana-rock", "mana-dork", "land-ramp"].includes(id))
  )
    r.include = r.include.filter((id) => id !== "ramp");
  if (r.include.includes("recursion") && r.include.includes("reanimation"))
    r.include = r.include.filter((id) => id !== "recursion");
  if (
    r.include.includes("card-draw") &&
    r.include.some((id) => ["cantrip", "loot", "rummage"].includes(id))
  )
    r.include = r.include.filter((id) => id !== "card-draw");
  if (r.include.length > 1 && /\bor\b/.test(text)) r.anyOf = [[...r.include]];
  if (/\bfree (?:sac|sacrifice) outlets?\b/.test(text)) r.freeSacrifice = true;
  if (/\bthe rock deck\b/.test(text))
    r.clarifications.push(
      "Do you mean The Rock archetype, or mana-producing artifact rocks?",
    );
  if (
    /\bexpensive|\bcheap(?:er)?\b/.test(text) &&
    !/\$|usd|budget|price|money|mana value|mana cost|\bcmc\b|\bmv\b|(?:\d+|one|two|three|four|five)\s+mana/.test(
      text,
    )
  )
    r.clarifications.push(
      "By expensive or cheap, do you mean mana value or purchase price?",
    );
  if (
    r.mode !== "explain" &&
    r.include.length > 1 &&
    !r.anyOf &&
    !/\bthat\b|\balso\b|\bboth\b|\bwith\b/.test(text) &&
    /\band\b|\bor\b/.test(text)
  )
    r.clarifications.push(
      "Should each addition have all these functions, or do you want a mix of separate roles? Ask for one role at a time, or say “cards that also…” for an intersection.",
    );
  return r;
}
export function matchesMTGTerm(card: Card, id: string) {
  const facts = cardFunctionFacts(card);
  if (id.startsWith("keyword:"))
    return new RegExp("\\b" + esc(id.slice(8)) + "\\b", "i").test(
      card.card_faces?.[0]?.oracle_text || card.oracle_text || "",
    );
  return facts.flags[id] === true;
}
export function glossaryQuery(ids: string[]) {
  return ids
    .map((id) => termById(id)?.query)
    .filter(Boolean)
    .map((q) => "(" + q + ")")
    .join(" ");
}

export function glossaryTypeText(text: string) {
  let result = normal(text);
  for (const alias of [
    ...new Set(MTG_TERMS.flatMap((t) => t.aliases.map(normal))),
  ].sort((a, b) => b.length - a.length))
    result = result.replace(
      new RegExp("(^|[^a-z0-9])" + esc(alias) + "(?=$|[^a-z0-9])", "g"),
      "$1 ",
    );
  return result;
}
