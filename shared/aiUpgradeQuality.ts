import { colorlessSupport } from "./basicMana";
import { activeDeckCards } from "./deckContext";
import { reproductionReason } from "./deckEligibility";
import { discussionSearches } from "./aiDiscussion";
import { strategicProfile, rampSequence } from "./strategicQuality";
import { resolveMTGTerms, termById } from "./mtgGlossary";
import { cardFunctionFacts } from "./mtgCardFunctions";
import {
  parseAIRequest,
  hasCardCriterion,
  hasIncreaseTarget,
  matchesAIRequest,
  pairMatchesAIRequest,
  requestQuery,
  requestSummary,
  assertAIRequest,
  type AIRequest,
} from "./aiConstraints";
import type { Card, Document, Entry } from "./model";
import {
  proposeUpgrades,
  previewUpgrade,
  type UpgradePair,
} from "./deckUpgrade";
import {
  constructionRoles,
  constructionTargets,
  supportQuality,
  type ConstructionRole,
} from "./constructionPlan";
import {
  commanderSignals,
  rankCommanderCards,
  commanderCandidateQueries,
} from "./commanderRelevance";
import {
  energyFunction,
  oneShotManaFilter,
  usefulCopiedEntry,
  frontText,
} from "./cardFunction";
import { packageMatches } from "./themePackages";
import { isLandSlot } from "./landAllocation";
import { oracleKey, buildQuote } from "./deckBuilder";
import { entryUnitPrice } from "./cardPresentation";
const labels: Record<ConstructionRole, string> = {
  untap: "Untap support",
  production: "own creature-token production",
  haste: "team haste",
  ramp: "mana acceleration",
  advantage: "card advantage",
  interaction: "interaction",
  wipes: "board wipes",
  protection: "protection",
  finisher: "finishers",
  synergy: "commander synergy",
};
export function requestedRoles(goal: string): ConstructionRole[] {
  goal = goal.replace(
    /\b(?:keep|keeping|preserve|retain)\s+(?:(?:my|the|our|all|existing|current)\s+)*(?:removal|interaction|counterspells?|ramp|mana rocks?|protection|draw engines?)(?:\s+(?:intact|unchanged))?/gi,
    "",
  );
  const semantic = resolveMTGTerms(goal);
  const roles: ConstructionRole[] = semantic.include
    .map((id) => termById(id)?.role)
    .filter(Boolean) as ConstructionRole[];
  if (/draw|card advantage|refill|run out of cards/i.test(goal))
    roles.push("advantage");
  if (/ramp|mana acceleration|mana rock/i.test(goal)) roles.push("ramp");
  if (/removal|interaction|counterspell/i.test(goal)) roles.push("interaction");
  if (/board wipe|sweeper/i.test(goal)) roles.push("wipes");
  if (
    /\bprotection\b|resilien|\bprotect (?:my|the|our) (?:commander|board|creatures)\b/i.test(
      goal,
    )
  )
    roles.push("protection");
  return [...new Set(roles)].filter(
    (r) =>
      !(
        r === "advantage" &&
        semantic.include.some((id) =>
          ["cantrip", "loot", "rummage"].includes(id),
        )
      ),
  );
}
export function aiCandidateQueries(
  commanders: Card[],
  goal: string,
  request: AIRequest = parseAIRequest([{ role: "user", content: goal }]),
) {
  const discussion = discussionSearches(goal, request);
  if (discussion.length) return discussion;
  const s = commanderSignals(commanders),
    roles = requestedRoles(goal),
    queries = commanderCandidateQueries(commanders);
  const focused: { name: string; query: string }[] = [];
  if (roles.includes("advantage"))
    focused.push({
      name: "Requested card advantage",
      query:
        s.copyCreature || s.blink
          ? 't:creature o:enters (o:"draw a card" or o:"draw two cards" or o:"draw three cards") mv<=5'
          : '(o:"draw two cards" or (o:"draw a card" (o:whenever or o:"at the beginning"))) mv<=5',
    });
  if (roles.includes("ramp"))
    focused.push({
      name: "Requested acceleration",
      query: '(t:artifact mv<=3 o:"add {") or (t:creature mv<=3 o:"add {")',
    });
  if (roles.includes("interaction"))
    focused.push({
      name: "Requested interaction",
      query:
        '(o:"destroy target" or o:"exile target" or o:"counter target spell") mv<=4',
    });
  const preferred = [
    "Reviewed commander recommendations",
    "Reusable creature enters abilities",
    "Energy engine",
  ];
  const semanticIdsRaw = [
    ...(request.mechanics || []),
    ...(request.anyMechanics || []).flat(),
  ];
  // Clone discussion is about copying entry abilities, not a requirement that the clone itself has a triggered ETB.
  const cloneDiscussion =
    request.mode === "explain" && semanticIdsRaw.includes("clone");
  const semanticIds = cloneDiscussion ? ["clone"] : semanticIdsRaw;
  const examples = [
    ...new Set(semanticIds.flatMap((id) => termById(id)?.examples || [])),
  ].slice(0, 12);
  const seedQueries = examples.length
    ? [
        {
          name: "Verified function examples",
          query:
            "(" +
            examples.map((n) => "!" + JSON.stringify(n)).join(" or ") +
            ")",
        },
      ]
    : [];
  const queryList = [
    ...focused,
    ...preferred.flatMap((name) => queries.filter((p) => p.name === name)),
    ...queries.filter((p) => !preferred.includes(p.name)),
  ];
  const binding = requestQuery(
    cloneDiscussion
      ? {
          ...request,
          mechanics: ["clone"],
          anyMechanics: undefined,
          types: ["Creature"],
        }
      : request,
  );
  const planned = seedQueries.length
    ? [
        ...seedQueries,
        { name: "Requested card functions", query: binding },
        ...queryList,
      ]
    : binding
      ? [
          {
            name: "Requested cards: " + requestSummary(request),
            query: binding,
          },
          ...queryList,
        ]
      : queryList;
  return planned.slice(0, 3).map((q) =>
    binding
      ? {
          ...q,
          query:
            "(" +
            q.query.replace(
              request.manaValue !== undefined ? /mv<=\d+/g : /$^/g,
              "",
            ) +
            ") " +
            binding,
        }
      : q,
  );
}
export function analyzeAIDeck(deck: Document) {
  const commander = deck.entries.find((e) => e.board === "commander")?.card;
  if (!commander) return null;
  const main = deck.entries.filter((e) => e.board === "mainboard"),
    roles = Object.fromEntries(
      Object.keys(constructionTargets(commander)).map((r) => [r, 0]),
    ) as Record<ConstructionRole, number>;
  for (const e of main)
    for (const r of constructionRoles(e.card, commander, activeDeckCards(deck)))
      roles[r] += e.qty;
  const nonlands = main.filter((e) => !isLandSlot(e.card)),
    count = nonlands.reduce((n, e) => n + e.qty, 0);
  return {
    commander: commander.name,
    colorlessSupport: colorlessSupport(deck.entries),
    roles,
    primaryRoleSlots: Object.fromEntries(
      Object.keys(roles).map((role) => [
        role,
        main.reduce((n, e) => {
          const rs = constructionRoles(
            e.card,
            commander,
            activeDeckCards(deck),
          ).sort(
            (a, b) =>
              supportQuality(e.card, b, commander) -
              supportQuality(e.card, a, commander),
          );
          return n + (rs[0] === role ? e.qty : 0);
        }, 0),
      ]),
    ),
    uniqueRoleSlots: main
      .filter(
        (e) =>
          constructionRoles(e.card, commander, activeDeckCards(deck)).length >
          0,
      )
      .reduce((n, e) => n + e.qty, 0),
    conditionalRoleSlots: main
      .filter(
        (e) =>
          /choose one|sacrifice|\{T\}|combat damage|whenever[^.\n]*attacks/i.test(
            frontText(e.card),
          ) &&
          constructionRoles(e.card, commander, activeDeckCards(deck)).length >
            0,
      )
      .reduce((n, e) => n + e.qty, 0),
    roleAvailabilityNote:
      "Role totals overlap across card slots; conditional/mutually exclusive effects are not guaranteed independent resources.",
    targets: constructionTargets(commander),
    nonlandAverageMV: count
      ? nonlands.reduce((n, e) => n + (e.card.cmc || 0) * e.qty, 0) / count
      : 0,
    lands: main
      .filter((e) => isLandSlot(e.card))
      .reduce((n, e) => n + e.qty, 0),
  };
}
const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
type QualityCache = {
  request: AIRequest;
  before: NonNullable<ReturnType<typeof analyzeAIDeck>>;
  scores: Map<string, number>;
  roles: Map<string, ConstructionRole[]>;
  packages: Map<string, string[]>;
  support: Map<string, number>;
};
function qualityCache(
  deck: Document,
  candidates: Card[],
  request: AIRequest,
): QualityCache {
  const commander = deck.entries.find((e) => e.board === "commander")!.card,
    cards = [
      ...new Map(
        [...activeDeckCards(deck), ...candidates].map((c) => [c.id, c]),
      ).values(),
    ],
    roles = new Map(
      cards.map((c) => [
        c.id,
        constructionRoles(c, commander, activeDeckCards(deck).concat(c)),
      ]),
    );
  return {
    request,
    before: analyzeAIDeck(deck)!,
    scores: new Map(
      rankCommanderCards(cards, [commander], deck.strategy).map((r) => [
        r.card.id,
        r.score,
      ]),
    ),
    roles,
    packages: new Map(cards.map((c) => [c.id, packageMatches(c, commander)])),
    support: new Map(
      cards.map((c) => [
        c.id,
        Math.max(
          0,
          ...roles.get(c.id)!.map((r) => supportQuality(c, r, commander)),
        ),
      ]),
    ),
  };
}
export function assessAIUpgrade(
  deck: Document,
  cut: Entry,
  add: Card,
  goal: string,
  cache?: QualityCache,
) {
  const commander = deck.entries.find((e) => e.board === "commander")!.card,
    request =
      cache?.request ?? parseAIRequest([{ role: "user", content: goal }]),
    signals = commanderSignals([commander]),
    old =
      cache?.roles.get(cut.card.id) ??
      constructionRoles(cut.card, commander, activeDeckCards(deck)),
    next =
      cache?.roles.get(add.id) ??
      constructionRoles(
        add,
        commander,
        deck.entries
          .filter(
            (e) =>
              e.id !== cut.id &&
              e.qty > 0 &&
              (e.board === "mainboard" || e.board === "commander"),
          )
          .map((e) => e.card)
          .concat(add),
      ),
    wanted = requestedRoles(goal),
    before = cache?.before ?? analyzeAIDeck(deck)!,
    scores =
      cache?.scores ??
      new Map(
        rankCommanderCards([cut.card, add], [commander], deck.strategy).map(
          (r) => [r.card.id, r.score],
        ),
      ),
    mvDelta = (add.cmc || 0) - (cut.card.cmc || 0);
  const reject = (why: string) => ({
    accepted: false,
    why,
    quality: undefined,
  });
  if (request.errors.length) return reject(request.errors.join(" "));
  if (
    typeof add.cmc === "number" &&
    add.cmc <= 3 &&
    /\{C\}/.test(add.card_faces?.[0]?.mana_cost ?? add.mana_cost ?? "")
  ) {
    const support = colorlessSupport([
      ...deck.entries.filter((e) => e.id !== cut.id),
      { card: add, qty: 1, board: "mainboard" },
    ]);
    if (!support.meetsPlanningTarget)
      return reject(
        "The current mana base does not meet the conservative explicit-colorless support target (" +
          support.creditedSources +
          "/" +
          support.planningTarget +
          "). Generic, conditional and summoning-delayed mana are not independent early sources; review mana support before adding this interaction.",
      );
  }
  if (!pairMatchesAIRequest(cut.card, add, request))
    return reject(
      "Does not meet the exact card type/mana request or would fail to increase the requested group.",
    );
  if (
    /flip a coin|roll a (?:d|six|twenty)/i.test(frontText(add)) &&
    !/coin|random|roll/i.test(goal + " " + frontText(commander))
  )
    return reject(
      "Random or self-countering outcomes are not a reliable improvement for this requested plan.",
    );
  if (
    /\{X\}/.test(add.mana_cost || "") &&
    !/variable|\bX spells?\b|big mana/i.test(goal + " " + frontText(commander))
  )
    return reject(
      "Printed mana value omits X; the requested fixed-cost improvement is not verified.",
    );
  if (oneShotManaFilter(add) && !signals.permanentReplay)
    return reject(
      "A one-use mana filter replaces itself; it is neither acceleration nor a draw engine for this commander.",
    );
  if (wanted.length && !wanted.some((r) => next.includes(r)))
    return reject(
      "The addition does not provide the requested " +
        wanted.map((r) => labels[r]).join(" or ") +
        ".",
    );
  const preservingRemoval =
    /\b(?:keep|keeping|preserve|retain)\s+(?:(?:my|the|our|all|existing|current)\s+)*(?:removal|interaction|counterspells?)/i.test(
      goal,
    );
  if (
    preservingRemoval &&
    old.includes("interaction") &&
    !next.includes("interaction")
  )
    return reject("The user asked to keep interaction; this swap removes it.");
  if (
    old.some((r) => !next.includes(r)) &&
    !hasIncreaseTarget(request) &&
    !wanted.some((r) => next.includes(r) && !old.includes(r))
  )
    return reject(
      "Would trade away an existing functional role without addressing the requested gap.",
    );
  if (
    mvDelta > 1 &&
    request.manaValue === undefined &&
    !/higher curve|big spell|expensive payoff/i.test(goal)
  )
    return reject(
      "Increases the mana curve by more than one without an explicit higher-curve goal.",
    );
  const copyGain =
      (signals.copyCreature || signals.blink) &&
      usefulCopiedEntry(add) &&
      !usefulCopiedEntry(cut.card),
    newRoles = next.filter((r) => !old.includes(r)),
    packageGain = (
      cache?.packages.get(add.id) ?? packageMatches(add, commander)
    ).filter(
      (p) =>
        !(
          cache?.packages.get(cut.card.id) ??
          packageMatches(cut.card, commander)
        ).includes(p),
    );
  const roleContributions = newRoles.map((r) =>
    wanted.includes(r)
      ? 45
      : (before.roles[r] || 0) <
          (before.targets[r as keyof typeof before.targets] || 0)
        ? 20
        : 8,
  );
  // Overlap is valid availability, but one slot does not independently close every gap.
  const conditionalOverlap =
    /choose one|sacrifice|\{T\}|combat damage|whenever[^.\n]*attacks/i.test(
      frontText(add),
    );
  const roleGain =
    Math.max(0, ...roleContributions) +
    (roleContributions.reduce((n, v) => n + v, 0) -
      Math.max(0, ...roleContributions)) *
      (conditionalOverlap ? 0.25 : 0.75);
  const quality = (card: Card, rs: ConstructionRole[]) =>
    cache?.support.get(card.id) ??
    Math.max(0, ...rs.map((r) => supportQuality(card, r, commander)));
  const structuralGain =
    hasIncreaseTarget(request) && request.intent === "increase";
  const addStrategy = strategicProfile(
    add,
    commander,
    deck.commanderBracket,
    request.manaValue !== undefined,
    deck.entries
      .filter(
        (e) =>
          e.id !== cut.id &&
          e.qty > 0 &&
          (e.board === "mainboard" || e.board === "commander"),
      )
      .map((e) => e.card)
      .concat(add),
  );
  const cutStrategy = strategicProfile(
    cut.card,
    commander,
    deck.commanderBracket,
    request.manaValue !== undefined,
    activeDeckCards(deck),
  );
  const score =
    addStrategy.adjustment -
    cutStrategy.adjustment +
    (structuralGain ? 60 : 0) +
    (scores.get(add.id) || 0) -
    (scores.get(cut.card.id) || 0) +
    (quality(add, next) - quality(cut.card, old)) / 2 -
    mvDelta * 3 +
    roleGain +
    packageGain.length * 8;
  if (
    score < 12 ||
    (!structuralGain &&
      !copyGain &&
      !newRoles.length &&
      !packageGain.length &&
      quality(add, next) < quality(cut.card, old) + 8 &&
      mvDelta >= 0)
  )
    return reject(
      "No clear functional, commander-synergy or curve improvement over the existing card.",
    );
  const entryDraw = usefulCopiedEntry(add) && /draw/i.test(frontText(add));
  let summary =
    entryDraw && signals.copyCreature
      ? `${add.name} adds a creature-entry draw effect ${commander.name} can reuse with its copies.`
      : entryDraw && signals.blink
        ? `${add.name} adds a draw trigger that works with the commander's blink plan.`
        : energyFunction(add).repeatableProducer
          ? `${add.name} adds repeatable energy generation for ${commander.name}.`
          : `${add.name} provides ${next.map((r) => labels[r]).join(" and ") || "a matching commander payoff"} in place of ${cut.card.name}.`;
  if (wanted.length)
    summary +=
      " Addresses " +
      wanted
        .filter((r) => next.includes(r))
        .map((r) => labels[r])
        .join(" and ") +
      ".";
  if (hasCardCriterion(request))
    summary += " Meets your " + requestSummary(request) + " request.";
  const sequence = rampSequence(add, commander.cmc || 0);
  if (sequence)
    summary += ` Simplified commander setup: turn ${sequence.rampTurn ?? "unverified"} versus ${sequence.baselineTurn} with land drops alone; assumes card in hand and sufficient colors, no interaction.`;
  if (addStrategy.notes.length)
    summary += " " + addStrategy.notes.slice(0, 2).join(" ");
  const functionNotes = cardFunctionFacts(add).conditions;
  if (functionNotes.length) summary += " " + functionNotes[0];
  const lost = old.filter((r) => !next.includes(r));
  const tradeoff = lost.length
    ? `Gives up ${cut.card.name}'s ${lost.map((r) => labels[r]).join(" and ")} coverage; the remaining deck must still meet its existing targets.`
    : copyGain
      ? `You lose ${cut.card.name}${cut.card.power ? "’s " + cut.card.power + "/" + cut.card.toughness + " body" : "'s slot"}; extra entry value still needs the commander's copy/blink ability.`
      : `Printed mana value ${add.cmc || 0} versus ${cut.card.cmc || 0}; this is not the full deployment payment. Mode, setup and resource conditions still apply.`;
  const changed = [...new Set([...wanted, ...old, ...next])].slice(0, 3);
  return {
    accepted: true,
    why: "",
    quality: {
      summary,
      tradeoff,
      score: Math.round(score),
      roleChange: changed
        .map(
          (r) =>
            `${labels[r]} ${before.roles[r] || 0} → ${(before.roles[r] || 0) - (old.includes(r) ? 1 : 0) + (next.includes(r) ? 1 : 0)}`,
        )
        .join(" · "),
      curveChange: `Mana value ${cut.card.cmc || 0} → ${add.cmc || 0}`,
    },
  };
}
export function recommendAIUpgrades(
  deck: Document,
  candidates: Card[],
  documents: Document[],
  budget: number,
  ownedOnly: boolean,
  goal: string,
  request: AIRequest = parseAIRequest([{ role: "user", content: goal }]),
) {
  if (request.errors.length) throw Error(request.errors.join(" "));
  budget = Math.min(budget, request.purchaseBudget ?? Infinity);
  ownedOnly = ownedOnly || !!request.ownedOnly;
  const plan = proposeUpgrades(deck, [], documents, budget, ownedOnly),
    commander = deck.entries.find((e) => e.board === "commander")!.card,
    installed = new Set(deck.entries.map((e) => oracleKey(e.card))),
    colors = new Set(commander.color_identity || []),
    owned = new Set(
      documents
        .filter((d) => d.kind === "collection" && !d.deleted)
        .flatMap((d) =>
          d.entries.filter((e) => e.qty > 0).map((e) => oracleKey(e.card)),
        ),
    );
  plan.pairs = [];
  const cuts = deck.entries.filter(
    (e) =>
      e.board === "mainboard" &&
      !isLandSlot(e.card) &&
      !deck.notes.toLowerCase().includes(e.card.name.toLowerCase()) &&
      !new RegExp(
        "(?:keep|preserve|protect|do not cut|don.t cut)[^.\\n]{0,100}" +
          escaped(e.card.name),
        "i",
      ).test(goal),
  );
  const named = cuts.filter((e) =>
    new RegExp(
      "(?:cut|cutting|replace|replacing|remove|removing|swap out)\\s+(?:(?:1|one)\\s+)?" +
        escaped(e.card.name),
      "i",
    ).test(goal),
  );
  const selectedCuts = named.length ? named : cuts;
  const pool = new Map<string, Card>();
  for (const c of candidates) {
    if (
      reproductionReason(c) ||
      !matchesAIRequest(c, request) ||
      installed.has(oracleKey(c)) ||
      isLandSlot(c) ||
      c.legalities?.commander !== "legal" ||
      !c.color_identity ||
      c.color_identity.some((c) => !colors.has(c))
    )
      continue;
    const prior = pool.get(oracleKey(c));
    if (!prior || (buildQuote(c) ?? Infinity) < (buildQuote(prior) ?? Infinity))
      pool.set(oracleKey(c), c);
  }
  const ranked = rankCommanderCards(
    [...pool.values()],
    [commander],
    deck.strategy,
  ).slice(0, 80);
  const cache = qualityCache(
    deck,
    ranked.map((r) => r.card),
    request,
  );
  const options: UpgradePair[] = [];
  for (const { card: add } of ranked) {
    const isOwned = owned.has(oracleKey(add)),
      purchase = isOwned ? 0 : buildQuote(add);
    if (
      purchase === null ||
      purchase > budget ||
      (request.unitPriceCap !== undefined && purchase > request.unitPriceCap) ||
      (ownedOnly && !isOwned)
    )
      continue;
    for (const cut of selectedCuts) {
      const assessed = assessAIUpgrade(deck, cut, add, goal, cache);
      if (!assessed.accepted || !assessed.quality) continue;
      const pair: UpgradePair = {
        id: crypto.randomUUID(),
        cutId: cut.id,
        cutName: cut.card.name,
        cut: cut.card,
        cutPrice: entryUnitPrice(cut),
        cutFinish: cut.finish,
        add,
        addPrice: buildQuote(add),
        purchase,
        owned: isOwned,
        reason: assessed.quality.summary,
        quality: assessed.quality,
      };
      if (budget > 0 && purchase > budget / 2 && pair.quality)
        pair.quality.tradeoff += ` Uses ${Math.round((purchase / budget) * 100)}% of the remaining purchase budget; compare the other deck gaps before allocating it here.`;
      options.push(pair);
    }
  }
  options.sort(
    (a, b) =>
      (b.quality?.score || 0) - (a.quality?.score || 0) ||
      a.purchase - b.purchase ||
      a.add.name.localeCompare(b.add.name),
  );
  let trials = 0;
  for (const pair of options) {
    if (plan.pairs.length >= 3) break;
    if (
      plan.pairs.some(
        (p) =>
          p.cutId === pair.cutId || oracleKey(p.add) === oracleKey(pair.add),
      )
    )
      continue;
    if (++trials > 100) break;
    try {
      const trial = { ...plan, pairs: [...plan.pairs, pair] };
      previewUpgrade(
        trial,
        deck,
        trial.pairs.map((p) => p.id),
        documents,
      );
      plan.pairs.push(pair);
    } catch {
      /* Selected combinations must also pass. */
    }
  }
  if (
    request.intent === "increase" &&
    hasIncreaseTarget(request) &&
    plan.pairs.length < request.minimumIncrease
  )
    plan.pairs = [];
  if (plan.pairs.length) {
    const preview = previewUpgrade(
      plan,
      deck,
      plan.pairs.map((p) => p.id),
      documents,
    );
    assertAIRequest(
      deck,
      preview.document,
      plan,
      plan.pairs.map((p) => p.id),
      request,
    );
  }
  return { plan, analysis: analyzeAIDeck(deck), request };
}
