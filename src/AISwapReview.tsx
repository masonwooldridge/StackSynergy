import { selectedReviewBudget } from "../shared/assistantBudget";
import {
  hasCardCriterion,
  hasIncreaseTarget,
  matchesAIRequest,
  type AIRequest,
} from "../shared/aiConstraints";
import { useEffect, useState } from "react";
import type { Card, Document } from "../shared/model";
import { image } from "../shared/model";
import { entryUnitPrice } from "../shared/cardPresentation";
import type { UpgradePair } from "../shared/deckUpgrade";
export interface AIReview {
  id: string;
  pairs: UpgradePair[];
  budgetMeaning?: "purchases" | "deck";
  totalBudget?: number;
  deckValue?: number | null;
  budget: number;
  purchase: number;
  count: number;
  expiresAt: string;
  retrievedAt?: string;
  constraints?: AIRequest;
  constraintSummary?: string;
  matchingBefore?: number;
  matchingAfter?: number;
}
export type ReviewState = "pending" | "stale" | "applied";
function PreviewCard({
  card,
  label,
  price,
  finish,
  onInspect,
}: {
  card: Card;
  label: "Remove" | "Add";
  price: number | null;
  finish?: string;
  onInspect: (c: Card) => void;
}) {
  const src = image(card),
    [failed, setFailed] = useState(false);
  return (
    <button
      className={"ai-swap-card " + label.toLowerCase()}
      onClick={(e) => {
        e.currentTarget.focus();
        onInspect(card);
      }}
      aria-label={"Inspect " + label.toLowerCase() + " card " + card.name}
    >
      <span className="ai-swap-card-label">{label} 1</span>
      {src && !failed ? (
        <img
          src={src}
          alt={card.name + " full card"}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="ai-card-unavailable">
          Image unavailable
          <br />
          Tap for rules
        </span>
      )}
      <strong>{card.name}</strong>
      <span className="ai-swap-card-type">
        {card.card_faces?.[0]?.type_line ||
          card.type_line ||
          "Type unavailable"}
      </span>
      <span className="ai-swap-card-cost">
        Cost {card.card_faces?.[0]?.mana_cost || card.mana_cost || "—"} · MV{" "}
        {typeof card.cmc === "number" ? card.cmc : "unknown"}
      </span>
      <span className="ai-swap-card-price">
        {price === null ? "Price unavailable" : "$" + price.toFixed(2) + " USD"}
        {finish && finish !== "nonfoil" ? " · " + finish : ""}
      </span>
      <span className="ai-card-inspect-hint">Tap to enlarge</span>
    </button>
  );
}
export default function AISwapReview({
  review,
  deck,
  state,
  selected,
  working,
  onSelect,
  onApply,
  onInspect,
}: {
  review: AIReview;
  deck?: Document;
  state: ReviewState;
  selected: string[];
  working: boolean;
  onSelect: (id: string, on: boolean) => void;
  onApply: () => void;
  onInspect: (c: Card) => void;
}) {
  const [expired, setExpired] = useState(
    () => Date.parse(review.expiresAt) <= Date.now(),
  );
  useEffect(() => {
    const remaining = Date.parse(review.expiresAt) - Date.now();
    setExpired(remaining <= 0);
    if (remaining <= 0) return;
    const timer = setTimeout(() => setExpired(true), remaining);
    return () => clearTimeout(timer);
  }, [review.expiresAt]);
  const active = state === "pending" && !expired,
    selectedBudget = selectedReviewBudget(review, selected),
    total = selectedBudget.purchase;
  const binding =
    review.constraints && hasCardCriterion(review.constraints)
      ? review.constraints
      : undefined;
  const selectedDelta = binding
    ? review.pairs
        .filter((p) => selected.includes(p.id))
        .reduce((n, p) => {
          const cut =
            p.cut || deck?.entries.find((e) => e.id === p.cutId)?.card;
          return (
            n +
            (matchesAIRequest(p.add, binding) ? 1 : 0) -
            (cut && matchesAIRequest(cut, binding) ? 1 : 0)
          );
        }, 0)
    : 0;
  const countValid =
    !binding ||
    binding.intent !== "increase" ||
    !hasIncreaseTarget(binding) ||
    selectedDelta >= binding.minimumIncrease;
  return (
    <section className="ai-swap-review" aria-label="Proposed card swaps">
      <header>
        <h3>
          {state === "applied"
            ? "Applied swaps"
            : expired
              ? "Proposal expired"
              : active
                ? "Review card swaps"
                : "Previous proposal"}
        </h3>
        <p>
          {state === "applied"
            ? "Saved after your review."
            : expired
              ? "This review expired. Ask for a fresh proposal before saving."
              : active
                ? "Nothing saved. Compare both cards, then select the changes you want."
                : "This proposal is no longer active. The deck, inventory, budget or conversation changed; ask for a fresh review."}
        </p>
      </header>
      {review.constraintSummary && (
        <div className="ai-binding-request">
          <strong>Your request</strong>
          <p>{review.constraintSummary}</p>
          {typeof review.matchingBefore === "number" && (
            <p>
              Proposed matching mainboard cards: {review.matchingBefore} →{" "}
              {review.matchingAfter}
            </p>
          )}
        </div>
      )}
      {review.pairs.map((p, i) => {
        const entry = deck?.entries.find((e) => e.id === p.cutId),
          cut = p.cut || entry?.card,
          cutPrice =
            p.cutPrice !== undefined
              ? p.cutPrice
              : entry
                ? entryUnitPrice(entry)
                : null;
        return (
          <article
            className="ai-swap-pair"
            key={p.id}
            aria-label={"Swap " + p.cutName + " for " + p.add.name}
          >
            <div className="ai-swap-pair-title">
              <span>Swap {i + 1}</span>
              <span>
                {p.owned
                  ? "Owned · $0 to add"
                  : "$" + p.purchase.toFixed(2) + " new purchase"}
              </span>
            </div>
            <div className="ai-swap-cards">
              {cut ? (
                <PreviewCard
                  card={cut}
                  label="Remove"
                  price={cutPrice}
                  finish={p.cutFinish || entry?.finish}
                  onInspect={onInspect}
                />
              ) : (
                <div className="ai-missing-cut">
                  <span>Remove 1</span>
                  <strong>{p.cutName}</strong>
                  <p>Original printing unavailable. Request a fresh review.</p>
                </div>
              )}
              <span className="ai-swap-arrow" aria-hidden="true">
                →
              </span>
              <PreviewCard
                card={p.add}
                label="Add"
                price={p.addPrice === undefined ? p.purchase : p.addPrice}
                onInspect={onInspect}
              />
            </div>
            <div className="ai-swap-explanation">
              <p>
                <strong>Why this fits</strong>
                {p.quality?.summary || p.reason}
              </p>
              {p.quality && (
                <>
                  <p>
                    <strong>Tradeoff</strong>
                    {p.quality.tradeoff}
                  </p>
                  <p className="ai-swap-metrics">
                    {p.quality.roleChange}
                    <br />
                    {p.quality.curveChange}
                  </p>
                </>
              )}
            </div>
            {active && (
              <label className="ai-swap-select">
                <input
                  type="checkbox"
                  aria-label={"Select swap " + p.cutName + " for " + p.add.name}
                  disabled={working || !cut}
                  checked={selected.includes(p.id)}
                  onChange={(e) => onSelect(p.id, e.target.checked)}
                />
                <span>Include this swap</span>
              </label>
            )}
          </article>
        );
      })}
      {active && (
        <footer className="ai-swap-footer">
          {binding && hasIncreaseTarget(binding) && (
            <p>
              Selected matching cards: {review.matchingBefore} →{" "}
              {(review.matchingBefore || 0) + selectedDelta}
              {binding.intent === "increase" && hasIncreaseTarget(binding)
                ? " · needs +" + binding.minimumIncrease + " or more"
                : ""}
            </p>
          )}
          <p>
            {selected.length} selected · {review.count} cards after swaps ·
            {review.budgetMeaning === "deck"
              ? `Total deck cap $${review.totalBudget?.toFixed(2)} including commander; full proposed deck $${review.deckValue?.toFixed(2) ?? "unknown"}. Selected deck $${selectedBudget.deckValue?.toFixed(2) ?? "unknown"}; server rechecks on apply. New purchases $${total.toFixed(2)}.`
              : `${total.toFixed(2)} / $${review.budget.toFixed(2)} new purchases`}
          </p>
          {selectedBudget.reason && <p role="alert">{selectedBudget.reason}</p>}
          <p className="builder-help">
            Cuts provide no sale credit. USD estimates may be cached up to 24
            hours; taxes and shipping excluded. Review expires{" "}
            {new Date(review.expiresAt).toLocaleTimeString()}.
          </p>
          <button
            className="primary"
            disabled={
              working ||
              !selected.length ||
              !countValid ||
              !selectedBudget.valid ||
              review.pairs.some(
                (p) => !p.cut && !deck?.entries.some((e) => e.id === p.cutId),
              )
            }
            onClick={onApply}
          >
            {working ? "Saving…" : "Apply reviewed swaps"}
          </button>
        </footer>
      )}
    </section>
  );
}
