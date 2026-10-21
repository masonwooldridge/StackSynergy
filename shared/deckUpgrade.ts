import {activeDeckCards} from "./deckContext";
import {mechanicalPrerequisites} from "./mechanicalSupport";
import {reproductionReason} from "./deckEligibility";
import {assertTotalBudget} from "./assistantBudget";
import type { Card, Document } from "./model";
import { validateDeck } from "./model";
import { newEntry } from "./deckEditing";
import { buildQuote, copyLimit, oracleKey } from "./deckBuilder";
import { isLandSlot } from "./landAllocation";
import {
  constructionRoles,
  constructionTargets,
  supportQuality,
} from "./constructionPlan";
import { rankCommanderCards } from "./commanderRelevance";
import { packageMatches, packageTargets } from "./themePackages";
export interface UpgradePair {
  cut?:Card;cutPrice?:number|null;cutFinish?:string;addPrice?:number|null;
  quality?:{summary:string;tradeoff:string;roleChange:string;curveChange:string;score:number};
  id: string;
  cutId: string;
  cutName: string;
  add: Card;
  purchase: number;
  owned: boolean;
  reason: string;
}
export interface UpgradePlan {
  deckId: string;
  revision: number;
  signature: string;
  collectionSignature: string;
  budgetMeaning?: "purchases" | "deck";
  totalBudget?: number;
  budget: number;
  ownedOnly: boolean;
  pairs: UpgradePair[];
  retrievedAt: string;
}
const collectionSignature = (documents: Document[]) =>
  JSON.stringify(
    documents.filter((d) => d.kind === "collection" && !d.deleted),
  );
export const upgradeSignature = (deck: Document) => JSON.stringify(deck);
const total = (d: Document) =>
  d.entries
    .filter((e) => e.board === "mainboard" || e.board === "commander")
    .reduce((n, e) => n + e.qty, 0);
function checkDeck(deck: Document) {
  if (deck.kind !== "deck" || deck.format !== "commander")
    throw Error(
      "Choose a Commander deck. Other formats can still use card search or optional model analysis.",
    );
  const commanders = deck.entries.filter((e) => e.board === "commander");
  if (commanders.length !== 1 || commanders[0].qty !== 1)
    throw Error("Choose exactly one commander before requesting upgrades.");
  if (total(deck) !== 100)
    throw Error(
      "This upgrade tool makes one-for-one swaps. Finish the 100-card deck first.",
    );
  return commanders[0].card;
}
function coverage(deck: Document, commander: Card) {
  const counts: Record<string, number> = {};
  for (const e of deck.entries.filter((e) => e.board === "mainboard"))
    for (const role of [
      ...constructionRoles(e.card, commander, activeDeckCards(deck)),
      ...packageMatches(e.card, commander),
    ])
      counts[role] = (counts[role] || 0) + e.qty;
  return counts;
}
function validateChange(original: Document, next: Document) {
  const commander = checkDeck(original),
    colors = new Set(commander.color_identity || []),
    seen = new Map<string, number>();
  for (const e of next.entries.filter(
    (e) => e.board === "mainboard" || e.board === "commander",
  )) {
    if (
      e.card.legalities?.commander !== "legal" ||
      !e.card.color_identity ||
      e.card.color_identity.some((c) => !colors.has(c))
    )
      throw Error(
        "A selected swap violates verified Commander legality or color identity.",
      );
    const key = oracleKey(e.card);
    seen.set(key, (seen.get(key) || 0) + e.qty);
    if (seen.get(key)! > copyLimit(e.card))
      throw Error("A selected swap exceeds the singleton/copy limit.");
  }
  if (
    total(next) !== total(original) ||
    next.entries
      .filter((e) => e.board === "commander")
      .map((e) => e.id + ":" + e.qty)
      .join() !==
      original.entries
        .filter((e) => e.board === "commander")
        .map((e) => e.id + ":" + e.qty)
        .join()
  )
    throw Error("Swaps must preserve the commander and total card count.");
  const v = validateDeck(next);
  if (v.errors.length) throw Error(v.errors.join(" "));
  const before = coverage(original, commander),
    after = coverage(next, commander),
    targets = {
      ...constructionTargets(commander),
      ...packageTargets(commander),
    };
  for (const [r, target] of Object.entries(targets))
    if ((after[r] || 0) < Math.min(before[r] || 0, target))
      throw Error(
        "Selected swaps reduce " +
          r +
          " below the deck’s existing target. Choose another combination.",
      );
}
export function previewUpgrade(
  plan: UpgradePlan,
  deck: Document,
  ids: string[],
  documents?: Document[],
) {
  if (documents && plan.collectionSignature !== collectionSignature(documents))
    throw Error("Owned inventory changed. Generate a new upgrade review.");
  if (
    plan.deckId !== deck.id ||
    plan.revision !== deck.revision ||
    plan.signature !== upgradeSignature(deck)
  )
    throw Error("Deck changed. Generate a new upgrade review before applying.");
  if (
    !ids.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !plan.pairs.some((p) => p.id === id))
  )
    throw Error("Select at least one valid swap.");
  let purchase = 0;
  const next = structuredClone(deck);
  for (const p of plan.pairs.filter((p) => ids.includes(p.id))) {
    const cut = next.entries.find((e) => e.id === p.cutId);
    if (!cut || cut.board !== "mainboard" || isLandSlot(cut.card))
      throw Error("A cut no longer matches this deck. Generate again.");
    if (
      !Number.isFinite(p.purchase) ||
      p.purchase < 0 ||
      (plan.ownedOnly && !p.owned)
    )
      throw Error(
        "The selected addition cannot be verified within the ownership/price constraints.",
      );
    purchase += p.purchase;
    next.entries = next.entries.flatMap((e) =>
      e.id !== cut.id ? [e] : e.qty > 1 ? [{ ...e, qty: e.qty - 1 }] : [],
    );
    next.entries.push(newEntry(p.add));
  }
  purchase = Math.round(purchase * 100) / 100;
  if (purchase > plan.budget + 1e-8)
    throw Error(
      "Selected new purchases exceed the addition budget. Removed cards do not fund additions.",
    );
  if (plan.budgetMeaning === "deck") assertTotalBudget(next, plan.totalBudget ?? plan.budget);
  for (const pair of plan.pairs.filter(p => ids.includes(p.id))) {
    if (reproductionReason(pair.add)) throw Error("Choose a tournament-eligible printing for automated upgrades; collectible search remains available for manual casual use.");
    const unsupported = mechanicalPrerequisites(pair.add, activeDeckCards(next), next.entries.filter(e => e.board === "commander").map(e => e.card));
    if (unsupported.length) throw Error(unsupported.join(" "));
  }
  validateChange(deck, next);
  return { document: next, purchase };
}
export function proposeUpgrades(
  deck: Document,
  candidates: Card[],
  documents: Document[],
  budget: number,
  ownedOnly: boolean,
): UpgradePlan {
  const commander = checkDeck(deck);
  if (!Number.isFinite(budget) || budget < 0)
    throw Error("Enter a nonnegative addition budget.");
  const colors = new Set(commander.color_identity || []),
    facts = new Map(candidates.map((c) => [c.id, c])),
    owned = new Map<string, number>();
  for (const d of documents.filter(
    (d) => d.kind === "collection" && !d.deleted,
  ))
    for (const e of d.entries) {
      const c = facts.get(e.card.id);
      if (c) owned.set(oracleKey(c), (owned.get(oracleKey(c)) || 0) + e.qty);
    }
  const analysis = (c: Card) => facts.get(c.id) || c;
  for (const e of deck.entries.filter(
    (e) => e.board === "mainboard" || e.board === "commander",
  )) {
    const c = analysis(e.card);
    if (
      c.legalities?.commander !== "legal" ||
      !c.color_identity ||
      c.color_identity.some((s) => !colors.has(s))
    )
      throw Error(
        "Current card facts show " +
          c.name +
          " is illegal or outside commander colors. Repair the deck before upgrading.",
      );
  }
  const ranked = rankCommanderCards(
      [...candidates, ...deck.entries.map((e) => analysis(e.card))],
      [commander],
      deck.strategy,
    ),
    rank = new Map(ranked.map((r) => [oracleKey(r.card), r]));
  const score = (c: Card) => {
    const roles = constructionRoles(c, commander, activeDeckCards(deck).concat(c));
    return (
      (rank.get(oracleKey(c))?.score || 0) +
      Math.max(0, ...roles.map((r) => supportQuality(c, r, commander))) / 2
    );
  };
  const installed = new Set(deck.entries.map((e) => oracleKey(e.card))),
    pool = new Map<string, Card>();
  for (const c of candidates) {
    const key = oracleKey(c);
    if (
      installed.has(key) ||
      isLandSlot(c) ||
      reproductionReason(c) ||
      c.legalities?.commander !== "legal" ||
      !c.color_identity ||
      c.color_identity.some((s) => !colors.has(s))
    )
      continue;
    const old = pool.get(key);
    if (!old || (buildQuote(c) ?? Infinity) < (buildQuote(old) ?? Infinity))
      pool.set(key, c);
  }
  const cuts = deck.entries
    .filter(
      (e) =>
        e.board === "mainboard" &&
        !isLandSlot(e.card) &&
        !deck.notes.toLowerCase().includes(e.card.name.toLowerCase()),
    )
    .sort((a, b) => score(analysis(a.card)) - score(analysis(b.card)));
  const additions = [...pool.values()].sort(
    (a, b) =>
      score(b) - score(a) ||
      (buildQuote(a) ?? Infinity) - (buildQuote(b) ?? Infinity),
  );
  const plan: UpgradePlan = {
    deckId: deck.id,
    revision: deck.revision,
    signature: upgradeSignature(deck),
    collectionSignature: collectionSignature(documents),
    budget,
    ownedOnly,
    pairs: [],
    retrievedAt: new Date().toISOString(),
  };
  const usedCuts = new Set<string>();
  for (const add of additions) {
    if (plan.pairs.length >= 5) break;
    const own = (owned.get(oracleKey(add)) || 0) > 0,
      quote = own ? 0 : buildQuote(add);
    if ((ownedOnly && !own) || quote === null) continue;
    for (const cut of cuts) {
      if (usedCuts.has(cut.id) || score(add) < score(analysis(cut.card)) + 8)
        continue;
      const oldRoles = constructionRoles(analysis(cut.card), commander, activeDeckCards(deck)),
        newRoles = constructionRoles(add, commander, activeDeckCards({...deck,entries:deck.entries.filter(e=>e.id!==cut.id)}).concat(add));
      if (oldRoles.some((r) => !newRoles.includes(r))) continue;
      const pair: UpgradePair = {
        id: crypto.randomUUID(),
        cutId: cut.id,
        cutName: cut.card.name,
        add,
        purchase: quote,
        owned: own,
        reason:
          (rank
            .get(oracleKey(add))
            ?.reasons.filter((r) => !r.startsWith("Reviewed "))
            .slice(0, 2)
            .join(" ") ||
            "Provides stronger " +
              newRoles.join(", ") +
              " support at the selected budget.") +
          " One-for-one swap; preserves existing support targets. Review conditional abilities and combo pieces.",
      };
      const trial = { ...plan, pairs: [...plan.pairs, pair] };
      try {
        previewUpgrade(
          trial,
          deck,
          trial.pairs.map((p) => p.id),
          documents,
        );
        plan.pairs.push(pair);
        usedCuts.add(cut.id);
        break;
      } catch {
        /* Try the next compatible cut; no state or library mutation. */
      }
    }
  }
  return plan;
}
