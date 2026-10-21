import type { Document } from "./model";
import { validateDeck } from "./model";
import { constructionRoles, constructionTargets } from "./constructionPlan";
import { normalizeBuildIntent, type BuildIntent } from "./tokenPlan";
const labels: Record<string, string> = {
  ramp: "Ramp",
  advantage: "Supplemental advantage",
  finisher: "Finishers",
  production: "Token production",
  untap: "Untap support",
  haste: "Team haste",
  interaction: "Interaction",
  wipes: "Board wipes",
  protection: "Protection",
};
type Row = { role: string; count: number; target: number | null };
export function planReadiness(input: {
  complete: boolean;
  count: number;
  roles: Row[];
  intent?: Partial<BuildIntent>;
  basis?: string;
}) {
  const shortfalls = input.roles
    .filter((r) => r.target !== null && r.count < r.target)
    .map((r) => ({
      role: r.role,
      label: labels[r.role] || r.role,
      count: r.count,
      target: r.target!,
    }));
  const level = !input.complete
    ? "incomplete"
    : shortfalls.length
      ? "review-shortfalls"
      : "structural-complete";
  return {
    level,
    structuralComplete: input.complete,
    count: input.count,
    basis: input.basis || "primary allocation",
    shortfalls,
    title:
      level === "incomplete"
        ? `${input.count}-card incomplete draft`
        : level === "review-shortfalls"
          ? "100-card draft · plan shortfalls"
          : "100-card draft · structural checks passed",
    summary: !input.complete
      ? "This draft is incomplete. Review the verified card pool and listed constraints before rebuilding."
      : shortfalls.length
        ? "Structural checks do not certify strategic readiness. Requested function targets remain short; review these compromises before saving."
        : "Structural checks do not certify strategic readiness. Review card interactions, mana timing and your intended plan before saving.",
    commanderDrawNote:
      input.intent?.supplementalDraw === "reduced"
        ? "Reduced supplemental draw may intentionally rely on the commander. A supplemental advantage shortfall is not a claim that the deck cannot draw; assess that reliance and recovery if the commander is unavailable."
        : undefined,
    choices: [
      "Review plan constraints or verified card source",
      "Review budget explicitly; no new cap is assumed",
      "Keep inspecting the current draft",
    ],
    status: !input.complete
      ? "Incomplete draft. Review constraints; nothing saved."
      : shortfalls.length
        ? "100-card draft assembled with plan shortfalls. Review before saving."
        : "100-card draft assembled. Review strategy before saving.",
  };
}
/** Current canonical cards, not stale saved primary-allocation metadata. Counts overlap and are advisory. */
export function deckPlanReadiness(deck: Document | undefined) {
  if (!deck) return undefined;
  const active = deck.entries.filter(
      (e) => e.qty > 0 && (e.board === "commander" || e.board === "mainboard"),
    ),
    commander = active.find((e) => e.board === "commander")?.card,
    validation = validateDeck(deck);
  let intent = normalizeBuildIntent();
  try {
    const raw = /Build intent:\s*(\{[^}\n]+\})/.exec(deck.notes || "")?.[1];
    if (raw) intent = normalizeBuildIntent(JSON.parse(raw));
  } catch {
    /* Untrusted note metadata is optional, never an authorization or safety rule. */
  }
  const targets: Record<string, number> = commander ? constructionTargets(commander, intent) : {},
    context = active.map((e) => e.card),
    counts: Record<string, number> = {};
  if (commander)
    for (const entry of active.filter((e) => e.board === "mainboard"))
      for (const role of constructionRoles(entry.card, commander, context))
        counts[role] = (counts[role] || 0) + entry.qty;
  return {
    ...planReadiness({
      complete: validation.count === 100 && !validation.errors.length,
      count: validation.count,
      roles: Object.entries(targets).map(([role, target]) => ({
        role,
        count: counts[role] || 0,
        target,
      })),
      intent,
      basis:
        "current overlapping functional counts; saved primary allocation is unavailable",
    }),
    budgetVerified: false,
    instruction:
      "A complete card count is not a strategically ready plan. Explain supplied shortfalls and commander dependence, offer explicit constraint/budget choices, and do not silently change controls or infer budget validity from this summary.",
  };
}
