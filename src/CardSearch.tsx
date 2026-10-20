import { matchesOwnedSearch, sortOwnedSearch } from "../shared/ownedCardSearch";
import SearchFilters from "./SearchFilters";
import {
  buildCardSearch,
  defaultSearchFilters,
  type SearchFilters as FilterState,
  type CardSet,
} from "../shared/searchFilters";
import "./CardSearch.css";
import { plainTextInputProps } from "./inputBehavior";
import { useEffect, useId, useRef, useState } from "react";
import type { Board, Card, Document } from "../shared/model";
import { image } from "../shared/model";
import { api } from "./api";
import { NavIcon } from "./Brand";
import {
  deckSearchTerms,
  includedCopies,
  matchesDeckRules,
} from "../shared/discovery";
export default function CardSearch({
  documents,
  targetId,
  onTarget,
  board,
  onBoard,
  onOpen,
  onAdd,
  onBack,
  canSave,
  embedded = false,
  active = true,
  onUndo,
  onReplaceCommander,
}: {
  documents: Document[];
  targetId: string;
  onTarget: (id: string) => void;
  board: Board;
  onBoard: (board: Board) => void;
  onOpen: (card: Card) => void;
  onAdd: (card: Card, quantity?: number) => Promise<void>;
  onBack: () => void;
  canSave: boolean;
  embedded?: boolean;
  active?: boolean;
  onUndo?: () => Promise<void>;
  onReplaceCommander?: (card: Card, entryId: string) => Promise<void>;
}) {
  const tabsId = useId();
  const stateKey =
    "cardchasm-card-search-v2:" +
    (embedded ? targetId + ":" + board : "global");
  const [initial] = useState<{
    advanced?: Partial<FilterState>;
    query?: string;
    searchTab?: "cards" | "sets";
    filters?: boolean;
    results?: Card[];
    view?: "grid" | "list";
    page?: number;
    lastQuery?: string;
    more?: boolean;
    lastOptions?: FilterState;
  }>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(stateKey) || "{}");
    } catch {
      return {};
    }
  });
  const [advanced, setAdvanced] = useState<FilterState>({
    ...defaultSearchFilters,
    ...initial.advanced,
  });
  const [lastOptions, setLastOptions] = useState<FilterState>(
    initial.lastOptions || { ...defaultSearchFilters, ...initial.advanced },
  );
  const [searchTab, setSearchTab] = useState<"cards" | "sets">(
    initial.searchTab || "cards",
  );
  const [sets, setSets] = useState<CardSet[]>([]);
  const [setsMessage, setSetsMessage] = useState("");
  const [setsLoading, setSetsLoading] = useState(false);
  const [query, setQuery] = useState(() =>
    embedded
      ? initial.query || ""
      : new URLSearchParams(location.search).get("q") || initial.query || "",
  );
  const [deckRules, setDeckRules] = useState(true);
  const [addQuantity, setAddQuantity] = useState(1);
  const [undoing, setUndoing] = useState(false);
  const [replaceCommanderId, setReplaceCommanderId] = useState("");
  const [results, setResults] = useState<Card[]>(initial.results || []);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState("");
  const [filters, setFilters] = useState(initial.filters ?? !embedded);
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [view, setView] = useState<"list" | "grid">(initial.view || "grid");
  const [more, setMore] = useState(initial.more || false);
  const [page, setPage] = useState(initial.page || 1);
  const [lastQuery, setLastQuery] = useState(initial.lastQuery || "");
  useEffect(() => {
    if (
      embedded ||
      new URLSearchParams(location.search).get("screen") !== "Discover"
    )
      return;
    const url = new URL(location.href);
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    history.replaceState(history.state, "", url);
  }, [query, embedded]);
  useEffect(() => {
    if (embedded) return;
    const pop = () =>
      setQuery(new URLSearchParams(location.search).get("q") || "");
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [embedded]);
  const requestId = useRef(0);
  const searchInput = useRef<HTMLInputElement>(null);
  const typeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(typeTimer.current), []);
  const target = documents.find((d) => d.id === targetId);
  const commanderRows =
    target?.entries.filter((entry) => entry.board === "commander") || [];
  const replacing =
    commanderRows.find((entry) => entry.id === replaceCommanderId) ||
    commanderRows[0];
  const inventory = documents
    .filter((d) => d.kind === "collection")
    .flatMap((d) => d.entries);
  const owned = (card: Card) =>
    inventory
      .filter(
        (e) =>
          (e.card.oracle_id || e.card.name) === (card.oracle_id || card.name),
      )
      .reduce((n, e) => n + e.qty, 0);
  useEffect(() => {
    // Keep the legacy hook slot empty during Fast Refresh so the open search retains
    // its query/results/filters. No automatic completion requests are performed.
    if (suggestions.length) setSuggestions([]);
  }, [query, suggestions]);
  const constraints = deckSearchTerms(target, board, embedded && deckRules);
  const scopeSignature = constraints.join(" ") + "|" + board;
  useEffect(() => {
    if (!embedded) return;
    requestId.current++;
    clearTimeout(typeTimer.current);
    if (board === "commander") setQuery("");
    setResults([]);
    setMore(false);
    setLoading(false);
    setLastQuery("");
  }, [scopeSignature, embedded, board]);
  useEffect(() => {
    if (!embedded || !active || board !== "commander") return;
    const frame = requestAnimationFrame(() => {
      searchInput.current?.focus();
      searchInput.current?.scrollIntoView({
        block: "center",
        behavior: "instant",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [active, embedded, board]);
  function buildQuery(term = query) {
    return buildCardSearch(
      embedded && board === "commander" && term.trim()
        ? `name:${JSON.stringify(term.trim().replace(/[’‘]/g, "'"))}`
        : term,
      advanced,
      constraints,
    );
  }
  useEffect(() => {
    try {
      sessionStorage.setItem(
        stateKey,
        JSON.stringify({
          advanced,
          query,
          searchTab,
          filters,
          view,
          results,
          more,
          page,
          lastQuery,
          lastOptions,
        }),
      );
    } catch {
      /* Current search remains available in memory. */
    }
  }, [
    stateKey,
    advanced,
    query,
    searchTab,
    filters,
    view,
    results,
    more,
    page,
    lastQuery,
    lastOptions,
  ]);
  useEffect(() => {
    if (searchTab !== "sets" || sets.length) return;
    let alive = true;
    setSetsLoading(true);
    setSetsMessage("");
    api<{ data: CardSet[] }>("/sets")
      .then((r) => {
        if (alive) setSets(r.data);
      })
      .catch((e) => {
        if (alive) setSetsMessage(e.message);
      })
      .finally(() => {
        if (alive) setSetsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [searchTab, sets.length]);
  async function search(nextPage = 1, term = query, overrides = advanced) {
    const id = ++requestId.current;
    const options = nextPage > 1 ? lastOptions : overrides;
    let built: string;
    try {
      built =
        nextPage > 1
          ? lastQuery
          : overrides === advanced
            ? buildQuery(term)
            : buildCardSearch(term, overrides, constraints);
    } catch (e) {
      setStatus((e as Error).message);
      return;
    }
    if (ownedOnly && nextPage === 1 && !/[:<>=]/.test(term)) {
      const local = [
        ...new Map(
          inventory.map((e) => [
            options.groupPrintings
              ? e.card.oracle_id || e.card.name
              : e.card.id,
            e.card,
          ]),
        ).values(),
      ].filter(
        (card) =>
          matchesOwnedSearch(card, options, term) &&
          matchesDeckRules(card, target, board, embedded && deckRules),
      );
      setResults(sortOwnedSearch(local, options));
      setMore(false);
      setPage(1);
      setLastQuery(built);
      setLastOptions(options);
      setFilters(false);
      setLoading(false);
      setStatus(
        local.length
          ? "Showing matching owned printings from saved card facts."
          : "No owned cards match these filters in saved card facts.",
      );
      return;
    }
    if (ownedOnly && nextPage === 1) {
      const ids = [
        ...new Set(inventory.map((e) => e.card.oracle_id).filter(Boolean)),
      ];
      if (!ids.length) {
        setResults([]);
        setStatus("No owned cards to search.");
        return;
      }
      built += " (" + ids.map((id) => "oracleid:" + id).join(" or ") + ")";
      if (built.length > 1000) {
        setStatus(
          "Owned-only search exceeds the provider query limit. Choose a smaller collection or turn off Owned only.",
        );
        return;
      }
    }
    const q = nextPage > 1 ? lastQuery : built;
    if (!q) {
      setStatus("Enter a card name or choose a filter.");
      return;
    }
    setLoading(true);
    setFilters(false);
    setSearchTab("cards");
    setStatus("");
    try {
      const r = await api<{ data: Card[]; has_more: boolean }>(
        `/cards?q=${encodeURIComponent(q)}&page=${nextPage}&unique=${options.groupPrintings ? "cards" : "prints"}&order=${options.order}&dir=${options.direction}&extras=${options.ignoreNonlegal ? "0" : "1"}&multilingual=1`,
      );
      if (id !== requestId.current) return;
      setResults((cards) => (nextPage === 1 ? r.data : [...cards, ...r.data]));
      if (!r.data.length)
        setStatus(
          board === "commander"
            ? "No commanders found. Try another name."
            : "No cards found. Try another search.",
        );
      setMore(r.has_more);
      setPage(nextPage);
      setLastQuery(q);
      if (nextPage === 1) setLastOptions(overrides);
    } catch (e) {
      if (id === requestId.current)
        setStatus(
          embedded &&
            board === "commander" &&
            (e as Error).message === "Card provider returned 404"
            ? "No commanders found. Try another name."
            : (e as Error).message,
        );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }
  async function add(card: Card) {
    setAdding(card.id);
    setStatus("");
    try {
      await onAdd(card, embedded ? addQuantity : 1);
      setStatus(
        `Added ${embedded ? addQuantity + " × " : ""}${card.name} to ${target?.name}${embedded ? " · " + board : ""}.`,
      );
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setAdding("");
    }
  }
  const filterLabels: Partial<Record<keyof FilterState, string>> = {
    ignoreNonlegal: "format legality",
    minColors: "minimum colors",
    maxColors: "maximum colors",
    minPrice: "minimum USD price",
    maxPrice: "maximum USD price",
    minMana: "minimum mana value",
    maxMana: "maximum mana value",
    minPower: "minimum power",
    maxPower: "maximum power",
    minToughness: "minimum toughness",
    maxToughness: "maximum toughness",
    type: "type line",
    oracle: "Oracle text",
    mana: "mana cost",
    set: "set",
    misc: "miscellaneous",
  };
  const activeFilters = (
    Object.keys(defaultSearchFilters) as (keyof FilterState)[]
  ).filter(
    (key) =>
      ![
        "language",
        "order",
        "direction",
        "groupPrintings",
        "colorMode",
        "identity",
      ].includes(key) &&
      JSON.stringify(advanced[key]) !==
        JSON.stringify(defaultSearchFilters[key]),
  );
  const shownSets = sets.filter(
    (set) =>
      !query.trim() ||
      (set.name + " " + set.code)
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const shown = ownedOnly ? results.filter((c) => owned(c) > 0) : results;
  return (
    <section
      className={
        embedded
          ? "search-screen reference-search embedded-discovery"
          : "search-screen reference-search"
      }
      aria-label={embedded ? "Search cards to add" : "Card discovery"}
    >
      <div className="screen-heading" hidden={!embedded}>
        <div>
          {embedded ? (
            <h2>
              {board === "commander"
                ? "Choose a commander"
                : "Search cards to add"}
            </h2>
          ) : (
            <h1>{target ? "Add cards" : "Search cards"}</h1>
          )}
          <p>
            {target
              ? embedded
                ? `Adding to ${target.name} · ${board}`
                : `Choose cards for ${target.name}.`
              : "Find any card. Tap it for printings, rules and prices."}
          </p>
        </div>
        {target && (
          <button onClick={onBack}>{embedded ? "Back to deck" : "Done"}</button>
        )}
      </div>
      <form
        className="compact-search"
        onSubmit={(e) => {
          e.preventDefault();
          clearTimeout(typeTimer.current);
          if (searchTab === "sets") setFilters(false);
          else void search();
        }}
      >
        <NavIcon name="Discover" />
        <input
          {...plainTextInputProps}
          ref={searchInput}
          aria-label={
            embedded
              ? board === "commander"
                ? "Search commanders"
                : "Search cards to add"
              : "Card search"
          }
          autoComplete="off"
          placeholder={
            board === "commander" && embedded
              ? "Type a commander name, e.g. Atraxa"
              : "Card name or Scryfall query"
          }
          value={query}
          onChange={(e) => {
            const value = e.target.value;
            setQuery(value);
            if (embedded && board === "commander") {
              clearTimeout(typeTimer.current);
              requestId.current++;
              setResults([]);
              setLoading(false);
              setStatus("");
              if (value.trim().length >= 2)
                typeTimer.current = setTimeout(
                  () => void search(1, value),
                  300,
                );
            }
          }}
        />

        {query && (
          <button
            type="button"
            className="clear-search"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              requestId.current++;
              setResults([]);
              setStatus("");
              setMore(false);
              setLoading(false);
              searchInput.current?.focus();
            }}
          >
            ×
          </button>
        )}
        <button
          type="button"
          className={filters ? "selected" : ""}
          onClick={() => setFilters((v) => !v)}
          aria-expanded={filters}
        >
          Filters
        </button>
        <button className="primary" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>
      {embedded && (
        <div className="discovery-scope">
          <label className="checkbox">
            <input
              {...plainTextInputProps}
              type="checkbox"
              checked={deckRules}
              onChange={(event) => setDeckRules(event.target.checked)}
            />
            Use deck rules
          </label>
          <small>
            {deckRules
              ? constraints
                  .map((term) =>
                    term.startsWith("f:")
                      ? term.slice(2)
                      : term === "is:commander"
                        ? "Eligible commanders"
                        : "Identity: " +
                          term.slice(4).toUpperCase().split("").join(" "),
                  )
                  .join(" · ") || "Choose a format in Details"
              : "All cards · legality checks still apply to your deck"}
          </small>
          {target?.format === "commander" &&
            board !== "commander" &&
            !target.entries.some((entry) => entry.board === "commander") && (
              <small>Choose a commander to filter color identity.</small>
            )}
        </div>
      )}
      <div
        className="search-tabs"
        role="tablist"
        aria-label="Search category"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const buttons =
            event.currentTarget.querySelectorAll<HTMLButtonElement>(
              "[role=tab]",
            );
          const index =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? 1
                : searchTab === "cards"
                  ? 1
                  : 0;
          buttons[index]?.click();
          buttons[index]?.focus();
        }}
      >
        <button
          id={tabsId + "cards"}
          role="tab"
          tabIndex={searchTab === "cards" ? 0 : -1}
          aria-controls={tabsId + "cards-panel"}
          aria-selected={searchTab === "cards"}
          onClick={() => setSearchTab("cards")}
        >
          ▱ Cards
        </button>
        <button
          id={tabsId + "sets"}
          role="tab"
          tabIndex={searchTab === "sets" ? 0 : -1}
          aria-controls={tabsId + "sets-panel"}
          aria-selected={searchTab === "sets"}
          onClick={() => {
            setSearchTab("sets");
            setFilters(false);
          }}
        >
          ▣ Sets
        </button>
      </div>
      <div
        id={tabsId + "cards-panel"}
        role="tabpanel"
        aria-labelledby={tabsId + "cards"}
        hidden={searchTab !== "cards"}
      >
        {status && searchTab === "cards" && (
          <p className="inline-status" role="status">
            {status}
          </p>
        )}
        {filters && searchTab === "cards" && (
          <SearchFilters
            value={advanced}
            onChange={setAdvanced}
            onApply={() => void search()}
          />
        )}

        {!filters && searchTab === "cards" && activeFilters.length > 0 && (
          <div
            className="active-search-filters"
            aria-label="Active search filters"
          >
            {activeFilters.map((key) => (
              <button
                key={key}
                aria-label={"Remove " + (filterLabels[key] || key) + " filter"}
                onClick={() => {
                  const next = {
                    ...advanced,
                    [key]: defaultSearchFilters[key],
                  };
                  setAdvanced(next);
                  void search(1, query, next);
                }}
              >
                {filterLabels[key] || key}:{" "}
                {Array.isArray(advanced[key])
                  ? (advanced[key] as string[]).join(", ")
                  : String(advanced[key])}{" "}
                ×
              </button>
            ))}
          </div>
        )}
        <div
          className="card-search-body"
          hidden={filters || searchTab !== "cards"}
        >
          <details className="search-save-destination" hidden={embedded}>
            <summary>
              Add destination {target ? "· " + target.name : "(optional)"}
            </summary>
            <div className="search-destination">
              {!embedded && (
                <label>
                  Add to
                  <select
                    aria-label="Search destination"
                    value={targetId}
                    onChange={(e) => onTarget(e.target.value)}
                  >
                    <option value="">Choose a deck, binder or list</option>
                    {documents.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ·{" "}
                        {d.kind === "collection"
                          ? "binder"
                          : d.kind === "wishlist"
                            ? "list"
                            : "deck"}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!embedded && target?.kind === "deck" && (
                <label>
                  Board
                  <select
                    aria-label="Add to board"
                    value={board}
                    onChange={(e) => onBoard(e.target.value as Board)}
                  >
                    {["mainboard", "sideboard", "maybeboard", "commander"].map(
                      (b) => (
                        <option key={b}>{b}</option>
                      ),
                    )}
                  </select>
                </label>
              )}
            </div>
          </details>
          {embedded && (
            <div className="discovery-add-controls">
              <label className="discovery-board">
                Board
                <select
                  aria-label="Add to board"
                  value={board}
                  onChange={(event) => onBoard(event.target.value as Board)}
                >
                  {["mainboard", "sideboard", "maybeboard", "commander"].map(
                    (value) => (
                      <option key={value}>{value}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Copies per add
                <input
                  {...plainTextInputProps}
                  aria-label="Copies per add"
                  type="number"
                  min="1"
                  max="100"
                  value={addQuantity}
                  onChange={(event) =>
                    setAddQuantity(Number(event.target.value))
                  }
                />
              </label>
              <button
                disabled={!onUndo || undoing || !!adding}
                onClick={async () => {
                  if (!onUndo) return;
                  setUndoing(true);
                  try {
                    await onUndo();
                    setStatus("Last saved edit undone.");
                  } catch (error) {
                    setStatus((error as Error).message);
                  } finally {
                    setUndoing(false);
                  }
                }}
              >
                {undoing ? "Undoing…" : "Undo last edit"}
              </button>
            </div>
          )}
          {embedded && board === "commander" && replacing && (
            <label className="commander-replacement-target">
              Replace commander row
              <select
                aria-label="Commander row to replace"
                value={replacing.id}
                onChange={(event) => setReplaceCommanderId(event.target.value)}
              >
                {commanderRows.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.card.name}
                  </option>
                ))}
              </select>
              <small>
                Replace updates this row. + adds an additional commander for a
                pair.
              </small>
            </label>
          )}
          <div className="results-toolbar">
            <span>
              {results.length
                ? `${shown.length} card${shown.length === 1 ? "" : "s"}${more ? " · more available" : ""}`
                : "Search the card database"}
            </span>
            <label className="checkbox">
              <input
                {...plainTextInputProps}
                type="checkbox"
                checked={ownedOnly}
                onChange={(e) => setOwnedOnly(e.target.checked)}
              />
              Owned only
            </label>
            <div className="segmented">
              <button
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                List
              </button>
              <button
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
              >
                Grid
              </button>
            </div>
          </div>
          {!loading && !results.length && (
            <div className="workspace-empty">
              <NavIcon name="Discover" />
              <h2>Find your next card</h2>
              <p>Search by name, or use filters for type, color and format.</p>
              <div className="toolbar">
                {(board === "commander"
                  ? [
                      "Satya, Aetherflux Genius",
                      "Krenko, Mob Boss",
                      "Muldrotha, the Gravetide",
                    ]
                  : ["Sol Ring", "Lightning Bolt", "Forest"]
                ).map((name) => (
                  <button
                    key={name}
                    onClick={() => {
                      setQuery(name);
                      void search(1, name);
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div
            className={
              view === "grid" ? "search-results grid" : "search-results list"
            }
          >
            {shown.map((card) => (
              <article key={card.id} className="search-result">
                <button
                  className="result-card"
                  onClick={(event) => {
                    event.currentTarget.focus();
                    onOpen(card);
                  }}
                >
                  <span className="result-art">
                    {image(card) ? (
                      <img
                        src={image(card)}
                        alt={card.name}
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.visibility = "hidden";
                          event.currentTarget.parentElement?.classList.add(
                            "image-unavailable",
                          );
                        }}
                      />
                    ) : (
                      <span className="result-image-missing">
                        Card image unavailable
                      </span>
                    )}
                    <span className="result-price">
                      {card.prices?.usd != null &&
                      card.prices.usd !== "" &&
                      Number.isFinite(Number(card.prices.usd))
                        ? `$${Number(card.prices.usd).toFixed(2)}`
                        : "Price —"}
                    </span>
                  </span>
                  <strong className="result-name">{card.name}</strong>
                  {view === "list" && (
                    <small>
                      {card.mana_cost} · {card.type_line} · {owned(card)} owned
                    </small>
                  )}
                </button>
                {embedded && (
                  <small className="included-count">
                    {includedCopies(target, card, board)} in {board}
                  </small>
                )}
                {embedded &&
                  board === "commander" &&
                  target?.entries.some(
                    (entry) => entry.board === "commander",
                  ) &&
                  onReplaceCommander && (
                    <button
                      className="replace-commander"
                      disabled={!!adding || undoing}
                      aria-label={`Replace commander with ${card.name}`}
                      onClick={async () => {
                        setAdding(card.id);
                        try {
                          await onReplaceCommander(card, replacing!.id);
                          setStatus(
                            `Commander changed to ${card.name}. Other deck cards were preserved.`,
                          );
                        } catch (error) {
                          setStatus((error as Error).message);
                        } finally {
                          setAdding("");
                        }
                      }}
                    >
                      Replace
                    </button>
                  )}
                {(embedded || target) && (
                  <button
                    className="quick-add"
                    aria-label={`Add ${card.name}`}
                    title={
                      target
                        ? `Add the displayed ${card.set ? card.set.toUpperCase() + " " : ""}printing to ${target.name}`
                        : "Choose an Add to destination first"
                    }
                    disabled={
                      !canSave ||
                      !target ||
                      !!adding ||
                      undoing ||
                      !Number.isInteger(addQuantity) ||
                      addQuantity < 1 ||
                      addQuantity > 100
                    }
                    onClick={() => add(card)}
                  >
                    {adding === card.id ? "…" : "+"}
                  </button>
                )}
              </article>
            ))}
          </div>
          {!!results.length && more && (
            <button
              className="load-more"
              disabled={loading}
              onClick={() => search(page + 1)}
            >
              Load more cards
            </button>
          )}
          {!canSave && (
            <p className="help-text">
              Create or select a local deck or binder to save cards. No account
              required.
            </p>
          )}
          {target && (
            <p className="help-text">
              + adds the displayed printing. Tap the card to choose another
              printing or finish.
            </p>
          )}
        </div>
      </div>
      {searchTab === "sets" && (
        <div
          className="set-search-results"
          id={tabsId + "sets-panel"}
          role="tabpanel"
          aria-labelledby={tabsId + "sets"}
        >
          <p role="status">
            {setsLoading
              ? "Loading sets…"
              : setsMessage || `${shownSets.length} sets`}
          </p>
          {!!setsMessage && (
            <button
              onClick={() => {
                setSearchTab("cards");
                setTimeout(() => setSearchTab("sets"), 0);
              }}
            >
              Retry sets
            </button>
          )}
          {!setsLoading && !setsMessage && !shownSets.length && (
            <p>No sets match this name or code.</p>
          )}
          {shownSets.slice(0, 150).map((set) => (
            <button
              className="set-search-row"
              key={set.id}
              onClick={() => {
                const next = { ...advanced, set: set.code };
                setAdvanced(next);
                setQuery("");
                setSearchTab("cards");
                void search(1, "", next);
              }}
            >
              <span>{set.code.toUpperCase()}</span>
              <strong>{set.name}</strong>
              <small>
                {set.card_count} cards · {set.released_at || "Date unavailable"}
              </small>
            </button>
          ))}
          {shownSets.length > 150 && (
            <p>Type a set name or code to narrow these results.</p>
          )}
        </div>
      )}
    </section>
  );
}
