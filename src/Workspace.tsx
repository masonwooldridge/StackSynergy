import { useState } from "react";
import type { Board, Card, Document, Entry } from "../shared/model";
import { formats, image, validateDeck } from "../shared/model";
import {
  cardCount,
  cardType,
  changeCopies,
  missingCards,
} from "../shared/deckEditing";
import { api, download } from "./api";
import { parseImport, exportCsv, exportDeck } from "./imports";
import { NavIcon } from "./Brand";
import DeckAnalytics from "./DeckAnalytics";
export function HomeScreen({
  documents,
  signedIn,
  onNavigate,
  onOpen,
  onCreate,
}: {
  documents: Document[];
  signedIn: boolean;
  onNavigate: (page: string) => void;
  onOpen: (doc: Document) => void;
  onCreate: (kind: Document["kind"]) => void;
}) {
  const binders = documents.filter((d) => d.kind === "collection"),
    decks = documents.filter((d) => d.kind === "deck");
  const cards = binders.reduce((n, d) => n + cardCount(d), 0);
  return (
    <section className="home-screen">
      <div className="screen-heading">
        <div>
          <h1>Your Magic, organized</h1>
          <p>Collection, decks and your next game.</p>
        </div>
        <button className="primary" onClick={() => onNavigate("Scan")}>
          <NavIcon name="Scan" /> Scan cards
        </button>
      </div>
      {!signedIn && (
        <div className="account-banner">
          <div>
            <strong>Keep your cards and decks in sync</strong>
            <p>Create an account or sign in to start saving.</p>
          </div>
          <button onClick={() => onNavigate("Settings")}>Sign in</button>
        </div>
      )}
      <div className="home-summary">
        <button onClick={() => onNavigate("Collections")}>
          <NavIcon name="Collections" />
          <strong>{cards.toLocaleString()}</strong>
          <span>Owned cards</span>
        </button>
        <button onClick={() => onNavigate("Collections")}>
          <NavIcon name="Collections" />
          <strong>{binders.length}</strong>
          <span>Binders</span>
        </button>
        <button onClick={() => onNavigate("Decks")}>
          <NavIcon name="Decks" />
          <strong>{decks.length}</strong>
          <span>Decks</span>
        </button>
      </div>
      <div className="quick-actions">
        {[
          ["Discover", "Search cards", "Find cards, printings and prices"],
          ["Scan", "Scan cards", "Camera or uploaded photos"],
          ["Multiplayer", "Play online", "Host or join a table"],
          ["Assistant", "Deck assistant", "Review suggestions for your deck"],
        ].map(([page, title, subtitle]) => (
          <button key={page} onClick={() => onNavigate(page)}>
            <NavIcon name={page} />
            <span>
              <strong>{title}</strong>
              <small>{subtitle}</small>
            </span>
            <span>›</span>
          </button>
        ))}
      </div>
      <div className="screen-heading minor">
        <h2>Your decks</h2>
        <button onClick={() => onCreate("deck")}>+ New deck</button>
      </div>
      {decks.length ? (
        <div className="document-grid">
          {decks.slice(0, 6).map((d) => (
            <DocumentTile key={d.id} document={d} onOpen={() => onOpen(d)} />
          ))}
        </div>
      ) : (
        <div className="workspace-empty small">
          <h3>Start your first deck</h3>
          <p>Choose a format, add a commander, then find your cards.</p>
          <button onClick={() => onCreate("deck")}>Create deck</button>
        </div>
      )}
      <div className="screen-heading minor">
        <h2>Your collection</h2>
        <button onClick={() => onCreate("collection")}>+ New binder</button>
      </div>
      {binders.length ? (
        <div className="document-grid">
          {binders.slice(0, 6).map((d) => (
            <DocumentTile key={d.id} document={d} onOpen={() => onOpen(d)} />
          ))}
        </div>
      ) : (
        <div className="workspace-empty small">
          <h3>Give your collection a home</h3>
          <p>Create a binder, then search or scan cards into it.</p>
          <button onClick={() => onCreate("collection")}>Create binder</button>
        </div>
      )}
    </section>
  );
}
function DocumentTile({
  document: d,
  onOpen,
}: {
  document: Document;
  onOpen: () => void;
}) {
  const cover =
    d.entries.find((e) => e.board === "commander")?.card || d.entries[0]?.card;
  return (
    <button className="document-tile" onClick={onOpen}>
      <div className="document-cover">
        {cover && image(cover) ? (
          <img src={image(cover)} alt="" loading="lazy" />
        ) : (
          <NavIcon name={d.kind === "deck" ? "Decks" : "Collections"} />
        )}
      </div>
      <span>
        <strong>{d.name}</strong>
        <small>
          {d.kind === "deck"
            ? d.format
            : d.kind === "wishlist"
              ? "Tracking list"
              : "Owned binder"}{" "}
          · {cardCount(d)} cards
        </small>
      </span>
      <span className="chevron">›</span>
    </button>
  );
}
export function LibraryScreen({
  kind,
  documents,
  signedIn,
  onOpen,
  onCreate,
  onNavigate,
}: {
  kind: "deck" | "collection";
  documents: Document[];
  signedIn: boolean;
  onOpen: (doc: Document) => void;
  onCreate: (kind: Document["kind"]) => void;
  onNavigate: (page: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState("binders");
  const [sort, setSort] = useState("name");
  const relevant = documents.filter((d) =>
    kind === "deck"
      ? d.kind === "deck"
      : tab === "lists"
        ? d.kind === "wishlist"
        : d.kind === "collection",
  );
  const filtered = relevant
    .filter((d) => d.name.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) =>
      sort === "cards"
        ? cardCount(b) - cardCount(a)
        : a.name.localeCompare(b.name),
    );
  return (
    <section>
      <div className="screen-heading">
        <div>
          <h1>{kind === "deck" ? "Decks" : "Collection"}</h1>
          <p>
            {kind === "deck"
              ? "Build and test your decks."
              : "Binders are owned cards. Lists track cards you want."}
          </p>
        </div>
        <button
          className="primary"
          onClick={() =>
            onCreate(
              kind === "deck"
                ? "deck"
                : tab === "lists"
                  ? "wishlist"
                  : "collection",
            )
          }
        >
          +{" "}
          {kind === "deck"
            ? "New deck"
            : tab === "lists"
              ? "New list"
              : "New binder"}
        </button>
      </div>
      {kind === "collection" && (
        <div className="workspace-tabs">
          <button
            aria-pressed={tab === "binders"}
            onClick={() => setTab("binders")}
          >
            Binders
          </button>
          <button aria-pressed={tab === "all"} onClick={() => setTab("all")}>
            All owned cards
          </button>
          <button
            aria-pressed={tab === "lists"}
            onClick={() => setTab("lists")}
          >
            Lists
          </button>
        </div>
      )}
      <div className="library-controls">
        <input
          aria-label={`Find ${kind === "deck" ? "deck" : tab === "all" ? "owned card" : "binder or list"}`}
          placeholder={
            kind === "deck"
              ? "Find a deck…"
              : tab === "all"
                ? "Find an owned card…"
                : "Find a binder or list…"
          }
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select
          aria-label="Sort documents"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="name">Name A–Z</option>
          <option value="cards">Most cards</option>
        </select>
      </div>
      {!signedIn && (
        <div className="account-banner">
          <p>Sign in to save and access your archive.</p>
          <button onClick={() => onNavigate("Settings")}>Sign in</button>
        </div>
      )}
      {kind === "collection" && tab === "all" ? (
        <div className="all-owned-cards">
          {relevant
            .flatMap((doc) =>
              doc.entries
                .filter((e) =>
                  `${e.card.name} ${e.card.set} ${e.tags}`
                    .toLowerCase()
                    .includes(filter.toLowerCase()),
                )
                .map((e) => ({ doc, e })),
            )
            .sort((a, b) =>
              sort === "cards"
                ? b.e.qty - a.e.qty
                : a.e.card.name.localeCompare(b.e.card.name),
            )
            .map(({ doc, e }) => (
              <button
                className="owned-card-location"
                key={`${doc.id}-${e.id}`}
                onClick={() => onOpen(doc)}
              >
                {image(e.card) && (
                  <img src={image(e.card)} alt="" loading="lazy" />
                )}
                <span>
                  <strong>{e.card.name}</strong>
                  <small>
                    {doc.name} · {e.card.set?.toUpperCase()} #
                    {e.card.collector_number} · {e.finish}
                  </small>
                </span>
                <strong>×{e.qty}</strong>
                <span>›</span>
              </button>
            ))}
          {filter &&
            !relevant.some((doc) =>
              doc.entries.some((e) =>
                `${e.card.name} ${e.card.set} ${e.tags}`
                  .toLowerCase()
                  .includes(filter.toLowerCase()),
              ),
            ) && <p>No owned cards match your search.</p>}
          {!relevant.some((doc) => doc.entries.length) && (
            <p>No owned cards yet. Create a binder and add cards to begin.</p>
          )}
        </div>
      ) : filtered.length ? (
        <div className="document-grid">
          {filtered.map((d) => (
            <DocumentTile key={d.id} document={d} onOpen={() => onOpen(d)} />
          ))}
        </div>
      ) : (
        <div className="workspace-empty">
          <NavIcon name={kind === "deck" ? "Decks" : "Collections"} />
          <h2>
            {filter
              ? "No matches"
              : kind === "deck"
                ? "No decks yet"
                : tab === "lists"
                  ? "No lists yet"
                  : "No binders yet"}
          </h2>
          <p>
            {filter
              ? "Try another name."
              : kind === "deck"
                ? "Create a deck with a name and format."
                : "Create a binder for owned cards or a list for cards you want."}
          </p>
          {!filter && (
            <button
              onClick={() =>
                onCreate(
                  kind === "deck"
                    ? "deck"
                    : tab === "lists"
                      ? "wishlist"
                      : "collection",
                )
              }
            >
              Create{" "}
              {kind === "deck" ? "deck" : tab === "lists" ? "list" : "binder"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
export function CreateDocument({
  kind,
  busy,
  onCancel,
  onCreate,
}: {
  kind: Document["kind"];
  busy: boolean;
  onCancel: () => void;
  onCreate: (name: string, format: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [format, setFormat] = useState("commander");
  const label =
    kind === "deck" ? "deck" : kind === "collection" ? "binder" : "list";
  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Create ${label}`}
        className="create-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="screen-heading">
          <h2>New {label}</h2>
          <button aria-label="Cancel creation" onClick={onCancel}>
            ×
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onCreate(name, format);
          }}
        >
          <label>
            Name
            <input
              autoFocus
              required
              maxLength={150}
              placeholder={
                kind === "deck"
                  ? "e.g. Atraxa counters"
                  : kind === "collection"
                    ? "e.g. Trade binder"
                    : "e.g. Commander wishlist"
              }
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {kind === "deck" && (
            <label>
              Format
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                {formats.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
          )}
          <p className="help-text">
            {kind === "deck"
              ? "Decks track what you play. Adding cards here does not change your owned collection."
              : kind === "collection"
                ? "Cards in this binder count as owned inventory."
                : "Cards on this list do not count as owned."}
          </p>
          <div className="sheet-actions">
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
            <button className="primary" disabled={busy || !name.trim()}>
              {busy ? "Creating…" : `Create ${label}`}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
export function DocumentEditor({
  document: d,
  allDocuments,
  onSave,
  onBack,
  onSearch,
  onScan,
  onOpen,
  onPlay,
  onAssistant,
  onMove,
  onUndoMove,
}: {
  document: Document;
  allDocuments: Document[];
  onSave: (doc: Document) => Promise<Document>;
  onBack: () => void;
  onSearch: (board?: Board) => void;
  onScan: () => void;
  onOpen: (card: Card) => void;
  onPlay: () => void;
  onAssistant: () => void;
  onMove: (target: Document, ids: string[]) => Promise<string>;
  onUndoMove: (id: string) => Promise<void>;
}) {
  const [tab, setTab] = useState("cards");
  const [board, setBoard] = useState<Board>("mainboard");
  const [filter, setFilter] = useState("");
  const [group, setGroup] = useState("type");
  const [editing, setEditing] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [moveTarget, setMoveTarget] = useState("");
  const [lastMove, setLastMove] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState("");
  const [preview, setPreview] = useState<Entry[]>([]);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const deck = d.kind === "deck";
  const validation = deck ? validateDeck(d) : null;
  const inventories = allDocuments
    .filter((x) => x.kind === "collection")
    .flatMap((x) => x.entries);
  const owned = (c: Card) =>
    inventories
      .filter(
        (e) => (e.card.oracle_id || e.card.name) === (c.oracle_id || c.name),
      )
      .reduce((n, e) => n + e.qty, 0);
  const allEntries = d.entries.filter((e) =>
    `${e.card.name} ${e.card.set} ${e.tags} ${e.card.type_line}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  const cards = allEntries.filter((e) => !deck || e.board === board);
  const grouped = new Map<string, Entry[]>();
  for (const e of cards) {
    const key =
      group === "type"
        ? cardType(e)
        : group === "tags"
          ? e.tags.split(",")[0].trim() || "Untagged"
          : "All cards";
    grouped.set(key, [...(grouped.get(key) || []), e]);
  }
  const missing = deck ? missingCards(d, allDocuments) : [];
  const commanders = d.entries.filter((e) => e.board === "commander");
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setStatus("");
    try {
      await fn();
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function quantity(e: Entry, delta: number) {
    await run(async () => {
      await onSave(changeCopies(d, e.id, delta));
      if (e.qty + delta === 0)
        setStatus(`${e.card.name} removed. Use Undo in Details to restore.`);
    });
  }
  async function update(e: Entry, patch: Partial<Entry>) {
    await run(async () => {
      await onSave({
        ...d,
        entries: d.entries.map((x) => (x.id === e.id ? { ...x, ...patch } : x)),
      });
    });
  }
  async function previewImport() {
    await run(async () => {
      const parsed = parseImport(draft);
      const errors = [...parsed.errors];
      const entries: Entry[] = [];
      for (const [i, row] of parsed.rows.entries()) {
        try {
          let card = await api<Card>(
            `/cards?mode=${row.id ? "id" : "named"}&q=${encodeURIComponent(row.id || row.name)}`,
          );
          if (row.set && !row.id) {
            const matches = await api<{ data: Card[] }>(
              `/cards?mode=prints&q=${card.oracle_id}`,
            );
            const print = matches.data.filter(
              (c) =>
                c.set === row.set?.toLowerCase() &&
                (!row.collector || c.collector_number === row.collector),
            );
            if (print.length !== 1)
              throw Error(
                "Printing needs set and collector number or a Scryfall ID.",
              );
            card = print[0];
          }
          entries.push({
            id: crypto.randomUUID(),
            card,
            qty: row.qty,
            board: (deck &&
            ["mainboard", "sideboard", "maybeboard", "commander"].includes(
              row.board,
            )
              ? row.board
              : "mainboard") as Board,
            language: row.language,
            condition: row.condition,
            finish: row.finish,
            purchasePrice: row.purchasePrice,
            notes: row.notes,
            tags: row.tags,
          });
        } catch (e) {
          errors.push(`Row ${i + 1}: ${(e as Error).message}`);
        }
      }
      setPreview(entries);
      setPreviewErrors(errors);
    });
  }
  const price = d.entries.reduce(
    (n, e) =>
      n +
      Number(
        e.card.prices?.[
          e.finish === "foil"
            ? "usd_foil"
            : e.finish === "etched"
              ? "usd_etched"
              : "usd"
        ] || 0,
      ) *
        e.qty,
    0,
  );
  return (
    <section className="document-editor">
      <div className="editor-heading">
        <button className="back-button" onClick={onBack}>
          ‹ {deck ? "Decks" : "Collection"}
        </button>
        <div>
          <h1>{d.name}</h1>
          <span className="document-subtitle">
            {deck
              ? d.format
              : d.kind === "wishlist"
                ? "Tracking list"
                : "Owned binder"}{" "}
            · {cardCount(d)} cards ·{" "}
            {d.entries.some(
              (e) => e.card.prices?.usd || e.card.prices?.usd_foil,
            )
              ? `$${price.toFixed(2)} available estimate`
              : "Price unavailable"}
          </span>
        </div>
        <button className="primary" onClick={() => onSearch(board)}>
          + Add cards
        </button>
      </div>
      <div className="workspace-tabs">
        <button aria-pressed={tab === "cards"} onClick={() => setTab("cards")}>
          Cards
        </button>
        {deck && (
          <button
            aria-pressed={tab === "missing"}
            onClick={() => setTab("missing")}
          >
            Missing {missing.reduce((n, e) => n + e.missing, 0)}
          </button>
        )}
        {deck && (
          <button
            aria-pressed={tab === "stats"}
            onClick={() => setTab("stats")}
          >
            Stats
          </button>
        )}
        <button
          aria-pressed={tab === "import"}
          onClick={() => setTab("import")}
        >
          Import / export
        </button>
        <button
          aria-pressed={tab === "details"}
          onClick={() => setTab("details")}
        >
          Details
        </button>
      </div>
      {status && (
        <p className="inline-status" role="status">
          {status}
        </p>
      )}
      {tab === "cards" && (
        <>
          {deck && d.format === "commander" && (
            <section className="commander-section">
              <div className="screen-heading minor">
                <h2>Commander{commanders.length > 1 ? "s" : ""}</h2>
                <button onClick={() => onSearch("commander")}>
                  + Choose commander
                </button>
              </div>
              {commanders.length ? (
                <div className="commander-cards">
                  {commanders.map((e) => (
                    <button key={e.id} onClick={() => onOpen(e.card)}>
                      {image(e.card) && <img src={image(e.card)} alt="" />}
                      <span>{e.card.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p>Choose a commander to define your deck’s color identity.</p>
              )}
            </section>
          )}
          <div className="editor-toolbar">
            <button
              aria-pressed={selecting}
              onClick={() => {
                setSelecting(!selecting);
                setSelection([]);
              }}
            >
              {selecting ? "Done selecting" : "Select cards"}
            </button>
            <input
              aria-label="Find card in document"
              placeholder="Find a card in this list…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <select
              aria-label="Group cards"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            >
              <option value="type">Group by type</option>
              <option value="tags">Group by tag</option>
              <option value="none">No grouping</option>
            </select>
            {!deck && (
              <button onClick={onScan}>
                <NavIcon name="Scan" /> Scan
              </button>
            )}
          </div>
          {selecting && (
            <div className="bulk-toolbar">
              <strong>{selection.length} selected</strong>
              <button onClick={() => setSelection(cards.map((e) => e.id))}>
                Select visible
              </button>
              <button
                disabled={busy || !selection.length}
                onClick={() =>
                  run(async () => {
                    await onSave({
                      ...d,
                      entries: d.entries.filter(
                        (e) => !selection.includes(e.id),
                      ),
                    });
                    setSelection([]);
                    setStatus(
                      "Selected rows removed. Use Undo in Details to restore.",
                    );
                  })
                }
              >
                Remove selected
              </button>
              {!deck && (
                <>
                  <select
                    aria-label="Move to binder or list"
                    value={moveTarget}
                    onChange={(e) => setMoveTarget(e.target.value)}
                  >
                    <option value="">Move to…</option>
                    {allDocuments
                      .filter((x) => x.kind === d.kind && x.id !== d.id)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                  </select>
                  <button
                    disabled={busy || !selection.length || !moveTarget}
                    onClick={() =>
                      run(async () => {
                        const target = allDocuments.find(
                          (x) => x.id === moveTarget,
                        )!;
                        setLastMove(await onMove(target, selection));
                        setSelection([]);
                        setStatus(`Moved selected rows to ${target.name}.`);
                      })
                    }
                  >
                    Move
                  </button>
                </>
              )}
            </div>
          )}
          {lastMove && (
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await onUndoMove(lastMove);
                  setLastMove("");
                  setStatus("Move undone in both binders.");
                })
              }
            >
              Undo last move
            </button>
          )}
          {deck && (
            <div className="board-tabs">
              {(["mainboard", "sideboard", "maybeboard"] as Board[]).map(
                (b) => (
                  <button
                    aria-pressed={board === b}
                    key={b}
                    onClick={() => setBoard(b)}
                  >
                    {b === "mainboard"
                      ? "Mainboard"
                      : b === "sideboard"
                        ? "Sideboard"
                        : "Maybeboard"}{" "}
                    <small>
                      {d.entries
                        .filter((e) => e.board === b)
                        .reduce((n, e) => n + e.qty, 0)}
                    </small>
                  </button>
                ),
              )}
            </div>
          )}
          {!cards.length && (
            <div className="workspace-empty small">
              <h3>{filter ? "No matching cards" : "Add your first cards"}</h3>
              <p>
                {filter
                  ? "Try another name or tag."
                  : "Search for a card and tap +. Choose a printing by opening the card."}
              </p>
              {!filter && (
                <button className="primary" onClick={() => onSearch(board)}>
                  + Add cards
                </button>
              )}
            </div>
          )}
          {[...grouped].map(([name, entries]) => (
            <section className="card-group" key={name}>
              <h3>
                {name}
                <small>{entries.reduce((n, e) => n + e.qty, 0)}</small>
              </h3>
              {entries
                .sort((a, b) => a.card.name.localeCompare(b.card.name))
                .map((e) => (
                  <div key={e.id}>
                    <div className="editor-card-row">
                      {selecting && (
                        <input
                          className="entry-checkbox"
                          type="checkbox"
                          aria-label={`Select ${e.card.name}`}
                          checked={selection.includes(e.id)}
                          onChange={(event) =>
                            setSelection(
                              event.target.checked
                                ? [...selection, e.id]
                                : selection.filter((id) => id !== e.id),
                            )
                          }
                        />
                      )}
                      <button
                        className="editor-card-info"
                        onClick={() => onOpen(e.card)}
                      >
                        {image(e.card) && (
                          <img src={image(e.card)} alt="" loading="lazy" />
                        )}
                        <span>
                          <strong>{e.card.name}</strong>
                          <small>
                            {e.card.set?.toUpperCase()} #
                            {e.card.collector_number} · {e.finish}
                            {deck ? ` · ${owned(e.card)} owned` : ""}
                          </small>
                        </span>
                      </button>
                      <div className="quantity-stepper">
                        <button
                          disabled={busy}
                          aria-label={`Remove one ${e.card.name}`}
                          onClick={() => quantity(e, -1)}
                        >
                          −
                        </button>
                        <span>{e.qty}</span>
                        <button
                          disabled={busy}
                          aria-label={`Add one ${e.card.name}`}
                          onClick={() => quantity(e, 1)}
                        >
                          +
                        </button>
                      </div>
                      <button
                        className="entry-edit"
                        aria-label={`Edit ${e.card.name}`}
                        onClick={() => setEditing(editing === e.id ? "" : e.id)}
                      >
                        ⋯
                      </button>
                    </div>
                    {editing === e.id && (
                      <div className="entry-editor">
                        {deck && (
                          <label>
                            Board
                            <select
                              value={e.board}
                              onChange={(event) =>
                                update(e, {
                                  board: event.target.value as Board,
                                })
                              }
                            >
                              {[
                                "mainboard",
                                "sideboard",
                                "maybeboard",
                                "commander",
                              ].map((b) => (
                                <option key={b}>{b}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        {(
                          [
                            "language",
                            "condition",
                            "finish",
                            "purchasePrice",
                            "tags",
                            "notes",
                          ] as const
                        ).map((key) => (
                          <label key={key}>
                            {
                              {
                                language: "Language",
                                condition: "Condition",
                                finish: "Finish",
                                purchasePrice: "Purchase price",
                                tags: "Tags (comma separated)",
                                notes: "Notes",
                              }[key]
                            }
                            <input
                              defaultValue={e[key]}
                              key={e.id + key + e[key]}
                              onBlur={(event) => {
                                if (event.target.value !== e[key])
                                  void update(e, { [key]: event.target.value });
                              }}
                            />
                          </label>
                        ))}
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              await onSave({
                                ...d,
                                entries: d.entries.filter((x) => x.id !== e.id),
                              });
                              setEditing("");
                              setStatus(
                                "Card removed. Undo is available in Details.",
                              );
                            })
                          }
                        >
                          Remove row
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </section>
          ))}
          {validation && (
            <div className="validation-summary">
              <span className={validation.errors.length ? "error" : ""}>
                {validation.errors.length
                  ? `${validation.errors.length} deck checks need attention`
                  : "Format checks passed"}
                {validation.warnings.length ? " · metadata review needed" : ""}
              </span>
              <button onClick={() => setTab("details")}>Review</button>
            </div>
          )}
          {deck && (
            <div className="deck-tools">
              <button onClick={onPlay}>
                <NavIcon name="Playtest" /> Playtest
              </button>
              <button onClick={onAssistant}>
                <NavIcon name="Assistant" /> Ask assistant
              </button>
            </div>
          )}
        </>
      )}
      {tab === "missing" && deck && (
        <div className="panel">
          <h2>Missing from your collection</h2>
          <p>
            Compares mainboard, sideboard and commanders against your owned
            binders, across printings. Cards are not reserved between decks.
            Maybeboard is excluded.
          </p>
          {missing.length ? (
            missing.map((e) => (
              <button
                className="owned-card-location"
                key={e.card.oracle_id || e.card.name}
                onClick={() => onOpen(e.card)}
              >
                {image(e.card) && <img src={image(e.card)} alt="" />}
                <span>
                  <strong>{e.card.name}</strong>
                  <small>
                    {e.qty} needed · {e.owned} owned
                  </small>
                </span>
                <strong>Missing {e.missing}</strong>
              </button>
            ))
          ) : (
            <p>You own enough copies for this deck.</p>
          )}
          <button
            onClick={() =>
              download(
                `${d.name}-missing.txt`,
                missing.map((e) => `${e.missing} ${e.card.name}`).join("\n"),
                "text/plain",
              )
            }
          >
            Export missing list
          </button>
        </div>
      )}
      {tab === "stats" && deck && (
        <div className="panel">
          <DeckAnalytics deck={d} />
          <p>
            Prices are available Scryfall estimates in USD. Role counts are
            heuristics.
          </p>
        </div>
      )}
      {tab === "import" && (
        <div className="panel">
          <h2>Import cards</h2>
          <p>
            Paste a decklist or ManaBox-style CSV. Review matched cards before
            saving.
          </p>
          <textarea
            aria-label="Import decklist"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={"1 Sol Ring\n10 Forest"}
          />
          <div className="toolbar">
            <label className="button">
              Choose text / CSV file
              <input
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 3 * 1024 * 1024) {
                      setStatus("File is too large (3 MB limit).");
                      return;
                    }
                    setDraft(await file.text());
                  }
                }}
              />
            </label>
            <button
              className="primary"
              disabled={!draft.trim() || busy}
              onClick={previewImport}
            >
              Preview import
            </button>
          </div>
          {previewErrors.map((error, i) => (
            <p className="error" key={i}>
              {error}
            </p>
          ))}
          {!!preview.length && (
            <div className="import-preview">
              <h3>{preview.length} verified rows</h3>
              {preview.map((e) => (
                <p key={e.id}>
                  {e.qty} × {e.card.name} · {e.card.set?.toUpperCase()} #
                  {e.card.collector_number}
                </p>
              ))}
              <p>
                Duplicates are added as separate rows.{" "}
                {previewErrors.length
                  ? "Some rows failed; only the listed matched rows will be added."
                  : ""}
              </p>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await onSave({ ...d, entries: [...d.entries, ...preview] });
                    setPreview([]);
                    setDraft("");
                    setTab("cards");
                    setStatus("Import saved.");
                  })
                }
              >
                Add reviewed rows
              </button>
            </div>
          )}
          <h2>Export</h2>
          <div className="toolbar">
            <button
              onClick={() => download(d.name + ".txt", exportDeck(d.entries))}
            >
              Decklist
            </button>
            <button
              onClick={() =>
                download(
                  d.name + ".csv",
                  exportCsv(d.entries, d.name),
                  "text/csv",
                )
              }
            >
              CSV
            </button>
            <button
              onClick={() =>
                download(
                  d.name + ".json",
                  JSON.stringify(d, null, 2),
                  "application/json",
                )
              }
            >
              Full JSON
            </button>
          </div>
        </div>
      )}
      {tab === "details" && (
        <div className="panel">
          <h2>{deck ? "Deck details" : "Binder / list details"}</h2>
          <label>
            Name
            <input
              defaultValue={d.name}
              key={d.id + "name"}
              maxLength={150}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== d.name)
                  void run(async () => {
                    await onSave({ ...d, name: e.target.value.trim() });
                  });
              }}
            />
          </label>
          {deck && (
            <label>
              Format
              <select
                value={d.format}
                onChange={(e) =>
                  run(async () => {
                    await onSave({ ...d, format: e.target.value });
                  })
                }
              >
                {formats.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            Notes
            <textarea
              defaultValue={d.notes}
              key={d.id + "notes"}
              onBlur={(e) => {
                if (e.target.value !== d.notes)
                  void run(async () => {
                    await onSave({ ...d, notes: e.target.value });
                  });
              }}
            />
          </label>
          {validation && (
            <section className="validation-details">
              <h3>Format checks</h3>
              {validation.errors.map((error) => (
                <p key={error} className="error">
                  {error}
                </p>
              ))}
              {validation.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
              {!validation.errors.length && (
                <p>
                  Checked deck sizes, copy limits, card legalities and supported
                  commander rules.
                </p>
              )}
              <p className="help-text">
                Companion and unusual construction rules still require manual
                review.
              </p>
            </section>
          )}
          <div className="toolbar">
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await onSave({
                    ...d,
                    id: crypto.randomUUID(),
                    name: d.name + " copy",
                    revision: 0,
                  });
                  setStatus("Copy created. Find it in your library.");
                })
              }
            >
              Duplicate
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const history = await api<{ document: Document }[]>(
                    "/documents/" + d.id + "/history",
                  );
                  if (!history.length)
                    throw Error("No previous changes to undo.");
                  await onSave({
                    ...history[0].document,
                    revision: d.revision,
                  });
                  setStatus("Previous saved edit restored.");
                })
              }
            >
              Undo last edit
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await onSave({ ...d, deleted: true });
                  onBack();
                })
              }
            >
              Move to trash
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
