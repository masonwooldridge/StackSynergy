import {
  resolveMTGTerms,
  glossaryTypeText,
  matchesMTGTerm,
  termById,
  glossaryQuery,
  type TermResolution,
} from "./mtgGlossary";
import { cardFunctionFacts } from "./mtgCardFunctions";
import type { Card, Document } from "./model";
import type { UpgradePlan } from "./deckUpgrade";
import { frontFaceType } from "./landAllocation";
export type CardCriterion = {
  mechanics?: string[];
  anyMechanics?: string[][];
  excludedMechanics?: string[];
  preserveMechanics?: string[];
  noTapped?: boolean;
  noConditional?: boolean;
  freeSacrifice?: boolean;
  manaColors?: string[];
  allManaColors?: boolean;
  commanderIdentity?: string[];
  mode?: string;
  types: string[];
  manaValue?: number;
  relation: "exact" | "min" | "max";
  excludedTypes: string[];
};
export interface AIRequest extends CardCriterion {
  intent: "increase" | "replace";
  minimumIncrease: number;
  cutMatch?: CardCriterion;
  purchaseBudget?: number;
  unitPriceCap?: number;
  ownedOnly?: boolean;
  errors: string[];
  impliedType?: string;
  terminology?: TermResolution;
  clarifications?: string[];
}
const numbers: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};
const numeric =
    "(?:\\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)",
  typeWords =
    "(?:creatures?|artifacts?|enchantments?|instants?|sorceries|sorcery|planeswalkers?|lands?)";
const toNumber = (s: string) => numbers[s.toLowerCase()] ?? Number(s);
const types = (s: string) => [
  ...new Set(
    (s.toLowerCase().match(new RegExp(typeWords, "g")) || []).map((t) =>
      t === "sorceries"
        ? "Sorcery"
        : t.replace(/s$/, "").replace(/^./, (c) => c.toUpperCase()),
    ),
  ),
];
export function hasIncreaseTarget(c: CardCriterion) {
  return (
    c.mode !== "explain" &&
    (c.manaValue !== undefined ||
      c.types.length > 0 ||
      !!c.mechanics?.length ||
      !!c.anyMechanics?.length)
  );
}
export function hasCardCriterion(c: CardCriterion) {
  return (
    c.mode !== "explain" &&
    (hasIncreaseTarget(c) ||
      c.excludedTypes.length > 0 ||
      !!c.excludedMechanics?.length ||
      !!c.noTapped ||
      !!c.noConditional ||
      !!c.manaColors?.length ||
      !!c.freeSacrifice)
  );
}

function spec(
  value: string,
  relation: string | undefined,
  plus: string | undefined,
  typeText: string,
): CardCriterion {
  let n = toNumber(value);
  let mode: CardCriterion["relation"] = "exact";
  if (plus || /at least|or more|more than/.test(relation || "")) mode = "min";
  if (/at most|or less|under|less than/.test(relation || "")) mode = "max";
  if (/more than/.test(relation || "")) n++;
  if (/under|less than/.test(relation || "")) n--;
  return {
    types: types(typeText),
    manaValue: n,
    relation: mode,
    excludedTypes: [],
  };
}
export function parseAIRequest(
  turns: { role: string; content: string }[],
  context?: { commander?: Card },
): AIRequest {
  let request: AIRequest = {
    types: [],
    excludedTypes: [],
    relation: "exact",
    intent: "increase",
    minimumIncrease: 1,
    errors: [],
  };
  for (const turn of turns.filter((t) => t.role === "user")) {
    let text = turn.content.toLowerCase().replace(/[–—‑]/g, "-");
    text = text
      .replace(
        new RegExp("(" + numeric + ")([ -]+mana)\\s+or less", "gi"),
        "at most $1 mana",
      )
      .replace(
        new RegExp("(" + numeric + ")([ -]+mana)\\s+or more", "gi"),
        "at least $1 mana",
      );
    const terms = resolveMTGTerms(turn.content, context);
    request.mode = terms.mode;
    request.clarifications = terms.clarifications;
    const hasNew = terms.include.length > 0;
    if (hasNew) {
      request.mechanics = terms.anyOf ? [] : terms.include;
      request.anyMechanics = terms.anyOf;
      request.terminology = terms;
      const inferred = [
        ...new Set(
          terms.include.map((id) => termById(id)?.primaryType).filter(Boolean),
        ),
      ] as string[];
      if (inferred.length === 1 && !new RegExp(typeWords, "i").test(text))
        request.types = inferred;
      else if (!new RegExp(typeWords, "i").test(text)) request.types = [];
    } else if (terms.mode === "explain" || terms.recognized.length)
      request.terminology = terms;
    const explicitlyAllowed = terms.include.filter((id) => {
      if (/\b(?:not|never|don.t|do not)\s+(?:allow|permit)\b/i.test(text))
        return false;
      return termById(id)?.aliases.some((alias) => {
        const phrase = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp("\\b(?:allow|permit)\\s+" + phrase + "\\b", "i").test(
          text,
        );
      });
    });
    request.excludedMechanics = request.excludedMechanics?.filter(
      (id) => !explicitlyAllowed.includes(id),
    );
    request.excludedMechanics = [
      ...new Set([...(request.excludedMechanics || []), ...terms.exclude]),
    ];
    request.mechanics = request.mechanics?.filter(
      (id) => !terms.exclude.includes(id),
    );
    request.preserveMechanics = [
      ...new Set([...(request.preserveMechanics || []), ...terms.preserve]),
    ];
    if (terms.noTapped) request.noTapped = true;
    if (terms.noConditional) request.noConditional = true;
    if (terms.freeSacrifice) request.freeSacrifice = true;
    if (/allow tapped|tapped is (?:ok|fine)/i.test(text))
      request.noTapped = false;
    if (context?.commander)
      request.commanderIdentity = context.commander.color_identity;
    const colors = [
      ...text.matchAll(/\b(white|blue|black|red|green|colorless)\b/g),
    ].map((m) => ({ word: m[1], index: m.index! }));
    if (
      colors.length &&
      /(?:produce|make|add|tap for)[^.]*?(?:white|blue|black|red|green|colorless)|(?:white|blue|black|red|green|colorless)(?: or (?:white|blue|black|red|green|colorless))? mana/i.test(
        text,
      )
    ) {
      const map: Record<string, string> = {
        white: "W",
        blue: "U",
        black: "B",
        red: "R",
        green: "G",
        colorless: "C",
      };
      request.manaColors = [...new Set(colors.map((c) => map[c.word]))];
      request.allManaColors = /\band\b/.test(
        text.slice(colors[0].index, colors[colors.length - 1].index),
      );
    }

    const found: { criterion: CardCriterion; index: number }[] = [];
    const pattern = new RegExp(
      "\\b(?:(exactly|at least|at most|under|more than|less than)\\s+)?(" +
        numeric +
        ")(\\+)?(?:\\s*(or more|or less))?[ -]*(?:mana(?:[ -]+value)?|cmc|drops?)(?:[ -]+(" +
        typeWords +
        "(?:[ -]+" +
        typeWords +
        ")?))?",
      "gi",
    );
    for (const m of text.matchAll(pattern))
      found.push({
        criterion: spec(m[2], m[1] || m[4], m[3], m[5] || ""),
        index: m.index!,
      });
    const reverse = new RegExp(
      "(" +
        typeWords +
        "(?:[ -]+" +
        typeWords +
        ")?)\\s+(?:with|of|at)\\s+(?:a\\s+)?(?:mana value|cmc)\\s*(exactly|at least|at most|of|=)?\\s*(" +
        numeric +
        ")",
      "gi",
    );
    for (const m of text.matchAll(reverse))
      found.push({
        criterion: spec(m[3], m[2], undefined, m[1]),
        index: m.index!,
      });
    const costAfterType = new RegExp(
      "(" +
        typeWords +
        ")\\s+(?:at|costing|that cost)\\s*(exactly|at least|at most)?\\s*(" +
        numeric +
        ")(?:[ -]+mana)?",
      "gi",
    );
    for (const m of text.matchAll(costAfterType))
      found.push({
        criterion: spec(m[3], m[2], undefined, m[1]),
        index: m.index!,
      });
    if (!found.length && request.manaValue !== undefined) {
      const follow = new RegExp(
        "(?:make (?:them|those)|instead (?:use|make)|i mean)\\s+(?:exactly\\s+)?(" +
          numeric +
          ")(?:[ -]+mana)?\\b",
        "i",
      ).exec(text);
      if (follow)
        found.push({
          criterion: spec(follow[1], undefined, undefined, ""),
          index: follow.index,
        });
    }
    found.sort((a, b) => a.index - b.index);
    const replacing = /\b(?:replace|replacing|swap out|swap my)\b/.test(text),
      increasing =
        /\badd more\b|\bincrease\b|\bmore\s+(?:exactly\s+)?(?:\d+|five|six|four|three|two|seven|eight|nine|ten)[ -]*(?:mana|drops?)/.test(
          text,
        );
    if (found.length) {
      request.errors = [];
      if (
        found.some((f) =>
          /\bnot\s*$/.test(text.slice(Math.max(0, f.index - 8), f.index)),
        )
      )
        request.errors.push(
          "Specify the mana value you do want; a negated cost cannot be treated as an exact addition request.",
        );
      if (
        found.length > 1 &&
        new Set(
          found.map((f) => f.criterion.manaValue + ":" + f.criterion.relation),
        ).size > 1 &&
        !(replacing && /\bwith\b/.test(text))
      )
        request.errors.push(
          "This request contains conflicting mana values. Choose one exact target, or say which group to replace with which.",
        );
      const last = found[found.length - 1].criterion;
      const typed = found.find(
        (f) =>
          f.criterion.manaValue === last.manaValue &&
          f.criterion.relation === last.relation &&
          f.criterion.types.length,
      )?.criterion;
      const target = {
        ...last,
        types: last.types.length ? last.types : typed?.types || [],
      };
      request = {
        ...request,
        ...target,
        types: target.types.length ? target.types : request.types,
        excludedTypes: request.excludedTypes,
      };
      if (replacing && found.length > 1 && /\bwith\b/.test(text))
        request.cutMatch = found[0].criterion;
      else if (replacing && !/\bwith\b/.test(text))
        request.cutMatch = {
          ...target,
          types: target.types.length ? target.types : request.types,
        };
      else request.cutMatch = undefined;
      if (target.manaValue! < 0 || target.manaValue! > 30)
        request.errors.push("Use a mana value from 0 to 30.");
    } else {
      const explicitType = new RegExp(
        "(?:more|add|only|instead|make them)\\s+(" +
          typeWords +
          "(?:[ -]+" +
          typeWords +
          ")?)\\b",
        "i",
      ).exec(text);
      if (explicitType) request.types = types(explicitType[1]);
    }
    if (replacing && !increasing) request.intent = "replace";
    else if (increasing || (/\badd\b/.test(text) && hasCardCriterion(request)))
      request.intent = "increase";
    if (
      replacing &&
      !found.length &&
      /replace (?:them|those|these)|replace instead/i.test(text) &&
      hasCardCriterion(request)
    )
      request.cutMatch = {
        types: [...request.types],
        excludedTypes: [...request.excludedTypes],
        manaValue: request.manaValue,
        relation: request.relation,
      };
    const amount = new RegExp(
      "\\badd\\s+(one|two|three|four|five|\\d+)\\s+(?:more\\s+)?(?=" +
        numeric +
        "[ -]*(?:mana|drops?))",
      "i",
    ).exec(text);
    if (amount) request.minimumIncrease = toNumber(amount[1]);
    if (request.minimumIncrease > 3 || request.minimumIncrease < 1)
      request.errors.push(
        "A review supports one to three swaps. Choose at most three additions.",
      );
    if (hasNew) {
      const explicit = types(glossaryTypeText(text));
      const inferred = [
        ...new Set(
          terms.include.map((id) => termById(id)?.primaryType).filter(Boolean),
        ),
      ] as string[];
      request.types = explicit.length
        ? explicit
        : inferred.length === 1 && !terms.anyOf
          ? [inferred[0]]
          : [];
      request.impliedType =
        !explicit.length && request.types.length === 1
          ? request.types[0]
          : undefined;
    } else if (
      !request.mechanics?.length &&
      !request.anyMechanics?.length &&
      request.impliedType
    ) {
      request.types = request.types.filter((t) => t !== request.impliedType);
      request.impliedType = undefined;
    }
    const exclusion = new RegExp(
      "(?:not|no|non-?)\\s*(" + typeWords + ")",
      "gi",
    );
    for (const m of glossaryTypeText(text).matchAll(exclusion))
      request.excludedTypes = [
        ...new Set([...request.excludedTypes, ...types(m[1])]),
      ];
    if (request.types.some((t) => request.excludedTypes.includes(t)))
      request.errors.push(
        "The requested type is also excluded. Clarify the type before requesting swaps.",
      );
    const price =
      /(?:budget(?: is| of)?|under|up to|at most|max(?:imum)?|no more than)\s*\$\s*(\d+(?:\.\d{1,2})?)(\s*(?:each|per card|apiece))?/gi;
    for (const m of text.matchAll(price)) {
      const limit = Math.max(
        0,
        Number(m[1]) - (m[0].toLowerCase().startsWith("under") ? 0.01 : 0),
      );
      if (m[2]) request.unitPriceCap = limit;
      else request.purchaseBudget = limit;
    }
    if (
      /owned only|only (?:use )?(?:cards? )?(?:i own|owned)|(?:collection|binder) only|use only[^.\n]{0,30}(?:owned|collection|binder)/i.test(
        text,
      )
    )
      request.ownedOnly = true;
    else if (/allow (?:buying|purchases)|buy cards instead/i.test(text))
      request.ownedOnly = false;
  }
  return request;
}
export function matchesAIRequest(card: Card, c: CardCriterion) {
  const facts = cardFunctionFacts(card);
  if (
    c.mechanics?.some((id) => !matchesMTGTerm(card, id)) ||
    c.anyMechanics?.some(
      (group) => !group.some((id) => matchesMTGTerm(card, id)),
    ) ||
    c.excludedMechanics?.some((id) => matchesMTGTerm(card, id)) ||
    (c.noTapped && facts.mana.entersTapped) ||
    (c.noConditional && facts.mana.conditionalMana) ||
    (c.freeSacrifice && !facts.flags["free-sacrifice-outlet"])
  )
    return false;
  if (c.manaColors?.length) {
    let colors = facts.mana.colors;
    if (
      /commander.s colou?r identity/i.test(card.oracle_text || "") &&
      c.commanderIdentity
    )
      colors = colors.filter((k) => c.commanderIdentity!.includes(k));
    if (
      c.allManaColors
        ? !c.manaColors.every((k) => colors.includes(k))
        : !c.manaColors.some((k) => colors.includes(k))
    )
      return false;
  }
  if (
    c.commanderIdentity?.length === 0 &&
    /commander.s colou?r identity/i.test(card.oracle_text || "") &&
    c.mechanics?.some((id) => ["ramp", "mana-rock", "mana-dork"].includes(id))
  )
    return false;
  const type = frontFaceType(card);
  if (
    c.types.some((t) => !new RegExp("\\b" + t + "\\b", "i").test(type)) ||
    c.excludedTypes.some((t) => new RegExp("\\b" + t + "\\b", "i").test(type))
  )
    return false;
  if (c.manaValue === undefined) return true;
  if (typeof card.cmc !== "number" || !Number.isFinite(card.cmc)) return false;
  return c.relation === "min"
    ? card.cmc >= c.manaValue
    : c.relation === "max"
      ? card.cmc <= c.manaValue
      : card.cmc === c.manaValue;
}
export function requestSummary(r: AIRequest) {
  const cost =
    r.manaValue === undefined
      ? ""
      : r.relation === "exact"
        ? "mana value exactly " + r.manaValue
        : r.relation === "min"
          ? "mana value at least " + r.manaValue
          : "mana value at most " + r.manaValue;
  return [
    r.mode === "explain"
      ? "Discussion only"
      : r.types.length
        ? r.types.join(" ") + " cards"
        : "Cards",
    ...(r.mechanics || []).map((id) => termById(id)?.label || id),
    ...(r.anyMechanics || []).map((g) =>
      g.map((id) => termById(id)?.label || id).join(" or "),
    ),
    ...(r.excludedMechanics || []).map(
      (id) => "no " + (termById(id)?.label || id),
    ),
    r.noTapped ? "must not enter tapped" : "",
    r.noConditional ? "no conditional mana" : "",
    r.freeSacrifice ? "no mana activation cost for sacrifice" : "",
    r.manaColors?.length
      ? "produces " + r.manaColors.join(r.allManaColors ? " and " : " or ")
      : "",

    cost,
    r.intent === "increase" && hasIncreaseTarget(r)
      ? "increase their count by at least " + r.minimumIncrease
      : r.intent === "replace"
        ? "replace matching slots"
        : "",
    r.ownedOnly ? "owned additions only" : "",
    r.purchaseBudget !== undefined
      ? "new-purchase cap $" + r.purchaseBudget.toFixed(2)
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
export function countAIRequest(deck: Document, r: CardCriterion) {
  return deck.entries
    .filter((e) => e.board === "mainboard" && matchesAIRequest(e.card, r))
    .reduce((n, e) => n + e.qty, 0);
}
export function pairMatchesAIRequest(cut: Card, add: Card, r: AIRequest) {
  return (
    !(r.preserveMechanics || []).some(
      (id) => matchesMTGTerm(cut, id) && !matchesMTGTerm(add, id),
    ) &&
    matchesAIRequest(add, r) &&
    (!r.cutMatch || matchesAIRequest(cut, r.cutMatch)) &&
    !(
      r.intent === "increase" &&
      hasIncreaseTarget(r) &&
      matchesAIRequest(cut, r)
    )
  );
}
export function assertAIRequest(
  original: Document,
  next: Document,
  plan: UpgradePlan,
  ids: string[],
  r: AIRequest,
) {
  if (r.errors.length) throw Error(r.errors.join(" "));
  for (const p of plan.pairs.filter((p) => ids.includes(p.id))) {
    const cut = original.entries.find((e) => e.id === p.cutId);
    if (!cut || !pairMatchesAIRequest(cut.card, p.add, r))
      throw Error(
        "Selected swaps do not meet your exact card type/mana request. Nothing saved.",
      );
    if (r.unitPriceCap !== undefined && p.purchase > r.unitPriceCap)
      throw Error("A selected addition exceeds your per-card purchase cap.");
  }
  if (
    r.intent === "increase" &&
    hasIncreaseTarget(r) &&
    countAIRequest(next, r) - countAIRequest(original, r) < r.minimumIncrease
  )
    throw Error(
      "Selected swaps must increase the requested group by at least " +
        r.minimumIncrease +
        ". Do not cut the same number of matching cards.",
    );
}
export function requestQuery(r: AIRequest) {
  return [
    ...r.types.map((t) => "t:" + t.toLowerCase()),
    glossaryQuery(r.mechanics || []),
    ...(r.anyMechanics || []).map(
      (g) =>
        "(" + g.map((id) => "(" + glossaryQuery([id]) + ")").join(" or ") + ")",
    ),
    ...r.excludedTypes.map((t) => "-t:" + t.toLowerCase()),
    r.manaValue === undefined
      ? ""
      : "mv" +
        (r.relation === "exact" ? "=" : r.relation === "min" ? ">=" : "<=") +
        r.manaValue,
  ]
    .filter(Boolean)
    .join(" ");
}
