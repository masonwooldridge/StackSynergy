import { useCallback, useEffect, useState } from "react";
import type { Card, Document, Entry, Board } from "../shared/model";
import { image, validateDeck } from "../shared/model";
import { api, download } from "./api";
import Scanner from "./Scanner";
import { Crest, NavIcon } from "./Brand";
import CardSearch from "./CardSearch";
import {
  HomeScreen,
  LibraryScreen,
  CreateDocument,
  DocumentEditor,
} from "./Workspace";
import { addCopy, newEntry } from "../shared/deckEditing";
import { parseNativeScan } from "../shared/nativeBridge";
import Tabletop from "./Tabletop";
import Multiplayer from "./Multiplayer";

import "./App.css";
import "./theme.css";
import "./workflows.css";
type Proposal = {
  analysis: string;
  additions: { name: string; reason: string; card: Card }[];
  cuts: { name: string; reason: string }[];
  rejected: string[];
  evidence: string;
  retrievedAt: string;
};
const freshEntry = newEntry;
export default function App() {
  const [page, setPage] = useState("Home");
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);
  const [nativeImage, setNativeImage] = useState<string | null>(null);
  useEffect(() => {
    const seen = new Set<string>();
    const receive = (event: MessageEvent) => {
      const scan = parseNativeScan(event.data);
      if (!scan || seen.has(scan.id)) return;
      seen.add(scan.id);
      setNativeImage(scan.image);
      setPage("Scan");
    };
    window.addEventListener("message", receive);
    document.addEventListener("message", receive as EventListener);
    return () => {
      window.removeEventListener("message", receive);
      document.removeEventListener("message", receive as EventListener);
    };
  }, []);

  const [user, setUser] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [docs, setDocs] = useState<Document[]>([]);
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [detail, setDetail] = useState<Card | null>(null);
  const [prints, setPrints] = useState<Card[]>([]);
  const [face, setFace] = useState(0);
  const [destination, setDestination] = useState("");
  const [qty, setQty] = useState(1);
  const [board, setBoard] = useState<Board>("mainboard");
  const [finish, setFinish] = useState("nonfoil");
  const [language, setLanguage] = useState("en");

  const [creating, setCreating] = useState<Document["kind"] | null>(null);

  const [prompt, setPrompt] = useState(
    "Improve my mana consistency and interaction.",
  );
  const [budget, setBudget] = useState(20);
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [rulings, setRulings] = useState<
    { comment: string; published_at: string }[]
  >([]);
  const detailOpen = detail !== null || creating !== null;
  useEffect(() => {
    if (!detailOpen) return;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.querySelector<HTMLElement>("button")?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDetail(null);
        setCreating(null);
      }
      if (e.key !== "Tab" || !dialog) return;
      const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ),
      ).filter((el) => el.offsetParent !== null);
      const first = controls[0],
        last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [detailOpen]);
  const current = docs.find((d) => d.id === selected && !d.deleted);
  const visible = docs.filter((d) => !d.deleted);
  const refresh = useCallback(async () => {
    const me = await api<{ user: string | null; aiConfigured: boolean }>("/me");
    setUser(me.user);
    setAiConfigured(me.aiConfigured);
    if (me.user) {
      const d = await api<Document[]>("/documents");
      setDocs(d);
    }
  }, []);
  useEffect(() => {
    refresh().catch((e) => setMessage(e.message));
  }, [refresh]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(d: Document) {
    const saved = await api<Document>("/documents/" + d.id, d, "PUT");
    setDocs((all) => [...all.filter((x) => x.id !== d.id), saved]);
    return saved;
  }
  async function open(c: Card) {
    setDetail(c);
    setPrints([]);
    setRulings([]);
    setFace(0);
    setQty(1);
    setFinish("nonfoil");
    setLanguage(c.lang || "en");
    setDestination(destination || selected);
    await run(async () => {
      if (c.oracle_id) {
        const r = await api<{ data: Card[] }>(
          `/cards?mode=prints&q=${c.oracle_id}`,
        );
        setPrints(r.data);
      }
    });
  }
  function navigate(next: string) {
    setPage(next);
    setMessage("");
    if (next === "Collections" || next === "Decks") setSelected("");
    if (next === "Discover") setDestination("");
    if (next === "Playtest" || next === "Assistant") {
      if (!visible.some((d) => d.id === selected && d.kind === "deck"))
        setSelected(visible.find((d) => d.kind === "deck")?.id || "");
    }
  }
  function openDocument(document: Document) {
    setSelected(document.id);
    setPage(document.kind === "deck" ? "Decks" : "Collections");
    setMessage("");
  }
  function beginCreate(kind: Document["kind"]) {
    if (!user) {
      setPage("Settings");
      setMessage(
        "Sign in or create an account to save your " +
          (kind === "deck"
            ? "deck"
            : kind === "collection"
              ? "binder"
              : "list") +
          ".",
      );
      return;
    }
    setCreating(kind);
  }
  async function createDocument(name: string, format: string) {
    if (!creating) return;
    await run(async () => {
      const d = await save({
        id: crypto.randomUUID(),
        name: name.trim(),
        kind: creating,
        format,
        notes: "",
        entries: [],
        revision: 0,
      });
      setCreating(null);
      openDocument(d);
    });
  }
  function findCards(document: Document, board: Board = "mainboard") {
    setSelected(document.id);
    setDestination(document.id);
    setBoard(board);
    setPage("Discover");
    setMessage("");
  }
  async function quickAdd(card: Card) {
    const target = visible.find((d) => d.id === destination);
    if (!target) throw Error("Choose a destination first.");
    await save(addCopy(target, card, board));
  }
  async function add() {
    const d = docs.find((x) => x.id === destination);
    if (!d || !detail) {
      setMessage("Choose a saved destination.");
      return;
    }
    await run(async () => {
      const e = freshEntry(detail);
      e.qty = qty;
      e.finish = finish;
      e.language = language;
      e.board = d.kind === "deck" ? board : "mainboard";
      await save({ ...d, entries: [...d.entries, e] });
      setMessage(`${qty} × ${detail.name} saved to ${d.name}.`);
      setDetail(null);
    });
  }
  return (
    <div className="shell">
      <aside className="navigation">
        <a className="brand" href="#" onClick={() => navigate("Home")}>
          <span className="brand-icon">
            <Crest />
          </span>
          <span>CardChasm</span>
        </a>
        <nav>
          {["Home", "Discover", "Collections", "Decks", "More"].map((p) => (
            <button
              className={page === p ? "nav-item active" : "nav-item"}
              aria-current={page === p ? "page" : undefined}
              key={p}
              onClick={() => navigate(p)}
            >
              <NavIcon name={p} />
              <span>
                {p === "Discover"
                  ? "Search"
                  : p === "Collections"
                    ? "Collection"
                    : p}
              </span>
            </button>
          ))}
        </nav>
        <div className="sidebar-tools">
          <span>TOOLS</span>
          {["Scan", "Playtest", "Multiplayer", "Assistant"].map((p) => (
            <button key={p} onClick={() => navigate(p)}>
              <NavIcon name={p} />
              {p === "Assistant"
                ? "Deck assistant"
                : p === "Multiplayer"
                  ? "Online play"
                  : p}
            </button>
          ))}
        </div>
        <div className="nav-bottom">
          <span className="dot" />
          {user ? "Signed in" : "Not signed in"}
          <p>
            Card data and images by{" "}
            <a href="https://scryfall.com" target="_blank" rel="noreferrer">
              Scryfall
            </a>
            .
          </p>
        </div>
      </aside>
      <nav className="bottom-navigation" aria-label="Main navigation">
        {["Home", "Discover", "Collections", "Decks", "More"].map((p) => (
          <button
            key={p}
            aria-current={page === p ? "page" : undefined}
            onClick={() => navigate(p)}
          >
            <NavIcon name={p} />
            <span>
              {p === "Discover"
                ? "Search"
                : p === "Collections"
                  ? "Collection"
                  : p}
            </span>
          </button>
        ))}
      </nav>
      <main>
        <header className="topbar">
          <span>
            {page === "Home"
              ? "CardChasm"
              : page === "Discover"
                ? "Search"
                : page === "Collections"
                  ? "Collection"
                  : page === "Assistant"
                    ? "Deck assistant"
                    : page === "Multiplayer"
                      ? "Online play"
                      : page}
          </span>
          <div className="appbar-actions">
            <button onClick={() => navigate("Scan")} aria-label="Open scanner">
              <NavIcon name="Scan" />
              <span>Scan</span>
            </button>
            <button onClick={() => navigate("Settings")}>
              {user ? "Account" : "Sign in"}
            </button>
          </div>
        </header>
        <div className="content">
          {message && (
            <div className="notice" role="status">
              {message}
            </div>
          )}
          {busy && (
            <div role="status" className="loading">
              Working…
            </div>
          )}
          {page === "Home" && (
            <HomeScreen
              documents={visible}
              signedIn={!!user}
              onNavigate={navigate}
              onOpen={openDocument}
              onCreate={beginCreate}
            />
          )}
          {page === "Discover" && (
            <CardSearch
              documents={visible}
              targetId={destination}
              onTarget={setDestination}
              board={board}
              onBoard={setBoard}
              onOpen={open}
              onAdd={quickAdd}
              canSave={!!user}
              onBack={() => {
                const target = visible.find((d) => d.id === destination);
                if (target) openDocument(target);
                else navigate("Home");
              }}
            />
          )}
          {(page === "Collections" || page === "Decks") &&
            (current &&
            (page === "Decks"
              ? current.kind === "deck"
              : current.kind !== "deck") ? (
              <DocumentEditor
                key={current.id}
                document={current}
                allDocuments={visible}
                onSave={save}
                onMove={async (target, ids) => {
                  const result = await api<{
                    id: string;
                    documents: Document[];
                  }>("/inventory/move", {
                    source: current.id,
                    target: target.id,
                    sourceRevision: current.revision,
                    targetRevision: target.revision,
                    entries: ids,
                  });
                  setDocs((all) => [
                    ...all.filter(
                      (x) => !result.documents.some((d) => d.id === x.id),
                    ),
                    ...result.documents,
                  ]);
                  return result.id;
                }}
                onUndoMove={async (id) => {
                  const result = await api<{ documents: Document[] }>(
                    `/inventory/move/${id}/undo`,
                    {},
                  );
                  setDocs((all) => [
                    ...all.filter(
                      (x) => !result.documents.some((d) => d.id === x.id),
                    ),
                    ...result.documents,
                  ]);
                }}
                onBack={() => {
                  setSelected("");
                  setMessage("");
                }}
                onSearch={(b) => findCards(current, b)}
                onScan={() => {
                  setDestination(current.id);
                  setPage("Scan");
                }}
                onOpen={open}
                onPlay={() => setPage("Playtest")}
                onAssistant={() => setPage("Assistant")}
              />
            ) : (
              <LibraryScreen
                key={page}
                kind={page === "Decks" ? "deck" : "collection"}
                documents={visible}
                signedIn={!!user}
                onOpen={openDocument}
                onCreate={beginCreate}
                onNavigate={navigate}
              />
            ))}
          {page === "More" && (
            <section>
              <div className="screen-heading">
                <div>
                  <h1>More</h1>
                  <p>Tools for collecting, building and playing.</p>
                </div>
              </div>
              <div className="more-tools">
                {[
                  ["Scan", "Scan cards", "Camera, photos and review queue"],
                  [
                    "Playtest",
                    "Solo playtest",
                    "Test a saved deck on the tabletop",
                  ],
                  [
                    "Multiplayer",
                    "Online play",
                    "Host or join a game with other players",
                  ],
                  [
                    "Assistant",
                    "Deck assistant",
                    "Analyze decks and review proposed changes",
                  ],
                  [
                    "Settings",
                    "Account & backups",
                    "Sign in, export your archive and recover deleted items",
                  ],
                ].map(([p, title, description]) => (
                  <button key={p} onClick={() => navigate(p)}>
                    <NavIcon name={p} />
                    <span>
                      <strong>{title}</strong>
                      <small>{description}</small>
                    </span>
                    <span>›</span>
                  </button>
                ))}
                <a
                  href="https://magic.wizards.com/en/rules"
                  target="_blank"
                  rel="noreferrer"
                >
                  <NavIcon name="More" />
                  <span>
                    <strong>Magic rules</strong>
                    <small>Official rules and comprehensive rulebook</small>
                  </span>
                  <span>↗</span>
                </a>
              </div>
            </section>
          )}
          {page === "Scan" && (
            <>
              <div className="scan-destination">
                <label>
                  Save reviewed cards to
                  <select
                    value={destination}
                    onChange={(e) => {
                      setDestination(e.target.value);
                      setSelected(e.target.value);
                    }}
                  >
                    <option value="">Choose binder, list or deck</option>
                    {visible.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button onClick={() => navigate("Discover")}>
                  Search instead
                </button>
              </div>
              <Scanner
                onSelect={open}
                initialImage={nativeImage}
                onImageConsumed={() => setNativeImage(null)}
              />
            </>
          )}
          {page === "Playtest" && (
            <>
              <div className="solo-page-heading">
                <button onClick={() => setPage("Decks")}>‹ Back to deck</button>
                <select
                  aria-label="Playtest deck"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  <option value="">Choose a deck</option>
                  {visible
                    .filter((d) => d.kind === "deck")
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>
              {current?.kind === "deck" ? (
                <Tabletop deck={current} key={current.id} />
              ) : (
                <div className="panel empty">Choose a saved deck to begin.</div>
              )}
            </>
          )}
          {page === "Multiplayer" && (
            <Multiplayer decks={visible.filter((d) => d.kind === "deck")} />
          )}
          {page === "Assistant" && (
            <section className="panel assistant">
              <div className="eyebrow">YOUR DECKBUILDING PARTNER</div>
              <h1>Build with a little insight.</h1>
              <p>
                Live model analysis, verified against Scryfall. Recommendations
                become a reviewable diff. Community statistics are not currently
                integrated.
              </p>
              <select
                aria-label="Assistant deck"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Choose a deck</option>
                {visible
                  .filter((d) => d.kind === "deck")
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
              <label>
                Strategy & preferences
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </label>
              <label>
                Maximum USD per addition
                <input
                  type="number"
                  value={budget}
                  min="0"
                  onChange={(e) => setBudget(Number(e.target.value))}
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={ownedOnly}
                  onChange={(e) => setOwnedOnly(e.target.checked)}
                />{" "}
                Use owned cards only
              </label>
              <button
                className="primary"
                disabled={busy || !aiConfigured || current?.kind !== "deck"}
                onClick={() =>
                  run(async () =>
                    setProposal(
                      await api<Proposal>("/assistant", {
                        deckId: selected,
                        prompt,
                        budget,
                        ownedOnly,
                      }),
                    ),
                  )
                }
              >
                Analyze & propose
              </button>
              {!aiConfigured && (
                <p>
                  Live AI needs a server-side model credential. No model
                  requests are made until configured.
                </p>
              )}
              {proposal && (
                <div>
                  <h3>Proposed changes</h3>
                  <p>{proposal.analysis}</p>
                  {proposal.additions.map((a) => (
                    <p key={a.card.id}>
                      +{" "}
                      <a
                        href={a.card.scryfall_uri}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {a.name}
                      </a>{" "}
                      · {a.reason}
                    </p>
                  ))}
                  {proposal.cuts.map((c) => (
                    <p key={c.name}>
                      − {c.name} · {c.reason}
                    </p>
                  ))}
                  {proposal.rejected.map((s) => (
                    <p key={s} className="error">
                      Rejected: {s}
                    </p>
                  ))}
                  <p>
                    {proposal.evidence} Retrieved {proposal.retrievedAt}
                  </p>
                  <button
                    onClick={() =>
                      run(async () => {
                        if (!current) return;
                        const next = {
                          ...current,
                          entries: [
                            ...current.entries.filter(
                              (e) =>
                                !proposal.cuts.some(
                                  (c) => c.name === e.card.name,
                                ),
                            ),
                            ...proposal.additions.map((a) =>
                              freshEntry(a.card),
                            ),
                          ],
                        };
                        const v = validateDeck(next);
                        if (v.errors.length) {
                          setMessage(
                            "Changes require correction before applying: " +
                              v.errors.join(" "),
                          );
                          return;
                        }
                        await save(next);
                        setProposal(null);
                      })
                    }
                  >
                    Accept validated changes
                  </button>
                  <button onClick={() => setProposal(null)}>Reject</button>
                </div>
              )}
            </section>
          )}
          {page === "Settings" && (
            <section className="panel">
              <div className="eyebrow">YOUR ACCOUNT</div>
              <h1>Keep your cards close.</h1>
              {!user ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await api("/auth/login", { email, password });
                      setPassword("");
                      await refresh();
                    });
                  }}
                >
                  <label>
                    Email
                    <input
                      type="email"
                      autoComplete="username"
                      value={email}
                      required
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                  <label>
                    Password · at least 12 characters
                    <input
                      type="password"
                      autoComplete="current-password"
                      minLength={12}
                      value={password}
                      required
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </label>
                  <div className="toolbar">
                    <button className="primary" disabled={busy}>
                      Sign in
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await api("/auth/register", { email, password });
                          setPassword("");
                          await refresh();
                        })
                      }
                    >
                      Create local account
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p>
                    Your archive is stored in the local SQLite database and
                    synchronized through this server.
                  </p>
                  <div className="toolbar">
                    <button onClick={() => run(refresh)}>
                      Refresh from server
                    </button>
                    <button
                      onClick={() =>
                        run(async () => {
                          download(
                            "cardchasm-backup.json",
                            JSON.stringify(await api("/backup"), null, 2),
                            "application/json",
                          );
                        })
                      }
                    >
                      Download full backup
                    </button>
                    <button
                      onClick={() =>
                        run(async () => {
                          await api("/logout", {});
                          setUser(null);
                          setDocs([]);
                          setSelected("");
                        })
                      }
                    >
                      Sign out
                    </button>
                    <button
                      onClick={() =>
                        run(async () => {
                          const legacy =
                            localStorage.getItem("card-chasm-deck");
                          if (!legacy)
                            throw Error("No legacy deck in this browser.");
                          const old = JSON.parse(legacy).state.deck as Record<
                            string,
                            { card: Card; qty: number }
                          >;
                          const entries: Entry[] = [];
                          for (const { card, qty: count } of Object.values(
                            old,
                          )) {
                            const verified = await api<Card>(
                              `/cards?mode=id&q=${card.id}`,
                            );
                            entries.push({
                              ...freshEntry(verified),
                              qty: count,
                            });
                          }
                          await save({
                            id: crypto.randomUUID(),
                            name: "Imported original deck",
                            kind: "deck",
                            format: "modern",
                            notes:
                              "Migrated from card-chasm-deck. Original browser storage preserved.",
                            revision: 0,
                            entries,
                          });
                          setMessage(
                            "Original deck copied. Legacy storage remains untouched.",
                          );
                        })
                      }
                    >
                      Copy original MVP deck
                    </button>
                  </div>
                  <h3>Trash · recoverable documents</h3>
                  {docs
                    .filter((d) => d.deleted)
                    .map((d) => (
                      <div className="toolbar" key={d.id}>
                        {d.name}
                        <button
                          onClick={() =>
                            run(async () => {
                              await save({ ...d, deleted: false });
                            })
                          }
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                </>
              )}
              <p>
                <a
                  href="https://magic.wizards.com/en/rules"
                  target="_blank"
                  rel="noreferrer"
                >
                  Official Magic rules ↗
                </a>{" "}
                ·{" "}
                <a href="https://edhrec.com" target="_blank" rel="noreferrer">
                  EDHREC ↗
                </a>{" "}
                ·{" "}
                <a href="https://moxfield.com" target="_blank" rel="noreferrer">
                  Moxfield ↗
                </a>
              </p>
            </section>
          )}
        </div>
      </main>
      {creating && (
        <CreateDocument
          kind={creating}
          busy={busy}
          onCancel={() => setCreating(null)}
          onCreate={createDocument}
        />
      )}
      {detail && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Card details"
            className="modal"
          >
            <button
              className="close"
              aria-label="Close card details"
              onClick={() => setDetail(null)}
            >
              ×
            </button>
            <div>
              {image(detail, face) && (
                <img
                  className="detail-image"
                  src={image(detail, face)}
                  alt={detail.name}
                />
              )}{" "}
              {detail.card_faces && (
                <button onClick={() => setFace((f) => (f ? 0 : 1))}>
                  Other face
                </button>
              )}
            </div>
            <div>
              <div className="eyebrow">VERIFIED CARD · REVIEW PRINTING</div>
              <h2>{detail.name}</h2>
              <p>
                {detail.mana_cost} · {detail.type_line}
              </p>
              <p className="oracle">
                {detail.oracle_text ||
                  detail.card_faces?.map((f) => f.oracle_text).join("\n\n")}
              </p>
              <label>
                Printing
                <select
                  value={detail.id}
                  onChange={(e) =>
                    setDetail(
                      prints.find((c) => c.id === e.target.value) || detail,
                    )
                  }
                >
                  {(prints.length ? prints : [detail]).map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.set_name} ({c.set}) #{c.collector_number} · {c.lang}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                {detail.prices?.usd
                  ? `USD $${detail.prices.usd}`
                  : "Price unavailable"}{" "}
                · Scryfall available price, cached up to 24h. Finish and
                condition can change value.
              </p>
              <a href={detail.scryfall_uri} target="_blank" rel="noreferrer">
                Card details & rulings on Scryfall ↗
              </a>
              <label>
                Destination
                <select
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                >
                  <option value="">Choose a destination</option>
                  {visible.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} · {d.kind}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Quantity
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                />
              </label>
              {docs.find((d) => d.id === destination)?.kind === "deck" && (
                <label>
                  Board
                  <select
                    value={board}
                    onChange={(e) => setBoard(e.target.value as Board)}
                  >
                    {["mainboard", "sideboard", "maybeboard", "commander"].map(
                      (b) => (
                        <option key={b}>{b}</option>
                      ),
                    )}
                  </select>
                </label>
              )}
              <label>
                Finish
                <select
                  value={finish}
                  onChange={(e) => setFinish(e.target.value)}
                >
                  <option value="nonfoil">Nonfoil</option>
                  <option value="foil">Foil</option>
                  <option value="etched">Etched</option>
                </select>
              </label>
              <label>
                Language
                <input
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                />
              </label>
              <button
                className="primary"
                disabled={
                  !user ||
                  busy ||
                  !destination ||
                  !Number.isInteger(qty) ||
                  qty < 1 ||
                  qty > 10000
                }
                onClick={add}
              >
                Confirm printing & add →
              </button>
              {!user && (
                <p>Sign in and create a binder or deck to save this card.</p>
              )}
              {rulings.map((r) => (
                <p key={r.comment}>{r.comment}</p>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
