import {
  suggestionExplanation,
  uniqueRoleLabels,
} from "../shared/suggestionPresentation";
import {
  evidenceFor,
  evidenceUrl,
  evidenceReviewedAt,
} from "../shared/commanderEvidence";
import { availableSuggestions } from "../shared/suggestionMembership";
import { rankCommanderCards } from "../shared/commanderRelevance";
import { isMainDeckCard } from "../shared/deckEligibility";
import StrategyPicker from "./StrategyPicker";
import {
  normalizeSelection,
  selectionQuery,
  selectionSummary,
  type StrategySelection,
} from "../shared/strategySelection";
import { deckSearchTerms } from "../shared/discovery";
import { plainTextInputProps } from "./inputBehavior";
import { useEffect, useState } from "react";
import type { Board, Card, Document } from "../shared/model";
import { image, validateDeck } from "../shared/model";
import { includedCopies } from "../shared/discovery";
import {
  filterSuggestions,
  mechanics,
  ownedCopies,
  roleNames,
  roles,
  suggestionPrice,
  suggestionsFor,
  type Role,
  type Strategy,
} from "../shared/recommendations";
import { api } from "./api";
type Reply = { contextKey?: string; cards: Card[]; unavailable: string[]; source: "scryfall" };
export default function CommanderSuggestions({
  deck,
  documents,
  board,
  onBoard,
  onAdd,
  onOpen,
  onUndo,
  onImport,
  active = true,
  onSaveStrategy,
}: {
  active?: boolean;
  deck: Document;
  documents: Document[];
  board: Board;
  onBoard: (board: Board) => void;
  onAdd: (card: Card) => Promise<void>;
  onOpen: (card: Card) => void;
  onUndo?: () => Promise<void>;
  onImport: () => void;
  onSaveStrategy: (selection: StrategySelection) => Promise<void>;
}) {
  const key = `cardchasm-suggestion-filters:${deck.id}`;
  const [initial] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(key) || "{}");
    } catch {
      return {};
    }
  });
  const [selection, setSelection] = useState(() =>
    normalizeSelection(initial.selection || deck.strategy),
  );
  const [role, setRole] = useState<Role | "all">(
    roles.includes(initial.role) ? initial.role : "all",
  );
  const [strategy, setStrategy] = useState<Strategy>(
    ["auto", "any", ...mechanics].includes(initial.strategy)
      ? initial.strategy
      : "auto",
  );
  const [budget, setBudget] = useState(
    typeof initial.budget === "string" ? initial.budget.slice(0, 20) : "",
  );
  const [owned, setOwned] = useState(initial.owned === true),
    [rules, setRules] = useState(initial.rules !== false);
  const [reply, setReply] = useState<Reply | null>(null),
    [loading, setLoading] = useState(false),
    [message, setMessage] = useState("");
  const [pending, setPending] = useState(false),
    [retry, setRetry] = useState(0);
  const [visibleLimit, setVisibleLimit] = useState(12);
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    setVisibleLimit(12);
  }, [role, strategy, budget, owned, rules, reply, selection]);
  const commanders = deck.entries
    .filter((entry) => entry.board === "commander")
    .map((entry) => entry.card);
  const commanderIds = commanders.map((card) => card.id).join(",");
  useEffect(() => {
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({ role, strategy, budget, owned, rules, selection }),
      );
    } catch {
      /* Filters remain usable in memory. */
    }
  }, [key, role, strategy, budget, owned, rules, selection]);
  const selectedQuery = selectionQuery(selection),
    scope = deckSearchTerms(deck, "mainboard", rules).join(" ");
  const contextKey = JSON.stringify([deck.id, commanderIds, deck.format, strategy, rules, selectedQuery, scope]);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    setReply(null);
    setMessage("");
    if (!commanderIds || commanderIds.split(",").length > 2) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const extra = selectedQuery;
    const baseline = api<Reply>(
      `/suggestions?commanders=${encodeURIComponent(commanderIds)}&format=${encodeURIComponent(deck.format)}&strategy=${strategy}&rules=${rules ? "1" : "0"}`,
    );
    const themed = extra
      ? api<{ data: Card[] }>(
          `/cards?q=${encodeURIComponent(extra + " " + scope)}`,
        )
      : Promise.resolve({ data: [] as Card[] });
    void Promise.allSettled([baseline, themed])
      .then((results) => {
        if (!alive) return;
        const base = results[0],
          tags = results[1];
        const cards = new Map<string, Card>();
        const unavailable: string[] = [];
        if (base.status === "fulfilled") {
          const data = base.value as Reply;
          data.cards.forEach((card) =>
            cards.set(card.oracle_id || card.id, card),
          );
          unavailable.push(...data.unavailable);
        } else unavailable.push("baseline support");
        if (tags.status === "fulfilled")
          (tags.value as { data: Card[] }).data.forEach((card) =>
            cards.set(card.oracle_id || card.id, card),
          );
        else unavailable.push("selected tags/types");
        if (
          !cards.size &&
          base.status === "rejected" &&
          tags.status === "rejected"
        )
          setMessage(
            "Card suggestions are unavailable. Your selections remain; retry or search cards directly.",
          );
        setReply({
          contextKey,
          cards: [...cards.values()],
          unavailable,
          source: "scryfall",
        });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [
    active,
    contextKey,
    commanderIds,
    deck.format,
    strategy,
    rules,
    retry,
    selectedQuery,
    scope,
  ]);
  const candidates = availableSuggestions(reply?.contextKey === contextKey ? reply.cards : [], deck);
  const reasons = new Map(
    suggestionsFor(candidates, commanders, strategy).map((s) => [s.card.id, s]),
  );
  const ranked = rankCommanderCards(candidates, commanders, selection);
  for (const ranking of ranked)
    if (ranking.score > 0) {
      const entry = reasons.get(ranking.card.id) || {
        card: ranking.card,
        reasons: [],
      };
      entry.reasons.unshift(
        ...ranking.reasons.map((text) => ({ role: "synergy" as const, text })),
      );
      reasons.set(ranking.card.id, entry);
    }
  const suggestions = ranked
    .filter((r) => isMainDeckCard(r.card) && reasons.has(r.card.id))
    .map((r) => reasons.get(r.card.id)!);
  const validBudget =
    budget === "" || (Number.isFinite(Number(budget)) && Number(budget) >= 0);
  const shown = validBudget
    ? filterSuggestions(suggestions, deck, documents, {
        role,
        strategy,
        rules,
        owned,
        maxPrice: budget === "" ? null : Number(budget),
      })
    : [];
  const conflicts = validateDeck(deck).errors.filter((error) =>
    /outside commander color|not_legal|banned/i.test(error),
  );
  async function run(operation: () => Promise<void>, success: string) {
    setPending(true);
    setMessage("");
    try {
      await operation();
      setMessage(success);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      className="commander-suggestions"
      aria-label="Commander suggestions"
    >
      <div className="screen-heading">
        <div>
          <h2>Suggestions</h2>
          <p>
            {commanders.map((card) => card.name).join(" + ") ||
              "Choose your commander first"}
          </p>
        </div>
        <button
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((value) => !value)}
        >
          Filters
        </button>
      </div>
      <p className="suggestion-source">
        Scryfall card facts · Commander-focused choices
      </p>
      <div className="suggestion-advanced" hidden={!filtersOpen}>
        <div className="suggestion-filters">
          <label>
            Category
            <select
              aria-label="Suggestion category"
              value={role}
              onChange={(event) => setRole(event.target.value as Role | "all")}
            >
              <option value="all">All support</option>
              {roles.map((value) => (
                <option key={value} value={value}>
                  {roleNames[value]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Strategy
            <select
              aria-label="Suggestion strategy"
              value={strategy}
              onChange={(event) => setStrategy(event.target.value as Strategy)}
            >
              <option value="auto">Commander focus</option>
              <option value="any">Any strategy</option>
              {mechanics.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label hidden={!filtersOpen}>
            Max USD per card
            <input
              {...plainTextInputProps}
              aria-label="Suggestion budget"
              type="number"
              min="0"
              step="0.25"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              placeholder="No limit"
            />
          </label>
          <label hidden={!filtersOpen}>
            Add to
            <select
              aria-label="Suggestion board"
              value={board}
              onChange={(event) => onBoard(event.target.value as Board)}
            >
              {["mainboard", "sideboard", "maybeboard"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        <StrategyPicker
          value={selection}
          commanders={commanders}
          disabled={pending}
          onChange={setSelection}
        />
        <p className="help-text">
          Plan: {selectionSummary(selection)}. Changes take effect when you save
          the strategy.
        </p>
        <button
          disabled={pending}
          onClick={() =>
            run(
              () => onSaveStrategy(selection),
              "Strategies and descriptive labels saved to this deck.",
            )
          }
        >
          Save strategies to deck
        </button>
        <div className="suggestion-toggles">
          <label hidden={!filtersOpen}>
            <input
              {...plainTextInputProps}
              type="checkbox"
              checked={owned}
              onChange={(event) => setOwned(event.target.checked)}
            />
            Owned only
          </label>
          <label hidden={!filtersOpen}>
            <input
              {...plainTextInputProps}
              type="checkbox"
              checked={rules}
              onChange={(event) => setRules(event.target.checked)}
            />
            Use deck rules
          </label>
          <button
            onClick={() => setRetry((value) => value + 1)}
            disabled={loading || !commanders.length}
          >
            Refresh
          </button>
          <button
            disabled={!onUndo || pending}
            onClick={() => onUndo && run(onUndo, "Last saved edit undone.")}
          >
            Undo last edit
          </button>
        </div>
      </div>
      {!filtersOpen && (
        <small className="suggestion-filter-summary">
          {owned ? "Owned · " : ""}
          {budget !== "" ? `Max $${budget} · ` : ""}
          {rules ? "Deck rules · " : "All cards · "}
          {board}
        </small>
      )}
      {budget !== "" && (
        <p className="help-text">
          Unpriced cards hidden by budget · USD estimate for this printing.
        </p>
      )}
      {!validBudget && (
        <p role="alert">Enter a nonnegative budget or leave it blank.</p>
      )}
      {!!conflicts.length && (
        <details
          className="suggestion-conflicts"
          role="status"
          open={window.matchMedia("(min-width: 1000px)").matches}
        >
          <summary>Review {conflicts.length} incompatible deck cards</summary>
          {conflicts.slice(0, 3).map((text) => (
            <small key={text}>{text}</small>
          ))}
          <small>Your cards have not been removed.</small>
        </details>
      )}
      {loading && <p role="status">Loading card facts for your commander…</p>}
      {message && (
        <p role="status" className="inline-status">
          {message}
        </p>
      )}
      {!commanders.length && (
        <p>Set a commander to see color-aware support suggestions.</p>
      )}
      {commanders.length > 2 && (
        <p>
          Choose one commander or a supported pair before loading suggestions.
        </p>
      )}
      {!!reply?.unavailable.length && (
        <p role="status">
          Some categories could not be loaded: {reply.unavailable.join(", ")}.
          Refresh to try again.
        </p>
      )}
      {reply && !loading && (
        <p className="suggestion-count">
          Recommended choices · {Math.min(visibleLimit, shown.length)} shown
        </p>
      )}
      {reply && !loading && !shown.length && (
        <p>
          No available candidates match these filters. Broaden the category,
          strategy or budget, or search cards directly.
        </p>
      )}
      <div className="suggestion-results">
        {shown.slice(0, visibleLimit).map(({ card, reasons }) => (
          <article key={card.id} className="suggestion-card">
            <button
              className="suggestion-detail"
              onClick={(event) => {
                event.currentTarget.focus();
                onOpen(card);
              }}
            >
              {image(card) && (
                <img src={image(card)} alt={card.name} loading="lazy" />
              )}
              <span>
                <strong>{card.name}</strong>
                <small>
                  {card.mana_cost || card.type_line} ·{" "}
                  {role === "all"
                    ? uniqueRoleLabels(
                        reasons.map((reason) => roleNames[reason.role]),
                      )
                        .slice(0, 3)
                        .join(" · ")
                    : roleNames[role]}
                </small>
              </span>
            </button>
            <p>{suggestionExplanation(card, commanders)}</p>
            <small>
              {includedCopies(deck, card, board)} in {board} ·{" "}
              {ownedCopies(card, documents)} owned ·{" "}
              {suggestionPrice(card) === null
                ? "Price unavailable"
                : `$${suggestionPrice(card)!.toFixed(2)} USD`}
            </small>
            <div>
              <button
                className="primary"
                aria-label={`Add suggestion ${card.name}`}
                disabled={pending}
                onClick={() =>
                  run(() => onAdd(card), `Added ${card.name} to ${board}.`)
                }
              >
                + Add
              </button>
              {card.scryfall_uri?.startsWith("https://scryfall.com/") && (
                <a href={card.scryfall_uri} target="_blank" rel="noreferrer">
                  Scryfall facts ↗
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
      {shown.length > visibleLimit && (
        <button onClick={() => setVisibleLimit((value) => value + 12)}>
          Explore more matches
        </button>
      )}
      <details className="suggestion-provenance">
        <summary>Sources & deck imports</summary>
        {evidenceFor(commanders) && (
          <p>
            <a
              href={evidenceUrl(evidenceFor(commanders)!.slug)}
              target="_blank"
              rel="noreferrer"
            >
              {evidenceFor(commanders)!.theme} · reviewed {evidenceReviewedAt}
            </a>
          </p>
        )}
        <p>
          Mechanic matches are StackSynergy rules, not community inclusion rates
          or synergy scores. Scryfall facts and USD prices may be cached for up
          to 24 hours; inspect rules and printings before adding.
        </p>
        <p>
          A small sample of public EDHREC recommendations was manually reviewed
          on 2026-10-19. These examples guide StackSynergy rules; no live
          inclusion feed or model training is used. Imported decklists remain
          separate from owned inventory.
        </p>
        <a href="https://edhrec.com/recs" target="_blank" rel="noreferrer">
          EDHREC deck recommendation tool ↗
        </a>
        <button onClick={onImport}>Paste an exported decklist</button>
      </details>
    </section>
  );
}
