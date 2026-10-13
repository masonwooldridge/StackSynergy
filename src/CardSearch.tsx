import { useEffect, useRef, useState } from "react";
import type { Board, Card, Document } from "../shared/model";
import { formats, image } from "../shared/model";
import { api } from "./api";
import { NavIcon } from "./Brand";
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
}: {
  documents: Document[];
  targetId: string;
  onTarget: (id: string) => void;
  board: Board;
  onBoard: (board: Board) => void;
  onOpen: (card: Card) => void;
  onAdd: (card: Card) => Promise<void>;
  onBack: () => void;
  canSave: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Card[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState("");
  const [filters, setFilters] = useState(false);
  const [type, setType] = useState("");
  const [color, setColor] = useState("");
  const [format, setFormat] = useState("");
  const [maxMana, setMaxMana] = useState("");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [view, setView] = useState<"list" | "grid">("list");
  const [more, setMore] = useState(false);
  const [page, setPage] = useState(1);
  const [lastQuery, setLastQuery] = useState("");
  const requestId = useRef(0);
  const target = documents.find((d) => d.id === targetId);
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
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    let alive = true;
    const timer = setTimeout(() => {
      api<{ data: string[] }>(
        "/cards?mode=autocomplete&q=" + encodeURIComponent(query),
      )
        .then((r) => {
          if (alive) setSuggestions(r.data);
        })
        .catch(() => {});
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);
  function buildQuery(term = query) {
    return [
      term.trim(),
      type && `t:${type}`,
      color && `id<=${color}`,
      format && `f:${format}`,
      maxMana && `mv<=${maxMana}`,
    ]
      .filter(Boolean)
      .join(" ");
  }
  async function search(nextPage = 1, term = query) {
    const id = ++requestId.current;
    if (ownedOnly) {
      const local = Array.from(
        new Map(
          inventory.map((e) => [e.card.oracle_id || e.card.name, e.card]),
        ).values(),
      ).filter((card) => {
        const matchesName =
          !term.trim() ||
          card.name.toLowerCase().includes(term.trim().toLowerCase());
        const matchesType =
          !type || (card.type_line || "").toLowerCase().includes(type);
        const matchesColor =
          !color ||
          (card.color_identity || []).every((c) =>
            color.toUpperCase().includes(c),
          );
        return (
          matchesName &&
          matchesType &&
          matchesColor &&
          (!format || card.legalities?.[format] === "legal") &&
          (!maxMana || (card.cmc || 0) <= Number(maxMana))
        );
      });
      setLoading(false);
      setResults(local);
      setMore(false);
      setPage(1);
      setStatus(
        local.length
          ? "Showing your owned cards."
          : "No owned cards match these filters.",
      );
      return;
    }
    const q = nextPage > 1 ? lastQuery : buildQuery(term);
    if (!q) {
      setStatus("Enter a card name or choose a filter.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const r = await api<{ data: Card[]; has_more: boolean }>(
        `/cards?q=${encodeURIComponent(q)}&page=${nextPage}`,
      );
      if (id !== requestId.current) return;
      setResults((cards) => (nextPage === 1 ? r.data : [...cards, ...r.data]));
      setMore(r.has_more);
      setPage(nextPage);
      setLastQuery(q);
    } catch (e) {
      if (id === requestId.current) setStatus((e as Error).message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }
  async function add(card: Card) {
    setAdding(card.id);
    setStatus("");
    try {
      await onAdd(card);
      setStatus(`Added ${card.name} to ${target?.name}.`);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setAdding("");
    }
  }
  const shown = ownedOnly ? results.filter((c) => owned(c) > 0) : results;
  return (
    <section className="search-screen">
      <div className="screen-heading">
        <div>
          <h1>{target ? "Add cards" : "Search cards"}</h1>
          <p>
            {target
              ? `Choose cards for ${target.name}.`
              : "Find any card. Tap it for printings, rules and prices."}
          </p>
        </div>
        {target && <button onClick={onBack}>Done</button>}
      </div>
      <form
        className="compact-search"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <NavIcon name="Discover" />
        <input
          aria-label="Card search"
          autoComplete="off"
          list="card-suggestions"
          placeholder="Card name or Scryfall query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <datalist id="card-suggestions">
          {suggestions.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </datalist>
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
      {filters && (
        <div className="filter-panel">
          <label>
            Card type
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Any type</option>
              {[
                "creature",
                "instant",
                "sorcery",
                "artifact",
                "enchantment",
                "planeswalker",
                "land",
                "battle",
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Color identity
            <select value={color} onChange={(e) => setColor(e.target.value)}>
              <option value="">Any color</option>
              <option value="w">White</option>
              <option value="u">Blue</option>
              <option value="b">Black</option>
              <option value="r">Red</option>
              <option value="g">Green</option>
              <option value="wu">White / Blue</option>
              <option value="ub">Blue / Black</option>
              <option value="br">Black / Red</option>
              <option value="rg">Red / Green</option>
              <option value="gw">Green / White</option>
              <option value="c">Colorless</option>
            </select>
          </label>
          <label>
            Legal in
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="">Any format</option>
              {formats.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label>
            Max mana value
            <input
              type="number"
              min="0"
              max="30"
              value={maxMana}
              onChange={(e) => setMaxMana(e.target.value)}
            />
          </label>
          <button
            onClick={() => {
              setType("");
              setColor("");
              setFormat("");
              setMaxMana("");
              setOwnedOnly(false);
            }}
          >
            Clear filters
          </button>
        </div>
      )}
      <div className="search-destination">
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
        {target?.kind === "deck" && (
          <label>
            Board
            <select
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
      <div className="results-toolbar">
        <span>
          {results.length
            ? `${shown.length} cards${more ? " · more available" : ""}`
            : "Search the card database"}
        </span>
        <label className="checkbox">
          <input
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
      {status && (
        <p className="inline-status" role="status">
          {status}
        </p>
      )}
      {!loading && !results.length && (
        <div className="workspace-empty">
          <NavIcon name="Discover" />
          <h2>Find your next card</h2>
          <p>Search by name, or use filters for type, color and format.</p>
          <div className="toolbar">
            {["Sol Ring", "Lightning Bolt", "Forest"].map((name) => (
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
            <button className="result-card" onClick={() => onOpen(card)}>
              {image(card) && (
                <img src={image(card)} alt={card.name} loading="lazy" />
              )}
              <span>
                <strong>{card.name}</strong>
                <small>
                  {card.mana_cost} · {card.type_line}
                </small>
                <small>
                  {owned(card)} owned ·{" "}
                  {card.prices?.usd
                    ? `$${card.prices.usd}`
                    : "Price unavailable"}
                </small>
              </span>
            </button>
            <button
              className="quick-add"
              aria-label={`Add ${card.name}`}
              title={
                target
                  ? `Add the displayed ${card.set?.toUpperCase()} printing to ${target.name}`
                  : "Choose an Add to destination first"
              }
              disabled={!canSave || !target || !!adding}
              onClick={() => add(card)}
            >
              {adding === card.id ? "…" : "+"}
            </button>
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
          You can search without an account. Sign in to save cards.
        </p>
      )}
      {target && (
        <p className="help-text">
          + adds the displayed printing. Tap the card to choose another printing
          or finish.
        </p>
      )}
    </section>
  );
}
