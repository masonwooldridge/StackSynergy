import DeckAIChat from "./DeckAIChat";
import DeckUpgrader from "./DeckUpgrader";
import CardInspector from "./CardInspector";
import CommanderBuilder from "./CommanderBuilder";
import { GuestLibrary, GUEST_KEY } from "./guestLibrary";
import { plainTextInputProps } from "./inputBehavior";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Card, Document, Entry, Board } from "../shared/model";
import { image } from "../shared/model";
import { api, download } from "./api";
import { useAppRoute } from "./useAppRoute";
import Scanner from "./Scanner";
import { Crest, NavIcon } from "./Brand";
import CardSearch from "./CardSearch";
import {
  HomeScreen,
  LibraryScreen,
  CreateDocument,
  DocumentEditor,
} from "./Workspace";
import { addCopy, newEntry, replacePrinting } from "../shared/deckEditing";
import { parseNativeScan } from "../shared/nativeBridge";
import Tabletop from "./Tabletop";
import Multiplayer from "./Multiplayer";

import "./App.css";
import "./workflows.css";
import "./theme.css";
import { applyProposal, type Proposal } from "../shared/proposals";
const freshEntry = newEntry;
export default function App() {
  useEffect(() => {
    const bridge = (
      window as Window & {
        ReactNativeWebView?: { postMessage: (message: string) => void };
      }
    ).ReactNativeWebView;
    bridge?.postMessage(JSON.stringify({ type: "cardchasm:ready" }));
  }, []);
  const { page, setPage, selected, setSelected } = useAppRoute();
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
  }, [setPage]);

  const [guest] = useState(
    () =>
      new GuestLibrary({
        getItem: (key) => window.localStorage.getItem(key),
        setItem: (key, value) => window.localStorage.setItem(key, value),
      }),
  );
  const [guestError] = useState(() => {
    try {
      guest.list();
      return "";
    } catch (e) {
      return (e as Error).message;
    }
  });
  const [libraryMode, setLibraryMode] = useState<"guest" | "account">("guest");
  const libraryScope = useRef({
    mode: "guest" as "guest" | "account",
    owner: null as string | null,
  });
  const authRequest = useRef(0);
  const [user, setUser] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [docs, setDocs] = useState<Document[]>(() => {
    try {
      return guest.list();
    } catch {
      return [];
    }
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [inspectCard, setInspectCard] = useState<Card | null>(null);
  const inspectorEdit = useRef<(() => void) | undefined>(undefined);
  const closeInspector = useCallback(() => setInspectCard(null), []);
  const [detail, setDetail] = useState<Card | null>(null);
  const [detailEntryId, setDetailEntryId] = useState<string | null>(null);
  const [detailDeckContext, setDetailDeckContext] = useState(false);
  const detailRequest = useRef(0);
  const [printingFilter, setPrintingFilter] = useState("");
  const [prints, setPrints] = useState<Card[]>([]);
  const [face, setFace] = useState(0);
  const [detailZoom, setDetailZoom] = useState(false);
  useEffect(() => setDetailZoom(false), [detail?.id]);
  const [destination, setDestination] = useState(
    () => new URLSearchParams(location.search).get("destination") || "",
  );
  const [qty, setQty] = useState(1);
  const [board, setBoard] = useState<Board>(() => {
    const value = new URLSearchParams(location.search).get("board");
    return ["mainboard", "sideboard", "maybeboard", "commander"].includes(
      value || "",
    )
      ? (value as Board)
      : "mainboard";
  });
  useEffect(() => {
    if (page !== "Discover" && page !== "Scan") return;
    const url = new URL(location.href);
    if (destination) url.searchParams.set("destination", destination);
    else url.searchParams.delete("destination");
    url.searchParams.set("board", board);
    history.replaceState(history.state, "", url);
  }, [page, destination, board]);
  useEffect(() => {
    const pop = () => {
      const params = new URLSearchParams(location.search);
      setDestination(params.get("destination") || "");
      const b = params.get("board");
      if (
        ["mainboard", "sideboard", "maybeboard", "commander"].includes(b || "")
      )
        setBoard(b as Board);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const [finish, setFinish] = useState("nonfoil");
  const [language, setLanguage] = useState("en");

  const [creating, setCreating] = useState<Document["kind"] | null>(null);

  const [prompt, setPrompt] = useState(
    "Improve my mana consistency and interaction.",
  );
  const [budget, setBudget] = useState(20);
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [assistantMode, setAssistantMode] = useState<
    "build" | "upgrade" | "chat"
  >("chat");
  const [chosenChanges, setChosenChanges] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);
  useEffect(() => {
    setChosenChanges([]);
  }, [proposal?.id]);
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
      previous?.focus({preventScroll:true});
    };
  }, [detailOpen]);
  const current = docs.find((d) => d.id === selected && !d.deleted);
  const visible = docs.filter((d) => !d.deleted);
  function clearContext() {
    setSelected("");
    setDestination("");
    setDetail(null);
    setProposal(null);
    setCreating(null);
  }
  function showGuest() {
    libraryScope.current.mode = "guest";
    setLibraryMode("guest");
    try {
      sessionStorage.setItem("cardchasm-library-mode", "guest");
    } catch {
      /* Selection stays in memory. */
    }
    setDocs(guest.list());
    clearContext();
  }
  const refresh = useCallback(
    async (preferAccount = false) => {
      const request = ++authRequest.current;
      const me = await api<{ user: string | null; aiConfigured: boolean }>(
        "/me",
      );
      if (request !== authRequest.current) return;
      const prior = libraryScope.current.owner;
      libraryScope.current.owner = me.user;
      setUser(me.user);
      setAiConfigured(me.aiConfigured);
      let preference: string | null = null;
      try {
        preference = sessionStorage.getItem("cardchasm-library-mode");
      } catch {
        /* Default below. */
      }
      if (preferAccount && me.user) {
        preference = "account";
        try {
          sessionStorage.setItem("cardchasm-library-mode", "account");
        } catch {
          /* Keep this session's choice. */
        }
      }
      const account = !!me.user && (preferAccount || preference !== "guest");
      libraryScope.current.mode = account ? "account" : "guest";
      setLibraryMode(account ? "account" : "guest");
      // Never leave the previous account's documents visible while a new request is pending.
      setDocs(account ? [] : guest.list());
      if (prior !== me.user) {
        setSelected("");
        setDestination("");
        setDetail(null);
        setProposal(null);
      }
      if (account) {
        const documents = await api<Document[]>("/documents");
        if (
          request === authRequest.current &&
          libraryScope.current.owner === me.user &&
          libraryScope.current.mode === "account"
        )
          setDocs(documents);
      }
    },
    [guest, setSelected],
  );
  useEffect(() => {
    refresh().catch((e) => setMessage("Working locally. " + e.message));
  }, [refresh]);
  useEffect(() => {
    if (guestError) setMessage(guestError);
    else {
      try {
        guest.publish();
      } catch {
        /* Existing guest read error is surfaced separately. */
      }
    }
  }, [guestError, guest]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === GUEST_KEY && libraryScope.current.mode === "guest") {
        try {
          setDocs(guest.list());
        } catch (e) {
          setMessage((e as Error).message);
        }
      }
    };
    addEventListener("storage", changed);
    return () => removeEventListener("storage", changed);
  }, [guest]);
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
    const scope = { ...libraryScope.current };
    const saved =
      scope.mode === "guest"
        ? guest.save(d)
        : await api<Document>("/documents/" + d.id, d, "PUT");
    if (
      scope.mode === libraryScope.current.mode &&
      scope.owner === libraryScope.current.owner
    )
      setDocs((all) => [...all.filter((x) => x.id !== d.id), saved]);
    return saved;
  }
  async function documentHistory(id: string) {
    return libraryScope.current.mode === "guest"
      ? guest.history(id)
      : api<{ document: Document }[]>("/documents/" + id + "/history");
  }
  function open(c: Card) {
    inspectorEdit.current = () => {
      setInspectCard(null);
      void openPrinting(c);
    };
    setInspectCard(c);
  }
  async function openPrinting(c: Card) {
    setDetailEntryId(null);
    setDetailDeckContext(false);
    const request = ++detailRequest.current;
    setPrintingFilter("");
    setDetail(c);
    setPrints([]);
    setRulings([]);
    setFace(0);
    setQty(1);
    setFinish(
      c.finishes?.includes("nonfoil")
        ? "nonfoil"
        : c.finishes?.[0] || "nonfoil",
    );
    setLanguage(c.lang || "en");
    await run(async () => {
      if (c.oracle_id) {
        const r = await api<{ data: Card[] }>(
          `/cards?mode=prints&q=${c.oracle_id}`,
        );
        if (request === detailRequest.current)
          setPrints([c, ...r.data.filter((p) => p.id !== c.id)]);
      }
    });
  }
  function navigate(next: string) {
    if (next === "Assistant") setAssistantMode("chat");
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
    if (libraryScope.current.mode === "guest") {
      try {
        sessionStorage.setItem("cardchasm-library-mode", "guest");
      } catch {
        /* Keep local mode. */
      }
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
      const existing = detailEntryId
        ? d.entries.find((entry) => entry.id === detailEntryId)
        : undefined;
      await save(
        detailEntryId
          ? replacePrinting(d, detailEntryId, detail, {
              qty,
              finish,
              language,
              board: e.board,
            })
          : { ...d, entries: [...d.entries, e] },
      );
      setMessage(
        `${qty} × ${detail.name} ${existing ? "updated in" : "saved to"} ${d.name}.`,
      );
      setDetail(null);
    });
  }
  return (
    <div className={page === "Playtest" ? "shell playtest-mode" : "shell"}>
      <aside className="navigation">
        <a className="brand" href="#" onClick={() => navigate("Home")}>
          <span className="brand-icon">
            <Crest />
          </span>
          <span>StackSynergy</span>
        </a>
        <nav aria-label="Main navigation">
          {["Decks", "Collections", "Discover", "More"].map((p) => (
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
                    : p === "More"
                      ? "Tools"
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
                ? "AI deck assistant"
                : p === "Multiplayer"
                  ? "Online play"
                  : p === "More"
                    ? "Tools"
                    : p}
            </button>
          ))}
        </div>
        <div className="nav-bottom">
          <span className="dot" />
          {libraryMode === "guest"
            ? "Guest · on this device"
            : "Account library"}
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
        {["Decks", "Collections", "Discover", "More"].map((p) => (
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
                  : p === "More"
                    ? "Tools"
                    : p}
            </span>
          </button>
        ))}
      </nav>
      <main>
        <header className="topbar">
          <button
            className="appbar-brand"
            onClick={() => navigate("Home")}
            aria-label="StackSynergy overview"
          >
            <Crest /><span>StackSynergy</span>
          </button>
          <span className="storage-status">
            {libraryMode === "guest" ? "On this device" : "Account library"}
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
              signedIn={libraryMode === "account"}
              onNavigate={(next) => { navigate(next); if(next === "Assistant") setAssistantMode("build"); }}
              onOpen={openDocument}
              onCreate={beginCreate}
            />
          )}
          <div hidden={page !== "Discover"}>
            <CardSearch
              documents={visible}
              targetId={destination}
              onTarget={setDestination}
              board={board}
              onBoard={setBoard}
              onOpen={open}
              onAdd={quickAdd}
              canSave={true}
              onBack={() => {
                const target = visible.find((d) => d.id === destination);
                if (target) openDocument(target);
                else navigate("Home");
              }}
            />
          </div>
          <div hidden={page === "Playtest"}>
            {(page === "Collections" ||
              page === "Decks" ||
              page === "Playtest") &&
              (current &&
              (page === "Decks" || page === "Playtest"
                ? current.kind === "deck"
                : current.kind !== "deck") ? (
                <DocumentEditor
                  key={libraryMode + ":" + (user || "guest") + ":" + current.id}
                  document={current}
                  allDocuments={visible}
                  onSave={save}
                  onHistory={documentHistory}
                  onMove={async (target, ids) => {
                    const scope = { ...libraryScope.current };
                    const result =
                      libraryMode === "guest"
                        ? guest.move(current, target, ids)
                        : await api<{
                            id: string;
                            documents: Document[];
                          }>("/inventory/move", {
                            source: current.id,
                            target: target.id,
                            sourceRevision: current.revision,
                            targetRevision: target.revision,
                            entries: ids,
                          });
                    if (
                      scope.mode !== libraryScope.current.mode ||
                      scope.owner !== libraryScope.current.owner
                    )
                      throw Error(
                        "Library changed; reopen it to see the completed move.",
                      );
                    setDocs((all) => [
                      ...all.filter(
                        (x) => !result.documents.some((d) => d.id === x.id),
                      ),
                      ...result.documents,
                    ]);
                    return result.id;
                  }}
                  onUndoMove={async (id) => {
                    const scope = { ...libraryScope.current };
                    const result =
                      libraryMode === "guest"
                        ? guest.undoMove(id)
                        : await api<{ documents: Document[] }>(
                            `/inventory/move/${id}/undo`,
                            {},
                          );
                    if (
                      scope.mode !== libraryScope.current.mode ||
                      scope.owner !== libraryScope.current.owner
                    )
                      throw Error(
                        "Library changed; reopen it to see the completed move.",
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
                  onOpen={(card, nextBoard, entryId) => {
                    inspectorEdit.current = () => {
                      setInspectCard(null);
                      setDestination(current.id);
                      if (nextBoard) setBoard(nextBoard);
                      void openPrinting(card);
                      setDetailDeckContext(current.kind === "deck");
                      if (entryId) {
                        const entry = current.entries.find(
                          (entry) => entry.id === entryId,
                        );
                        if (entry) {
                          setDetailEntryId(entryId);
                          setQty(entry.qty);
                          setFinish(entry.finish);
                        }
                      }
                    };
                    setInspectCard(card);
                  }}
                  onPlay={() => setPage("Playtest")}
                  onAssistant={() => {
                    setAssistantMode("upgrade");
                    setPage("Assistant");
                  }}
                />
              ) : (
                <LibraryScreen
                  key={page}
                  kind={page === "Decks" ? "deck" : "collection"}
                  documents={visible}
                  signedIn={libraryMode === "account"}
                  onOpen={openDocument}
                  onCreate={beginCreate}
                  onNavigate={navigate}
                />
              ))}
          </div>
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
                    "AI deck assistant",
                    "Analyze decks and review proposed changes",
                  ],
                  [
                    "Settings",
                    "Account & backups",
                    "Local storage, optional account, exports and recoverable trash",
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
              <Scanner
                onBack={()=>navigate("More")}
                onSearch={()=>navigate("Discover")}
                onSelect={c=>{void openPrinting(c);}}
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
                <Tabletop
                  deck={current}
                  key={current.id}
                  onBack={() => setPage("Decks")}
                />
              ) : (
                <div className="panel empty">Choose a saved deck to begin.</div>
              )}
            </>
          )}
          {page === "Multiplayer" && (
            <Multiplayer
              signedIn={!!user}
              onSignIn={() => navigate("Settings")}
              decks={
                libraryMode === "account"
                  ? visible.filter((d) => d.kind === "deck")
                  : []
              }
            />
          )}
          {page === "Assistant" && (
            <section className="panel assistant">
              <div
                className="assistant-mode-tabs"
                role="group"
                aria-label="Deck tools"
              >
                <button
                  aria-pressed={assistantMode === "chat"}
                  onClick={() => setAssistantMode("chat")}
                >
                  AI deck assistant
                </button>
                <button
                  aria-pressed={assistantMode === "build"}
                  onClick={() => setAssistantMode("build")}
                >
                  New deck
                </button>
                <button
                  aria-pressed={assistantMode === "upgrade"}
                  onClick={() => setAssistantMode("upgrade")}
                >
                  Upgrade existing deck
                </button>
              </div>
              <div hidden={assistantMode !== "chat"}>
                <DeckAIChat
                  ownerKey={user || "guest"}
                  key={"ai:" + libraryMode + ":" + (user || "guest")}
                  documents={docs}
                  scope={libraryMode}
                  initialDeckId={selected}
                  onSave={save}
                  onAccountSaved={(d) => {
                    if (
                      libraryScope.current.mode === "account" &&
                      libraryScope.current.owner === user
                    )
                      setDocs((all) => [
                        ...all.filter((x) => x.id !== d.id),
                        d,
                      ]);
                  }}
                  onInspect={(card) => {
                    inspectorEdit.current = undefined;
                    setInspectCard(card);
                  }}
                />
              </div>
              <div hidden={assistantMode !== "build"}>
                <CommanderBuilder
                  onInspect={(card) => {
                    inspectorEdit.current = undefined;
                    setInspectCard(card);
                  }}
                  key={libraryMode + ":" + (user || "guest")}
                  documents={docs}
                  onSave={save}
                  onOpen={openDocument}
                />
              </div>
              <div hidden={assistantMode !== "upgrade"}>
                <DeckUpgrader
                  storageScope={libraryMode + ":" + (user || "guest")}
                  key={"upgrade:" + libraryMode + ":" + (user || "guest")}
                  documents={docs}
                  initialDeckId={selected}
                  onSave={save}
                  onOpen={openDocument}
                  onInspect={(card) => {
                    inspectorEdit.current = undefined;
                    setInspectCard(card);
                  }}
                />
                <details className="legacy-model-upgrade">
                  <summary>Previous model analysis (retired)</summary>
                  <p>
                    Use the AI deck assistant tab for grounded conversation and
                    reviewed swaps.
                  </p>
                  <div className="upgrade-workbench">
                    <div className="eyebrow">UPGRADE AN EXISTING DECK</div>
                    <h2>Tune the deck you already have.</h2>
                    <p>
                      Set an addition budget and review proposed changes before
                      applying them. Model analysis needs a configured server;
                      community statistics are not connected.
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
                        {...plainTextInputProps}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                      />
                    </label>
                    <label>
                      Total addition budget (USD)
                      <input
                        {...plainTextInputProps}
                        type="number"
                        value={budget}
                        min="0"
                        onChange={(e) => setBudget(Number(e.target.value))}
                      />
                    </label>
                    <label className="checkbox">
                      <input
                        {...plainTextInputProps}
                        type="checkbox"
                        checked={ownedOnly}
                        onChange={(e) => setOwnedOnly(e.target.checked)}
                      />{" "}
                      Use owned cards only
                    </label>
                    <button
                      className="primary"
                      disabled={true}
                      onClick={() =>
                        run(async () => {
                          const scope = { ...libraryScope.current };
                          const next = await api<Proposal>("/assistant", {
                            deckId: selected,
                            prompt,
                            budget,
                            ownedOnly,
                          });
                          if (
                            scope.mode === libraryScope.current.mode &&
                            scope.owner === libraryScope.current.owner
                          )
                            setProposal(next);
                        })
                      }
                    >
                      Analyze & propose
                    </button>
                    {(!aiConfigured || !user || libraryMode !== "account") && (
                      <p>
                        Model-backed upgrades require an account library and a
                        configured server model credential. No model requests
                        are made here without those conditions. Guest decks can
                        use in-deck heuristic recommendations and the full
                        rules-based builder above.
                      </p>
                    )}
                    {proposal && (
                      <div>
                        <h3>Proposed changes</h3>
                        <p>{proposal.analysis}</p>
                        {proposal.changes.map((c) => (
                          <label className="checkbox" key={c.id}>
                            <input
                              {...plainTextInputProps}
                              type="checkbox"
                              checked={chosenChanges.includes(c.id)}
                              onChange={(e) =>
                                setChosenChanges((ids) =>
                                  e.target.checked
                                    ? [...ids, c.id]
                                    : ids.filter((id) => id !== c.id),
                                )
                              }
                            />
                            {c.entry.card.name} ·{" "}
                            {c.entry.card.set?.toUpperCase()} #
                            {c.entry.card.collector_number} · {c.entry.board} ·{" "}
                            {c.before} → {c.after} · {c.reason}
                          </label>
                        ))}
                        {(() => {
                          try {
                            if (!current)
                              throw Error("Choose the original deck.");
                            const preview = applyProposal(
                              proposal,
                              user || "",
                              current,
                              chosenChanges,
                              docs,
                            );
                            return (
                              <p>
                                Selected additions: {preview.addedCopies}.
                                Priced: {preview.pricedCopies}/
                                {preview.addedCopies}. Estimated addition cost:
                                ${preview.purchaseCost.toFixed(2)} / $
                                {proposal.budget.toFixed(2)}.{" "}
                                {preview.validation.errors.join(" ")}{" "}
                                {preview.validation.warnings.join(" ")}
                              </p>
                            );
                          } catch (e) {
                            return <p role="status">{(e as Error).message}</p>;
                          }
                        })()}
                        {proposal.rejected.map((s) => (
                          <p key={s} className="error">
                            Rejected: {s}
                          </p>
                        ))}
                        <p>
                          {proposal.evidence} Retrieved {proposal.retrievedAt}
                        </p>
                        <button
                          disabled={
                            busy ||
                            applying ||
                            !chosenChanges.length ||
                            proposal.deckId !== current?.id ||
                            proposal.revision !== current?.revision ||
                            proposal.accountId !== user
                          }
                          onClick={() => {
                            if (applying) return;
                            setApplying(true);
                            void run(async () => {
                              const scope = { ...libraryScope.current };
                              const result = await api<{ document: Document }>(
                                `/assistant/${proposal.id}/apply`,
                                { changes: chosenChanges },
                              );
                              if (
                                scope.mode !== libraryScope.current.mode ||
                                scope.owner !== libraryScope.current.owner
                              )
                                throw Error(
                                  "Library changed; reopen the account library to see the applied changes.",
                                );
                              setDocs((all) => [
                                ...all.filter(
                                  (d) => d.id !== result.document.id,
                                ),
                                result.document,
                              ]);
                              setProposal(null);
                              setChosenChanges([]);
                            }).finally(() => setApplying(false));
                          }}
                        >
                          {applying ? "Applying…" : "Apply selected changes"}
                        </button>
                        <button onClick={() => setProposal(null)}>
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            </section>
          )}
          {page === "Settings" && (
            <section className="panel">
              <div className="eyebrow">YOUR ACCOUNT</div>
              <h1>Keep your cards close.</h1>
              <p>
                {libraryMode === "guest"
                  ? "Guest library: saved only in this browser/device and server address. It is not backed up automatically. Clearing app/browser storage or changing address can hide or remove local data. Download an export regularly."
                  : "Account library: stored on this StackSynergy server. A local server is not a cloud backup; download exports and back up the server."}
              </p>
              {guestError && (
                <button
                  onClick={() =>
                    run(async () =>
                      download(
                        "cardchasm-guest-recovery.json",
                        localStorage.getItem(GUEST_KEY) || "",
                        "application/json",
                      ),
                    )
                  }
                >
                  Download preserved guest recovery file
                </button>
              )}
              <div className="toolbar">
                <button
                  disabled={busy}
                  onClick={() => run(async () => showGuest())}
                >
                  Use guest library
                </button>
                {user && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        clearContext();
                        try {
                          sessionStorage.setItem(
                            "cardchasm-library-mode",
                            "account",
                          );
                        } catch {
                          /* Optional preference */
                        }
                        await refresh(true);
                      })
                    }
                  >
                    Use account library
                  </button>
                )}
                <button
                  onClick={() =>
                    run(async () =>
                      download(
                        "cardchasm-guest-backup.json",
                        JSON.stringify(guest.backup(), null, 2),
                        "application/json",
                      ),
                    )
                  }
                >
                  Export guest library
                </button>
                <label className="button">
                  Import library JSON as new guest copies
                  <input
                    {...plainTextInputProps}
                    type="file"
                    accept=".json,application/json"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file)
                        void run(async () => {
                          if (file.size > 15 * 1024 * 1024)
                            throw Error("Choose an export under 15 MB.");
                          const imported = guest.importBackup(
                            await file.text(),
                          );
                          if (libraryScope.current.mode === "guest")
                            setDocs(guest.list());
                          setMessage(
                            `Imported ${imported.length} new guest copies; existing documents were preserved.`,
                          );
                        });
                    }}
                  />
                </label>
              </div>
              {libraryMode === "guest" && (
                <section aria-label="Guest trash">
                  <h3>Guest trash · recoverable documents</h3>
                  {docs
                    .filter((d) => d.deleted)
                    .map((d) => (
                      <div key={d.id}>
                        {d.name}
                        <button
                          onClick={() =>
                            run(async () => {
                              await save({ ...d, deleted: false });
                            })
                          }
                        >
                          Restore {d.name}
                        </button>
                      </div>
                    ))}
                </section>
              )}
              <p>
                Sign-in is optional. It is recommended if you want to keep a
                separate library on this server and access it from another
                device. Guest originals stay on this device.
              </p>
              {user && (
                <section aria-label="Copy guest documents to account">
                  <h2>Copy guest documents to this account</h2>
                  <p>
                    Each button creates a new account document. Existing account
                    documents are never replaced. Guest originals remain.
                    Retrying an interrupted copy does not create a duplicate.
                  </p>
                  {(() => {
                    try {
                      return guest
                        .list()
                        .filter((d) => !d.deleted)
                        .map((document) => (
                          <div className="toolbar" key={document.id}>
                            <span>
                              {document.name} · {document.entries.length} rows
                            </span>
                            <button
                              disabled={
                                busy ||
                                !!guest.copyStatus(user, document)?.target
                              }
                              onClick={() =>
                                run(async () => {
                                  const owner = user;
                                  const latest = guest
                                    .list()
                                    .find((d) => d.id === document.id);
                                  if (
                                    !latest ||
                                    latest.revision !== document.revision
                                  )
                                    throw Error(
                                      "Guest document changed. Review it before copying.",
                                    );
                                  const receipt = guest.copyRequest(
                                    owner,
                                    latest,
                                  );
                                  const result = await api<{ id: string }>(
                                    "/documents/copy-guest",
                                    { token: receipt.token, document: latest },
                                  );
                                  guest.finishCopy(owner, latest, result.id);
                                  if (libraryScope.current.owner === owner) {
                                    setMessage(
                                      "Guest document copied; original preserved.",
                                    );
                                    if (libraryScope.current.mode === "account")
                                      await refresh(true);
                                    else setDocs([...guest.list()]);
                                  }
                                })
                              }
                            >
                              {guest.copyStatus(user, document)?.target
                                ? "Copied this version"
                                : "Copy to account"}
                            </button>
                          </div>
                        ));
                    } catch (e) {
                      return <p role="alert">{(e as Error).message}</p>;
                    }
                  })()}
                </section>
              )}
              {!user ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await api("/auth/login", { email, password });
                      setPassword("");
                      await refresh(true);
                    });
                  }}
                >
                  <label>
                    Email
                    <input
                      {...plainTextInputProps}
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
                      {...plainTextInputProps}
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
                          await refresh(true);
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
                    <button onClick={() => run(() => refresh(true))}>
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
                          ++authRequest.current;
                          libraryScope.current.owner = null;
                          setUser(null);
                          showGuest();
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
      {inspectCard && (
        <CardInspector
          card={inspectCard}
          onClose={closeInspector}
          onEdit={inspectorEdit.current}
        />
      )}
      {detail && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Card details"
            className={detailZoom ? "modal detail-zoomed" : "modal"}
          >
            <button
              className="close"
              aria-label="Close card details"
              onClick={() => setDetail(null)}
            >
              ×
            </button>
            <div>
              {image(detail, face) ? (
                <button
                  className="detail-art-button"
                  aria-label={
                    detailZoom ? "Return to card details" : "Zoom card image"
                  }
                  aria-expanded={detailZoom}
                  onClick={() => setDetailZoom(!detailZoom)}
                >
                  <img
                    className="detail-image"
                    src={image(detail, face)}
                    alt={detail.name}
                  />
                  <span>{detailZoom ? "Back to details" : "Zoom image"}</span>
                </button>
              ) : (
                <p>
                  Card image unavailable. Rules and printing details are below.
                </p>
              )}{" "}
              {detail.card_faces && (
                <button onClick={() => setFace((f) => (f ? 0 : 1))}>
                  Other face
                </button>
              )}
            </div>
            <div>
              <h2>{detail.name}</h2>
              <p>
                {detail.mana_cost} · {detail.type_line}
              </p>
              <p className="oracle">
                {detail.oracle_text ||
                  detail.card_faces?.map((f) => f.oracle_text).join("\n\n")}
              </p>
              <label>
                Find a printing
                <input
                  {...plainTextInputProps}
                  value={printingFilter}
                  onChange={(e) => setPrintingFilter(e.target.value)}
                  placeholder="Set, collector number or language"
                />
              </label>
              <label>
                Printing
                <select
                  aria-label="Printing"
                  value={detail.id}
                  onChange={(e) => {
                    const printing =
                      prints.find((c) => c.id === e.target.value) || detail;
                    setDetail(printing);
                    setLanguage(printing.lang || "en");
                    setFinish(
                      printing.finishes?.includes("nonfoil")
                        ? "nonfoil"
                        : printing.finishes?.[0] || "nonfoil",
                    );
                    setFace(0);
                  }}
                >
                  {(prints.length ? prints : [detail])
                    .filter(
                      (c) =>
                        c.id === detail.id ||
                        `${c.set_name} ${c.set} ${c.collector_number} ${c.lang}`
                          .toLowerCase()
                          .includes(printingFilter.toLowerCase()),
                    )
                    .map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.set_name} ({c.set}) #{c.collector_number} · {c.lang}
                      </option>
                    ))}
                </select>
              </label>
              <p>
                {detail.prices?.[
                  finish === "foil"
                    ? "usd_foil"
                    : finish === "etched"
                      ? "usd_etched"
                      : "usd"
                ]
                  ? `USD $${detail.prices[finish === "foil" ? "usd_foil" : finish === "etched" ? "usd_etched" : "usd"]}`
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
                  aria-label="Destination"
                  value={destination}
                  disabled={detailDeckContext}
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
                  {...plainTextInputProps}
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
                  {(detail.finishes || ["nonfoil"]).map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Language
                <input
                  {...plainTextInputProps}
                  value={language}
                  readOnly
                  aria-label="Printing language (choose a printing to change)"
                />
              </label>
              <button
                className="primary"
                disabled={
                  busy ||
                  !destination ||
                  !Number.isInteger(qty) ||
                  qty < 1 ||
                  qty > 10000
                }
                onClick={add}
              >
                {detailEntryId
                  ? "Confirm printing & save →"
                  : "Confirm printing & add →"}
              </button>
              {!destination && (
                <p>
                  Create or choose a deck or binder to save this card. No
                  account needed.
                </p>
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
