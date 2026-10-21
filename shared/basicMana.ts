import { manaAvailability } from "./mtgCardFunctions";
import { isLandSlot, playableLandFace } from "./landAllocation";
import type { Card } from "./model";
const symbols = ["W", "U", "B", "R", "G", "C"];
export const DEFAULT_EARLY_SOURCE_TARGET = 8;
export type ManaCounts = Record<string, number>;
export function manaDemand(cards: { card: Card; qty: number }[]): ManaCounts {
  const demand: ManaCounts = {};
  for (const { card, qty } of cards) {
    if (isLandSlot(card)) continue;
    const costs =
      card.mana_cost !== undefined
        ? [card.mana_cost]
        : (card.card_faces || []).map((f) => f.mana_cost || "");
    for (const cost of costs)
      for (const match of cost.matchAll(/\{([^}]+)\}/g)) {
        const parts = match[1].split("/"),
          colors = parts.filter((p) => symbols.includes(p));
        if (!colors.length) continue;
        const divisor =
          colors.length + (parts.some((p) => /^\d+$/.test(p)) ? 1 : 0);
        for (const color of colors)
          demand[color] = (demand[color] || 0) + qty / divisor;
      }
  }
  return demand;
}
/** Direct broad land colors, separate from conditional production and provider metadata. */
export function landManaProfile(input: Card, identity: string[]) {
  const card = playableLandFace(input);
  const sources = new Set<string>(),
    conditional = new Set<string>(),
    notes: string[] = [];
  if (!card)
    return {
      sources: [],
      conditionalSources: [],
      possibleSources: [],
      entersTapped: false,
      notes,
    };
  const type = card.type_line || "",
    text = card.oracle_text || "",
    basics: Record<string, string> = {
      Plains: "W",
      Island: "U",
      Swamp: "B",
      Mountain: "R",
      Forest: "G",
      Wastes: "C",
    };
  for (const [name, color] of Object.entries(basics))
    if (
      new RegExp("\\b" + name + "\\b").test(
        type + (/\bBasic\b/.test(type) ? " " + card.name : ""),
      )
    )
      sources.add(color);
  const retention =
    /sacrifice[^.\n]*unless you control|if you control no[^.\n]*sacrifice/i.test(
      text,
    );
  const abilities = [...text.matchAll(/(?:^|\n)([^:\n]+):\s*(Add\b[^\n]*)/gi)];
  for (const m of abilities) {
    const output = m[2].split(".")[0],
      colors = /any colou?r|any type/i.test(output)
        ? identity.filter((c) => c !== "C" || /any type/i.test(output))
        : (output.match(/\{[WUBRGC]\}/g) || []).map((x) => x[1]);
    const dependent =
      retention ||
      /you control|opponent|could produce|among|only if|activate only|spend this mana only|for each|equal to|remove[^:]*counter|sacrifice|discard|pay[^:]*life/i.test(
        m[0],
      );
    for (const color of colors) (dependent ? conditional : sources).add(color);
    if (dependent && colors.length)
      notes.push(
        "Conditional land production: " +
          m[0].trim() +
          ". Its colors are not assumed for casting the commander or arbitrary spells.",
      );
  }
  if (!text.trim() && !sources.size)
    for (const c of card.produced_mana || [])
      if (symbols.includes(c)) sources.add(c);
  if (retention)
    notes.push(
      "Land retention depends on the stated support; unrestricted early color availability is not assumed.",
    );
  const entersTapped = /enters(?: the battlefield)? tapped/i.test(text);
  if (entersTapped)
    notes.push(
      "Enters-tapped timing can delay availability; colors here are not a turn-by-turn cast guarantee.",
    );
  return {
    sources: [...sources],
    conditionalSources: [...conditional].filter((c) => !sources.has(c)),
    possibleSources: [...new Set([...sources, ...conditional])],
    entersTapped,
    notes,
  };
}
export function landManaSources(input: Card, identity: string[]): string[] {
  return landManaProfile(input, identity).sources;
}
export function basicManaTargets(
  entries: { card: Card; qty: number }[],
  identity: string[],
  basicCount: number,
  commander?: Card,
): ManaCounts {
  const demand = manaDemand(entries);
  if (!Object.values(demand).some(Boolean))
    for (const s of identity.length ? identity : ["C"]) demand[s] = 1;
  const total = Object.values(demand).reduce((a, b) => a + b, 0),
    fixed: ManaCounts = {};
  let nonbasics = 0;
  for (const { card, qty } of entries) {
    if (!isLandSlot(card) || /\bBasic\b/.test(card.type_line || "")) continue;
    nonbasics += qty;
    const sources = landManaSources(card, identity);
    for (const s of sources) fixed[s] = (fixed[s] || 0) + qty / sources.length;
  }
  const weights = Object.fromEntries(
    Object.entries(demand).map(([s, n]) => [
      s,
      Math.max(0, ((basicCount + nonbasics) * n) / total - (fixed[s] || 0)),
    ]),
  );
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  const exact = Object.entries(weights).map(([s, n]) => ({
    s,
    n: sum ? (basicCount * n) / sum : 0,
  }));
  const targets = Object.fromEntries(
    exact.map(({ s, n }) => [s, Math.floor(n)]),
  );
  let left = basicCount - Object.values(targets).reduce((a, b) => a + b, 0);
  for (const { s } of exact.sort(
    (a, b) =>
      (b.n % 1) - (a.n % 1) || symbols.indexOf(a.s) - symbols.indexOf(b.s),
  )) {
    if (left-- <= 0) break;
    targets[s]++;
  }
  for (const s of Object.keys(demand)) {
    if (targets[s] || fixed[s] >= 1) continue;
    const donor = Object.keys(targets)
      .sort((a, b) => targets[b] - targets[a])
      .find((c) => targets[c] > 1);
    if (donor) {
      targets[donor]--;
      targets[s] = 1;
    }
  }
  // A commander-only splash must not shrink to one land just because the other
  // 63 spells dominate total pip counts. This floor is a heuristic, not cast odds.
  const earlyColorless = entries.some(
    (e) =>
      !isLandSlot(e.card) &&
      typeof e.card.cmc === "number" &&
      e.card.cmc <= 3 &&
      /\{C\}/.test(e.card.card_faces?.[0]?.mana_cost ?? e.card.mana_cost ?? ""),
  );
  if (commander || earlyColorless) {
    const commanderPips = commander
      ? manaDemand([{ card: commander, qty: 1 }])
      : {};
    const floors: ManaCounts = {};
    for (const [color, pips] of Object.entries(commanderPips))
      floors[color] = Math.max(
        0,
        Math.ceil(
          DEFAULT_EARLY_SOURCE_TARGET +
            4 * Math.max(0, pips - 1) -
            (fixed[color] || 0),
        ),
      );
    if (earlyColorless) {
      const fixedC = entries
        .filter(
          (e) =>
            isLandSlot(e.card) &&
            !/\bBasic\b/.test(e.card.type_line || "") &&
            landManaSources(e.card, identity).includes("C"),
        )
        .reduce((n, e) => n + e.qty, 0);
      const fastC = entries
        .filter(
          (e) =>
            !isLandSlot(e.card) &&
            manaAvailability(e.card).fastIndependentColorless,
        )
        .reduce((n, e) => n + e.qty, 0);
      // Reuse the existing one-pip eight-source planning floor. This is not a cast-probability model.
      floors.C = Math.max(
        floors.C || 0,
        Math.max(0, DEFAULT_EARLY_SOURCE_TARGET - fixedC - fastC),
      );
      if (demand.C !== undefined && targets.C === undefined) targets.C = 0;
    }
    const requested = Object.values(floors).reduce((a, b) => a + b, 0);
    if (requested > basicCount)
      for (const color of Object.keys(floors))
        floors[color] = Math.floor((floors[color] * basicCount) / requested);
    for (const color of Object.keys(floors))
      while ((targets[color] || 0) < floors[color]) {
        const donor = Object.keys(targets)
          .sort(
            (a, b) =>
              targets[b] - (floors[b] || 0) - (targets[a] - (floors[a] || 0)),
          )
          .find((c) => targets[c] > (floors[c] || 0));
        if (!donor) break;
        targets[donor]--;
        targets[color] = (targets[color] || 0) + 1;
      }
  }
  return targets;
}

/** Separate actual {C} requirements from generic costs and conditional/delayed source support. */
export function colorlessSupport(
  entries: { card: Card; qty: number; board?: string }[],
) {
  const active = entries.filter(
      (e) =>
        e.qty > 0 &&
        (!e.board || e.board === "mainboard" || e.board === "commander"),
    ),
    context = active.map((e) => e.card);
  const required = active.filter(
    (e) =>
      !isLandSlot(e.card) &&
      /\{C\}/.test(e.card.card_faces?.[0]?.mana_cost ?? e.card.mana_cost ?? ""),
  );
  const early = required.some(
      (e) => typeof e.card.cmc === "number" && e.card.cmc <= 3,
    ),
    landSources = active
      .filter(
        (e) => isLandSlot(e.card) && landManaSources(e.card, []).includes("C"),
      )
      .reduce((n, e) => n + e.qty, 0);
  const nonlands = active
    .filter((e) => !isLandSlot(e.card))
    .map((e) => ({
      name: e.card.name,
      qty: e.qty,
      ...manaAvailability(e.card, context),
    }));
  const fastSources = nonlands
      .filter((e) => e.fastIndependentColorless)
      .reduce((n, e) => n + e.qty, 0),
    conditional = nonlands.filter((e) => e.conditionalColorless),
    delayed = nonlands.filter((e) => e.delayedColorless);
  const credited = landSources + fastSources,
    target = early ? DEFAULT_EARLY_SOURCE_TARGET : 0;
  return {
    required: required.map((e) => e.card.name),
    planningTarget: target,
    directLandSources: landSources,
    fastIndependentNonlands: fastSources,
    creditedSources: credited,
    conditionalSources: conditional.map((e) => ({
      name: e.name,
      selectedEnablers: e.selectedEnablers,
      supportedInList: e.conditionalSupportInList,
    })),
    delayedSources: delayed.map((e) => e.name),
    meetsPlanningTarget: credited >= target,
    note: required.length
      ? `Explicit {C} requires colorless mana, not generic payment. ${landSources} direct land sources and ${fastSources} fast independent nonland sources are credited; ${conditional.length} conditional and ${delayed.length} delayed nonland sources are separate. ${early ? "The default cheap-{C} planning target is 8 independent sources, reusing the existing one-pip commander heuristic. " : ""}This is source planning, not cast probability or an untapped-board guarantee.`
      : "",
  };
}

/** Automatic additions should fit the selected base instead of displacing colored basics for marginal splash spells.
 * Explicit-C commanders retain their dedicated source-planning path. Manual card additions remain available.
 */
export function fitsSelectedColorlessBase(
  card: Card,
  selected: { card: Card; qty: number; board?: string }[],
  commander?: Card,
): boolean {
  if (
    isLandSlot(card) ||
    typeof card.cmc !== "number" ||
    card.cmc > 3 ||
    !/\{C\}/.test(card.card_faces?.[0]?.mana_cost ?? card.mana_cost ?? "")
  )
    return true;
  if (
    /\{C\}/.test(
      commander?.card_faces?.[0]?.mana_cost ?? commander?.mana_cost ?? "",
    )
  )
    return true;
  return colorlessSupport([...selected, { card, qty: 1 }]).meetsPlanningTarget;
}
