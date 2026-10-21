import { deploymentCost } from "./deploymentCost";
import {
  normalizeBuildIntent,
  tokenProductionProfile,
  productionAudit,
  type BuildIntent,
} from "./tokenPlan";
import { packageTargets, packageMatches } from "./themePackages";
import { isLandSlot, frontFaceType } from "./landAllocation";
import {
  constructionRoles,
  constructionTargets,
  roleBudgetShares,
  supportQuality,
  type ConstructionRole,
} from "./constructionPlan";
import {
  bracketCheck,
  gameChangerLimit,
  isGameChanger,
  type CommanderBracket,
} from "./commanderBrackets";
import {
  basicManaTargets,
  landManaSources,
  colorlessSupport,
  fitsSelectedColorlessBase,
} from "./basicMana";
import { isMainDeckCard } from "./deckEligibility";
import {
  rankCommanderCards,
  commanderSignals,
  type CardRanking,
} from "./commanderRelevance";
import {
  normalizeSelection,
  selectionMatches,
  type StrategySelection,
} from "./strategySelection";
import {
  mechanicalPrerequisites,
  conditionalRoleNotes,
} from "./mechanicalSupport";
import { reproductionReason } from "./deckEligibility";
import type { Card, Document, Entry } from "./model";
import { validateDeck } from "./model";
import { newEntry } from "./deckEditing";
import { cardText, suggestionsFor, type Strategy } from "./recommendations";
export type BuildMode = "owned" | "buy" | "mixed";
export type BudgetMeaning = "deck" | "purchases";
export interface BuildOptions {
  intent?: BuildIntent;
  commander: Card;
  bracket?: CommanderBracket;
  candidates: Card[];
  documents: Document[];
  mode: BuildMode;
  budget: number;
  budgetMeaning: BudgetMeaning;
  strategy: Strategy;
  tags?: string[];
  selection?: StrategySelection;
  referenceIds?: string[];
  fetchedAt: string;
}
export interface BuildResult {
  construction?: {
    intent?: BuildIntent;
    production?: ReturnType<typeof productionAudit>;
    packages?: { name: string; count: number; target: number }[];
    roles: {
      role: string;
      count: number;
      target: number | null;
      market: number | null;
      purchases: number | null;
    }[];
    warnings: string[];
    maxPurchase: number;
    budgetUsed: number | null;
  };
  complete: boolean;
  document: Document;
  errors: string[];
  explanation: string;
  missing: { card: Card; qty: number; unitPrice: number | null }[];
  estimatedDeck: number | null;
  estimatedPurchases: number | null;
  fetchedAt: string;
  excludedUnknown: number;
  recommendationAudit: {
    card: Card;
    included: boolean;
    score: number;
    reasons: string[];
    decision: string;
  }[];
}
export const oracleKey = (c: Card) => c.oracle_id || c.name.toLowerCase();
export function buildQuote(c: Card): number | null {
  const finish = c.finishes?.includes("nonfoil")
    ? "nonfoil"
    : c.finishes?.[0] || "nonfoil";
  const value =
    c.prices?.[
      finish === "foil"
        ? "usd_foil"
        : finish === "etched"
          ? "usd_etched"
          : "usd"
    ];
  return typeof value === "string" &&
    value.trim() &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0
    ? Number(value)
    : null;
}
export function copyLimit(card: Card) {
  const text = cardText(card);
  if (
    /\bBasic\b/.test(frontFaceType(card)) ||
    /deck can have any number of cards named/i.test(text)
  )
    return 100;
  const match = text.match(/deck can have up to (\w+) cards named/i);
  if (match) {
    const numbers: Record<string, number> = { seven: 7, nine: 9 };
    return numbers[match[1]] || Number(match[1]) || 1;
  }
  return 1;
}
export function buildCommanderDeck(o: BuildOptions): BuildResult {
  const intent = normalizeBuildIntent(o.intent);
  const castTypes = commanderSignals([o.commander]).castTypes;
  const castFit = (card: Card, role?: ConstructionRole) =>
    castTypes.some((type) =>
      new RegExp("\\b" + type + "\\b").test(frontFaceType(card)),
    )
      ? role && ["interaction", "wipes", "protection"].includes(role)
        ? 12
        : 24
      : 0;
  const errors: string[] = [];
  if (!Number.isFinite(o.budget) || o.budget < 0)
    throw Error("Enter a non-negative USD budget.");
  const colors = new Set(o.commander.color_identity || []);
  const legal = (c: Card) =>
    isMainDeckCard(c) &&
    !reproductionReason(c) &&
    c.legalities?.commander === "legal" &&
    Array.isArray(c.color_identity) &&
    !!c.type_line &&
    c.color_identity.every((color) => colors.has(color));
  const verifiedById = new Map(
    [o.commander, ...o.candidates].map((c) => [c.id, c]),
  );
  const owned = new Map<string, number>();
  for (const d of o.documents.filter(
    (d) => d.kind === "collection" && !d.deleted,
  ))
    for (const e of d.entries) {
      const facts = verifiedById.get(e.card.id);
      if (facts)
        owned.set(oracleKey(facts), (owned.get(oracleKey(facts)) || 0) + e.qty);
    }
  const pool = new Map<string, Card>();
  for (const c of [o.commander, ...o.candidates])
    if (
      legal(c) &&
      !/(?:companion|rulebreaker|choose a colou?r|deck can contain)/i.test(
        cardText(c),
      )
    ) {
      const key = oracleKey(c),
        old = pool.get(key);
      if (!old || (buildQuote(c) ?? Infinity) < (buildQuote(old) ?? Infinity))
        pool.set(key, c);
    }
  const chosen = new Map<string, { card: Card; qty: number }>(),
    used = new Map<string, number>();
  let spent = 0,
    unknown = 0;
  const cost = (c: Card) =>
    o.budgetMeaning === "purchases" &&
    o.mode !== "buy" &&
    (used.get(oracleKey(c)) || 0) < (owned.get(oracleKey(c)) || 0)
      ? 0
      : buildQuote(c);
  const can = (c: Card) => {
    if (
      oracleKey(c) !== oracleKey(o.commander) &&
      !isLandSlot(c) &&
      mechanicalPrerequisites(
        c,
        [...chosen.values()].map((e) => e.card),
        [o.commander],
      ).length
    )
      return false;
    const key = oracleKey(c),
      n = used.get(key) || 0;
    if (
      o.bracket &&
      isGameChanger(c) &&
      [...chosen.values()].reduce(
        (sum, e) => sum + (isGameChanger(e.card) ? e.qty : 0),
        0,
      ) >= gameChangerLimit(o.bracket)
    )
      return false;
    if (!legal(c) || n >= copyLimit(c)) return false;
    if (o.mode === "owned" && n >= (owned.get(key) || 0)) return false;
    const price = cost(c);
    return price !== null && spent + price <= o.budget + 1e-8;
  };
  const take = (c: Card) => {
    if (!can(c)) return false;
    const key = oracleKey(c),
      old = chosen.get(key);
    spent += cost(c)!;
    used.set(key, (used.get(key) || 0) + 1);
    chosen.set(key, { card: old?.card || c, qty: (old?.qty || 0) + 1 });
    return true;
  };
  if (!take(o.commander))
    errors.push(
      "Commander is not verified legal/eligible within this budget and ownership mode, or its required USD quote is unavailable.",
    );
  const commanderKey = oracleKey(o.commander);
  const lands = [...pool.values()].filter(
    (c) => isLandSlot(c) && oracleKey(c) !== commanderKey,
  );
  // Reserve a stable 36-land base first; round-robin basic land types supplies each commander color when available.
  const basic = lands
    .filter((c) => /\bBasic\b/.test(c.type_line || ""))
    .sort((a, b) => (buildQuote(a) ?? Infinity) - (buildQuote(b) ?? Infinity));
  const nonbasic = lands
    .filter((c) => !/\bBasic\b/.test(c.type_line || ""))
    .sort((a, b) => (buildQuote(a) ?? Infinity) - (buildQuote(b) ?? Infinity));
  let landCount = 0;
  const manaBudget = o.budget * 0.12;
  let manaSpent = 0;
  if (colors.size > 1) {
    const flexible = nonbasic
      .filter(
        (c) =>
          landManaSources(c, [...colors]).filter((s) => colors.has(s)).length >
            1 &&
          /(?:^|\n)\{T\}: Add[^.\n]*(?:any colou?r|any type|\{[WUBRG]\})/i.test(
            cardText(c),
          ) &&
          !/spend this mana only|activate only|remove an?[^.\n]*counter/i.test(
            cardText(c),
          ),
      )
      .sort((a, b) => {
        const own = (c: Card) =>
          o.mode !== "buy" && (owned.get(oracleKey(c)) || 0) > 0 ? 0 : 1;
        const quality = (c: Card) =>
          landManaSources(c, [...colors]).filter((s) => colors.has(s)).length *
            3 -
          (/enters[^.\n]*tapped/i.test(cardText(c)) ? 8 : 0);
        return (
          own(a) - own(b) ||
          quality(b) - quality(a) ||
          (buildQuote(a) ?? Infinity) - (buildQuote(b) ?? Infinity)
        );
      });
    for (const land of flexible) {
      if (landCount >= Math.min(6, colors.size * 2)) break;
      const price = cost(land);
      if (price !== null && manaSpent + price <= manaBudget && take(land)) {
        landCount++;
        manaSpent += price;
      }
    }
  }
  const initialBasicColors = [
    ...new Set(basic.flatMap((c) => landManaSources(c, [...colors]))),
  ].filter(
    (s) =>
      colors.has(s) ||
      (s === "C" &&
        (colors.size === 0 ||
          o.mode === "owned" ||
          /\{C\}/.test(o.commander.mana_cost || ""))),
  );
  for (let round = 0; round < 100 && landCount < 36; round++) {
    let added = false;
    for (const color of initialBasicColors) {
      const usable = basic
        .filter((c) => landManaSources(c, [...colors]).includes(color))
        .sort((a, b) => {
          const own = (c: Card) =>
            o.mode !== "buy" &&
            (used.get(oracleKey(c)) || 0) < (owned.get(oracleKey(c)) || 0)
              ? 0
              : 1;
          return (
            own(a) - own(b) ||
            (buildQuote(a) ?? Infinity) - (buildQuote(b) ?? Infinity)
          );
        })
        .find((c) => can(c));
      if (landCount < 36 && usable && take(usable)) {
        landCount++;
        added = true;
      }
    }
    if (!added) break;
  }
  for (const land of nonbasic) {
    if (landCount >= 36) break;
    if (take(land)) landCount++;
  }
  if (landCount < 36)
    errors.push(
      `Only ${landCount}/36 lands fit ownership, verified facts and budget. Add owned lands or increase the budget; unknown quotes are not free.`,
    );
  const spells = [...pool.values()].filter(
    (c) => !isLandSlot(c) && oracleKey(c) !== commanderKey,
  );
  const reasons = new Map(
    suggestionsFor(spells, [o.commander], o.strategy).map((s) => [
      oracleKey(s.card),
      s.reasons,
    ]),
  );
  const selection = normalizeSelection(o.selection || { tags: o.tags });
  for (const card of spells) {
    const matching = selectionMatches(card, selection);
    if (matching.length)
      reasons.set(oracleKey(card), [
        ...(reasons.get(oracleKey(card)) || []),
        ...matching.map((tag) => ({
          role: "synergy" as const,
          text: "Rules text/type matches " + tag + ". Review the interaction.",
        })),
      ]);
  }
  const ranked = rankCommanderCards(
    spells,
    [o.commander],
    selection,
    o.referenceIds,
  );
  if (intent.primary === "tokens")
    for (const ranking of ranked) {
      const p = tokenProductionProfile(ranking.card);
      ranking.score +=
        intent.tokenEngine === "lasting"
          ? p.engineScore +
            (p.lastingEngine ? 20 : p.lastingCreatureMaker ? 5 : 0) +
            (p.teamHaste || p.teamPump || p.tokenMultiplier ? 25 : 0)
          : p.ownCreature
            ? p.score
            : p.teamHaste || p.teamPump || p.tokenMultiplier
              ? 35
              : -10;
    }
  const rankMap = new Map(ranked.map((r) => [oracleKey(r.card), r]));
  for (const ranking of ranked)
    if (ranking.score > 0)
      reasons.set(oracleKey(ranking.card), [
        ...(reasons.get(oracleKey(ranking.card)) || []),
        { role: "synergy", text: ranking.reasons.join(" ") },
      ]);
  const sorted = [...spells].sort((a, b) => {
    const ownA = o.mode !== "buy" && (owned.get(oracleKey(a)) || 0) > 0 ? 0 : 1,
      ownB = o.mode !== "buy" && (owned.get(oracleKey(b)) || 0) > 0 ? 0 : 1;
    return (
      ownA - ownB ||
      (rankMap.get(oracleKey(b))?.score || 0) -
        (rankMap.get(oracleKey(a))?.score || 0) ||
      (buildQuote(a) ?? Infinity) - (buildQuote(b) ?? Infinity)
    );
  });
  let spellCount = 0;
  // Reserve the cheapest still-available legal copies for the remaining slots instead of
  // imposing an equal per-slot cap that excludes affordable commander engines.
  const takeSpell = (card: Card) => {
    if (
      !can(card) ||
      !fitsSelectedColorlessBase(card, [...chosen.values()], o.commander)
    )
      return false;
    const price = cost(card)!;
    const needed = 62 - spellCount;
    const prices: number[] = [],
      gcPrices: number[] = [];
    for (const filler of spells) {
      const key = oracleKey(filler),
        already = (used.get(key) || 0) + (key === oracleKey(card) ? 1 : 0);
      const limit = Math.min(copyLimit(filler), already + Math.max(0, needed));
      for (let n = already; n < limit; n++) {
        if (o.mode === "owned" && n >= (owned.get(key) || 0)) break;
        const quote =
          o.budgetMeaning === "purchases" &&
          o.mode !== "buy" &&
          n < (owned.get(key) || 0)
            ? 0
            : buildQuote(filler);
        if (quote !== null)
          (o.bracket && isGameChanger(filler) ? gcPrices : prices).push(quote);
      }
    }
    const gcUsed =
      [...chosen.values()].reduce(
        (sum, e) => sum + (isGameChanger(e.card) ? e.qty : 0),
        0,
      ) + (isGameChanger(card) ? 1 : 0);
    prices.push(
      ...gcPrices
        .sort((a, b) => a - b)
        .slice(
          0,
          o.bracket
            ? Math.max(0, gameChangerLimit(o.bracket) - gcUsed)
            : Infinity,
        ),
    );
    prices.sort((a, b) => a - b);
    if (
      prices.length >= needed &&
      price + prices.slice(0, needed).reduce((sum, p) => sum + p, 0) >
        o.budget - spent + 1e-8
    )
      return false;
    if (
      prices.length < needed &&
      price > (o.budget - spent) / (needed + 1) + 1e-8
    )
      return false;
    return take(card);
  };
  const assigned = new Map<string, ConstructionRole>(),
    roleTargets = constructionTargets(o.commander, intent),
    qualityWarnings: string[] = [];
  const functional = new Map(
    spells.map((c) => [
      oracleKey(c),
      constructionRoles(
        c,
        o.commander,
        [...chosen.values()].map((e) => e.card).concat(c),
      ),
    ]),
  );
  const spellBudget = Math.max(0, o.budget - spent),
    roleSpent = new Map<ConstructionRole, number>();
  const concentration = o.budget <= 25 ? 0.25 : 0.15,
    maxCardSpend = Math.max(1, o.budget * concentration);
  const assignedTake = (card: Card, role: ConstructionRole) => {
    const price = cost(card);
    if (price === null || price > maxCardSpend + 1e-8) return false;
    if (takeSpell(card)) {
      spellCount++;
      if (!assigned.has(oracleKey(card))) assigned.set(oracleKey(card), role);
      roleSpent.set(role, (roleSpent.get(role) || 0) + price);
      return true;
    }
    return false;
  };
  const allocationOrder: Exclude<ConstructionRole, "synergy">[] =
    intent.primary === "tokens"
      ? [
          "production",
          "untap",
          "haste",
          "wipes",
          "protection",
          "interaction",
          "ramp",
          "advantage",
          "finisher",
        ]
      : ["wipes", "protection", "interaction", "ramp", "advantage", "finisher"];
  const shares: Record<ConstructionRole, number> =
    intent.primary === "tokens"
      ? {
          production: intent.tokenEngine === "lasting" ? 0.36 : 0.44,
          untap: intent.tokenEngine === "lasting" ? 0.12 : 0,
          haste: 0.06,
          wipes: 0.06,
          protection: 0.06,
          interaction: 0.1,
          ramp: 0.1,
          advantage: 0.06,
          finisher: 0.1,
          synergy: 0,
        }
      : roleBudgetShares;
  for (const role of allocationOrder) {
    let count = 0;
    const allowance = spellBudget * shares[role];
    const rolePool = spells
      .filter(
        (c) =>
          (functional.set(
            oracleKey(c),
            constructionRoles(
              c,
              o.commander,
              [...chosen.values()].map((e) => e.card).concat(c),
            ),
          ),
          functional.get(oracleKey(c))?.includes(role)) &&
          !(
            intent.tokenEngine === "lasting" &&
            role === "production" &&
            !tokenProductionProfile(c).lastingEngine
          ) &&
          !(
            intent.tokenEngine === "lasting" &&
            tokenProductionProfile(c).temporary
          ) &&
          !(
            intent.primary === "tokens" &&
            role === "finisher" &&
            !tokenProductionProfile(c).teamPump &&
            !tokenProductionProfile(c).tokenMultiplier
          ),
      )
      .sort((a, b) => {
        const own = (c: Card) =>
          o.mode !== "buy" &&
          (owned.get(oracleKey(c)) || 0) > (used.get(oracleKey(c)) || 0)
            ? 0
            : 1;
        return (
          own(a) - own(b) ||
          supportQuality(b, role, o.commander) +
            castFit(b, role) +
            (intent.tokenEngine === "lasting" &&
            ["production", "untap"].includes(role)
              ? tokenProductionProfile(b).engineScore
              : 0) +
            Math.min(12, (rankMap.get(oracleKey(b))?.score || 0) / 4) -
            (supportQuality(a, role, o.commander) +
              castFit(a, role) +
              (intent.tokenEngine === "lasting" &&
              ["production", "untap"].includes(role)
                ? tokenProductionProfile(a).engineScore
                : 0) +
              Math.min(12, (rankMap.get(oracleKey(a))?.score || 0) / 4)) ||
          (buildQuote(a) ?? Infinity) - (buildQuote(b) ?? Infinity)
        );
      });
    for (const card of rolePool) {
      if (count >= roleTargets[role] || spellCount >= 63) break;
      if (assigned.has(oracleKey(card))) continue;
      const price = cost(card);
      if (
        price === null ||
        (roleSpent.get(role) || 0) + price > allowance + 1e-8
      )
        continue;
      if (assignedTake(card, role)) count++;
    }
    if (count < roleTargets[role])
      for (const card of [...rolePool].sort(
        (a, b) => (cost(a) ?? Infinity) - (cost(b) ?? Infinity),
      )) {
        if (count >= roleTargets[role] || spellCount >= 63) break;
        if (assigned.has(oracleKey(card))) continue;
        if (assignedTake(card, role)) count++;
      }
    if (count < roleTargets[role])
      qualityWarnings.push(
        `${role}: only ${count}/${roleTargets[role]} primary slots from this verified pool and budget. Review before play.`,
      );
  }
  const synergyUtility = (card: Card) => {
    const roles = functional.get(oracleKey(card)) || [];
    return roles.length
      ? 20
      : castFit(card) &&
          /draw a card|return[^.\n]*graveyard/i.test(cardText(card))
        ? 10
        : 0;
  };
  const synergyPool = [...sorted]
    .filter(
      (c) =>
        intent.tokenEngine !== "lasting" ||
        !tokenProductionProfile(c).temporary,
    )
    .sort((a, b) => {
      const own = (c: Card) =>
        o.mode !== "buy" &&
        (owned.get(oracleKey(c)) || 0) > (used.get(oracleKey(c)) || 0)
          ? 0
          : 1;
      return (
        own(a) - own(b) ||
        (rankMap.get(oracleKey(b))?.score || 0) +
          synergyUtility(b) -
          ((rankMap.get(oracleKey(a))?.score || 0) + synergyUtility(a)) ||
        (buildQuote(a) ?? Infinity) - (buildQuote(b) ?? Infinity)
      );
    });
  const themes = packageTargets(o.commander),
    themeMembership = new Map(
      spells.map((c) => [oracleKey(c), packageMatches(c, o.commander)]),
    );
  const packageCount = (name: string) =>
    [...chosen.values()].reduce(
      (n, e) =>
        n +
        (themeMembership.get(oracleKey(e.card))?.includes(name) ? e.qty : 0),
      0,
    );
  // Packages can overlap functional roles but never increase card or primary-role counts.
  for (const [name, target] of Object.entries(themes)) {
    for (const card of synergyPool) {
      if (packageCount(name) >= target || spellCount >= 63) break;
      if (!themeMembership.get(oracleKey(card))?.includes(name)) continue;
      assignedTake(card, "synergy");
    }
  }
  for (let round = 0; round < 100 && spellCount < 63; round++) {
    let added = false;
    for (const card of [...synergyPool].sort((a, b) => {
      const score = (c: Card) =>
        (rankMap.get(oracleKey(c))?.score || 0) +
        synergyUtility(c) -
        (castFit(c) &&
        !functional.get(oracleKey(c))?.length &&
        Object.entries(themes).some(
          ([name, target]) =>
            themeMembership.get(oracleKey(c))?.includes(name) &&
            packageCount(name) >= target,
        )
          ? 40
          : 0);
      return (
        score(b) - score(a) ||
        (buildQuote(a) ?? Infinity) - (buildQuote(b) ?? Infinity)
      );
    })) {
      if (spellCount >= 63) break;
      if (assignedTake(card, "synergy")) added = true;
    }
    if (!added) break;
  }
  if (spellCount < 63)
    errors.push(
      `Only ${spellCount}/63 noncommander spells fit the available verified pool, copy limits, ownership and remaining budget. This is an incomplete draft, not a complete deck.`,
    );
  // Exchange basics only after spells are selected. Each single swap goes through the
  // same ownership, price and copy checks; failed swaps restore the exact prior state.
  const basicEntries = () =>
    [...chosen.values()].filter(
      (e) => /\bBasic\b/.test(e.card.type_line || "") && isLandSlot(e.card),
    );
  const targets = basicManaTargets(
    [...chosen.values()],
    [...colors],
    basicEntries().reduce((n, e) => n + e.qty, 0),
    o.commander,
  );
  const basicColor = (c: Card) => {
    const sources = landManaSources(c, [...colors]);
    return sources.length === 1 ? sources[0] : null;
  };
  for (let iteration = 0; iteration < 100; iteration++) {
    const counts: Record<string, number> = {};
    for (const e of basicEntries()) {
      const color = basicColor(e.card);
      if (color) counts[color] = (counts[color] || 0) + e.qty;
    }
    const deficits = Object.keys(targets)
      .filter((c) => (counts[c] || 0) < targets[c])
      .sort(
        (a, b) =>
          targets[b] - (counts[b] || 0) - (targets[a] - (counts[a] || 0)),
      );
    let swapped = false;
    for (const color of deficits) {
      for (const source of basicEntries().filter((e) => {
        const s = basicColor(e.card);
        return s && (counts[s] || 0) > (targets[s] || 0);
      })) {
        const key = oracleKey(source.card),
          qty = used.get(key)!;
        const priorSpent = spent;
        const refund =
          o.budgetMeaning === "purchases" &&
          o.mode !== "buy" &&
          qty <= (owned.get(key) || 0)
            ? 0
            : buildQuote(source.card);
        if (refund === null) continue;
        spent -= refund;
        used.set(key, qty - 1);
        if (source.qty === 1) chosen.delete(key);
        else chosen.set(key, { ...source, qty: source.qty - 1 });
        const replacement = basic
          .filter((c) => basicColor(c) === color)
          .sort((a, b) => {
            const free = (c: Card) =>
              o.mode !== "buy" &&
              (used.get(oracleKey(c)) || 0) < (owned.get(oracleKey(c)) || 0)
                ? 0
                : 1;
            return (
              free(a) - free(b) ||
              (buildQuote(a) ?? Infinity) - (buildQuote(b) ?? Infinity)
            );
          })
          .find((c) => can(c));
        if (replacement && take(replacement)) {
          swapped = true;
          break;
        }
        spent = priorSpent;
        used.set(key, qty);
        chosen.set(key, source);
      }
      if (swapped) break;
    }
    if (!swapped) break;
  }
  const entries: Entry[] = [...chosen.values()].map(({ card, qty }) => ({
    ...newEntry(card),
    qty,
    board: oracleKey(card) === commanderKey ? "commander" : "mainboard",
  }));
  const document: Document = {
    id: crypto.randomUUID(),
    name: o.commander.name + " · constructed draft",
    kind: "deck",
    format: "commander",
    commanderBracket: o.bracket,
    strategy: selection,
    notes:
      "Build intent: " +
      JSON.stringify(intent) +
      ". Selected rules-text tags: " +
      selection.tags.join(", ") +
      ". StackSynergy rules-based builder (not model AI). USD budget " +
      o.budget +
      " for " +
      o.budgetMeaning +
      ". Quote data fetched " +
      o.fetchedAt +
      ". Review card interactions and mana balance.",
    entries,
    revision: 0,
  };
  const validation = validateDeck(document);
  errors.push(...validation.errors, ...validation.warnings);
  let deckTotal = 0,
    purchaseTotal = 0,
    unknownDeck = false,
    unknownPurchase = false;
  const missing: BuildResult["missing"] = [];
  for (const e of entries) {
    const price = buildQuote(e.card),
      available = o.mode === "buy" ? 0 : owned.get(oracleKey(e.card)) || 0,
      needed = Math.max(0, e.qty - available);
    if (price === null) unknownDeck = true;
    else deckTotal += price * e.qty;
    if (needed) {
      missing.push({ card: e.card, qty: needed, unitPrice: price });
      if (price === null) unknownPurchase = true;
      else purchaseTotal += price * needed;
    }
  }
  for (const c of pool.values()) if (buildQuote(c) === null) unknown++;
  const selectedCost =
    o.budgetMeaning === "deck"
      ? unknownDeck
        ? null
        : deckTotal
      : unknownPurchase
        ? null
        : purchaseTotal;
  if (selectedCost === null || selectedCost > o.budget + 1e-8)
    errors.push(
      "The selected budget cannot be verified from current USD quotes.",
    );
  const checkedBracket = bracketCheck(document);
  const primaryRows = [
    "commander",
    "mana",
    "production",
    "untap",
    "haste",
    "ramp",
    "advantage",
    "interaction",
    "wipes",
    "protection",
    "finisher",
    "synergy",
  ].map((role) => {
    let count = 0,
      market = 0,
      purchases = 0,
      unknownMarket = false,
      unknownPurchase = false;
    for (const e of entries) {
      const category =
        e.board === "commander"
          ? "commander"
          : isLandSlot(e.card)
            ? "mana"
            : assigned.get(oracleKey(e.card)) || "synergy";
      if (category !== role) continue;
      count += e.qty;
      const quote = buildQuote(e.card),
        needed =
          missing.find((m) => oracleKey(m.card) === oracleKey(e.card))?.qty ||
          0;
      if (quote === null) unknownMarket = true;
      else market += quote * e.qty;
      if (needed && quote === null) unknownPurchase = true;
      else if (quote !== null) purchases += quote * needed;
    }
    return {
      role,
      count,
      target:
        role in roleTargets
          ? roleTargets[role as keyof typeof roleTargets]
          : null,
      market: unknownMarket ? null : Math.round(market * 100) / 100,
      purchases: unknownPurchase ? null : Math.round(purchases * 100) / 100,
    };
  });
  const packages = Object.entries(themes).map(([name, target]) => ({
    name,
    target,
    count: packageCount(name),
  }));
  for (const p of packages)
    if (p.count < p.target)
      qualityWarnings.push(
        `${p.name}: ${p.count}/${p.target} package slots available. Review the theme before play.`,
      );
  const production = productionAudit(entries);
  if (intent.primary === "tokens") {
    if (intent.tokenEngine === "lasting") {
      if (production.lastingTokenEngines < 16)
        errors.push(
          `Lasting engine plan: only ${production.lastingTokenEngines}/16 persistent repeatable token engines.`,
        );
      if (production.recurringUntapSources < 2)
        errors.push(
          `Lasting engine plan: only ${production.recurringUntapSources}/2 recurring untap sources.`,
        );
      if (production.temporaryCreatureTokenMakers)
        errors.push("Temporary tokens cannot satisfy the lasting engine plan.");
    }
    if (
      intent.tokenEngine !== "lasting" &&
      production.reliableOwnCreatureTokenMakers < 22
    )
      errors.push(
        `Primary token plan: only ${production.reliableOwnCreatureTokenMakers}/22 own creature-token maker cards. Counter-only, opponent-only and ultimate-only cards do not satisfy production.`,
      );
    if (
      intent.tokenEngine !== "lasting" &&
      production.recurringCapableCreatureMakers < 8
    )
      errors.push(
        `Primary token plan: only ${production.recurringCapableCreatureMakers}/8 recurring-capable creature-token sources.`,
      );
    if (production.burstOrScalableCreatureMakers < 5)
      qualityWarnings.push(
        `Only ${production.burstOrScalableCreatureMakers}/5 burst/scalable creature-token sources; review how quickly the deck rebuilds.`,
      );
    if (intent.combat === "large-hasty" && production.teamHasteSources < 3)
      errors.push(
        `Hasty-token combat: only ${production.teamHasteSources}/3 team/token haste sources.`,
      );
    if (
      intent.combat === "large-hasty" &&
      production.teamPumpOrTokenMultipliers < 4
    )
      errors.push(
        `Large-token combat: only ${production.teamPumpOrTokenMultipliers}/4 team pump/token multiplier sources.`,
      );
  }
  for (const entry of entries) {
    const costs = deploymentCost(
      entry.card,
      assigned.get(oracleKey(entry.card)),
      entries.map((e) => e.card),
    );
    if (
      costs.delayedMana ||
      costs.recurringMana ||
      costs.additionalMana ||
      costs.upkeep.some((p) => p.energy)
    )
      qualityWarnings.push(entry.card.name + ": " + costs.notes.join(" "));
  }
  for (const entry of entries)
    for (const note of conditionalRoleNotes(
      entry.card,
      entries.map((e) => e.card),
    ))
      qualityWarnings.push(entry.card.name + ": " + note);
  const colorless = colorlessSupport(entries);
  if (colorless.required.length) qualityWarnings.push(colorless.note);
  if (!colorless.meetsPlanningTarget)
    errors.push(
      `Explicit colorless support: ${colorless.creditedSources}/${colorless.planningTarget} independent sources meet the conservative default planning target. Review the mana base or choose different interaction; generic or conditional mana is not assumed.`,
    );
  const construction = {
    intent,
    production,
    packages,
    roles: primaryRows,
    warnings: qualityWarnings,
    maxPurchase: Math.max(
      0,
      ...missing
        .filter(
          (m) => !isLandSlot(m.card) && oracleKey(m.card) !== commanderKey,
        )
        .map((m) => m.unitPrice || 0),
    ),
    budgetUsed: selectedCost,
  };
  const counts = primaryRows
    .filter((r) => r.target !== null)
    .map((r) => `${r.role}: ${r.count}/${r.target}`)
    .join(", ");
  const auditRankings: CardRanking[] = rankCommanderCards(
    [...new Map(o.candidates.map((c) => [oracleKey(c), c])).values()],
    [o.commander],
    selection,
    o.referenceIds,
  )
    .filter((r) => r.score > 0)
    .slice(0, 30);
  const recommendationAudit = auditRankings.map((r) => {
    const key = oracleKey(r.card),
      included = chosen.has(key),
      candidate = pool.get(key) || r.card;
    let decision =
      "Not selected after commander-core, role and budget allocation.";
    if (included) decision = "Included in the constructed deck.";
    else if (!isMainDeckCard(candidate))
      decision = "Auxiliary/non-paper card; excluded from the deck.";
    else if (
      o.bracket &&
      isGameChanger(candidate) &&
      checkedBracket.count >= gameChangerLimit(o.bracket)
    )
      decision = "Selected bracket Game Changer limit reached.";
    else if (!legal(candidate))
      decision = "Outside commander colors or not legal in Commander.";
    else if (o.mode === "owned" && !(owned.get(key) || 0))
      decision = "Not owned in an active binder; collection-only mode.";
    else if (
      buildQuote(candidate) === null &&
      !(
        o.budgetMeaning === "purchases" &&
        o.mode !== "buy" &&
        (owned.get(key) || 0) > 0
      )
    )
      decision = "Required USD quote unavailable.";
    else if ((cost(candidate) ?? Infinity) > o.budget - spent + 1e-8)
      decision = "Does not fit the budget remaining after allocation.";
    return { ...r, included, decision };
  });
  return {
    construction,
    complete: errors.length === 0 && validation.count === 100,
    document,
    errors: [...new Set(errors)],
    explanation: `${o.bracket ? "Target bracket " + o.bracket + "; " + checkedBracket.count + " Game Changers. Card-count check only; human review of play intent and combos required. " : ""}Rules-based construction around ${o.commander.name}; ${landCount} lands and ${spellCount} noncommander spells. ${counts}. Each card has one primary allocation; secondary roles do not inflate targets. Basics rebalanced from selected mana symbols and known nonbasic sources within budget/ownership; review actual source availability and timing. Review mana balance and strategy; this is not a competitive-strength or model-AI claim.`,
    missing,
    estimatedDeck: unknownDeck ? null : Math.round(deckTotal * 100) / 100,
    estimatedPurchases: unknownPurchase
      ? null
      : Math.round(purchaseTotal * 100) / 100,
    fetchedAt: o.fetchedAt,
    excludedUnknown: unknown,
    recommendationAudit,
  };
}
