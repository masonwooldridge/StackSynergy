import { plainTextInputProps } from "./inputBehavior";
import { useEffect, useState } from "react";
import type { Document } from "../shared/model";
import { image } from "../shared/model";
import { bottomRequired, phases, soloAction, startSolo } from "../shared/solo";
import type {
  SoloAction,
  SoloPiece,
  SoloState,
  SoloZone,
} from "../shared/solo";
import "./tabletop.css";
import "./playtestReference.css";
import { decodeSoloSession, encodeSoloSession } from "../shared/soloSession";
const labels: Record<SoloZone, string> = {
  library: "Library",
  hand: "Hand",
  battlefield: "Battlefield",
  graveyard: "Graveyard",
  exile: "Exile",
  command: "Command zone",
  stack: "Stack",
};
const version = (deck: Document) =>
  JSON.stringify(deck.entries.map((e) => [e.id, e.card.id, e.qty, e.board]));
export default function Tabletop({
  deck,
  onBack,
}: {
  deck: Document;
  onBack: () => void;
}) {
  const storageKey = `cardchasm-solo-v2:${deck.id}`;
  const [initial] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const saved = decodeSoloSession(raw);
      if (saved)
        return {
          ...saved,
          warning:
            saved.version === version(deck)
              ? ""
              : "Your deck changed. This playtest is preserved; New game loads the updated deck.",
        };
      return {
        state: startSolo(deck),
        version: version(deck),
        past: [] as SoloState[],
        future: [] as SoloState[],
        warning: raw
          ? "The saved session could not be read. A new session was started."
          : "",
      };
    } catch {
      return {
        state: startSolo(deck),
        version: version(deck),
        past: [] as SoloState[],
        future: [] as SoloState[],
        warning: "Session storage is unavailable. Keep this page open.",
      };
    }
  });
  const [fingerprint, setFingerprint] = useState(initial.version);
  const [state, setState] = useState<SoloState & { deckVersion?: string }>({
    ...initial.state,
    deckVersion: initial.version,
  });
  const [sessionWarning, setSessionWarning] = useState(initial.warning);
  const [storageError, setStorageError] = useState("");
  const [past, setPast] = useState<SoloState[]>(initial.past),
    [future, setFuture] = useState<SoloState[]>(initial.future);
  const [selected, setSelected] = useState(""),
    [bottom, setBottom] = useState<string[]>([]),
    [error, setError] = useState("");
  const [drawer, setDrawer] = useState<SoloZone | null>(null),
    [peek, setPeek] = useState(false),
    [find, setFind] = useState("");
  const [drawCount, setDrawCount] = useState(1),
    [autoDraw, setAutoDraw] = useState(true),
    [tools, setTools] = useState(false),
    [restart, setRestart] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [tokenName, setTokenName] = useState("Soldier"),
    [tokenStats, setTokenStats] = useState("1/1 white creature");
  const [random, setRandom] = useState("");
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        encodeSoloSession(fingerprint, state, past, future),
      );
      setStorageError("");
    } catch {
      setStorageError(
        "This playtest is not saved on this device. Keep the page open; progress may be lost on reload.",
      );
    }
  }, [fingerprint, state, storageKey, past, future]);
  useEffect(() => {
    if (!restart && !zoom) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(".solo-dialog");
    dialog?.querySelector<HTMLElement>("button")?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setRestart(false);
        setZoom(false);
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button,a[href],input,select,textarea",
        ),
      ).filter((e) => !e.hasAttribute("disabled"));
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus({ preventScroll: true });
    };
  }, [restart, zoom]);
  function commit(next: SoloState, nextVersion = fingerprint) {
    setPast((h) => [...h.slice(-49), state]);
    setFuture([]);
    setState({ ...next, deckVersion: nextVersion });
    setFingerprint(nextVersion);
    setError("");
  }
  function act(action: SoloAction) {
    try {
      commit(soloAction(state, action));
      if (action.type === "mulligan" || action.type === "keep") setBottom([]);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const count = (zone: SoloZone) =>
    state.pieces.filter((p) => p.zone === zone).length;
  const hand = state.pieces.filter((p) => p.zone === "hand");
  const handLands = hand.filter((p) =>
    p.card.type_line?.includes("Land"),
  ).length;
  const card = state.pieces.find((p) => p.id === selected);
  const isLand = !!card?.card.type_line?.includes("Land");
  const isSpell =
    !!card?.card.type_line &&
    /Instant|Sorcery/.test(card.card.type_line) &&
    !/Creature|Artifact|Enchantment|Planeswalker|Battle/.test(
      card.card.type_line,
    );
  const opening = state.stage === "opening";
  const needed = Math.min(bottomRequired(state), count("hand"));
  function choose(p: SoloPiece) {
    if (opening && p.zone === "hand" && needed) {
      setBottom((ids) =>
        ids.includes(p.id)
          ? ids.filter((id) => id !== p.id)
          : ids.length < needed
            ? [...ids, p.id]
            : ids,
      );
    } else {setSelected(p.id);if(drawer===p.zone)setDrawer(null);}
  }
  function move(zone: SoloZone, position?: "top" | "bottom") {
    if (card) act({ type: "move", id: card.id, zone, position });
  }
  function tile(p: SoloPiece) {
    const src = image(p.card, p.flipped ? 1 : 0);
    return (
      <button
        key={p.id}
        style={p.zone==='hand'?{'--fan-angle':`${(hand.findIndex(c=>c.id===p.id)-(hand.length-1)/2)*4}deg`,'--fan-rise':`${Math.abs(hand.findIndex(c=>c.id===p.id)-(hand.length-1)/2)**2*4}px`} as React.CSSProperties:undefined}
        draggable={!opening||(p.zone==='hand'&&needed>0)}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)}
        onClick={() => choose(p)}
        onDoubleClick={() => {
          if (!opening && p.zone === "battlefield")
            act({ type: "tap", id: p.id });
        }}
        aria-label={`${labels[p.zone]}: ${p.card.name}${p.tapped ? ", tapped" : ""}`}
        aria-pressed={selected === p.id}
        className={`play-card ${p.tapped ? "is-tapped" : ""} ${bottom.includes(p.id) ? "to-bottom" : ""}`}
      >
        {src ? (
          <img src={src} alt={p.card.name} draggable={false} />
        ) : (
          <span className="token-face">
            <strong>{p.card.name}</strong>
            <small>{p.card.oracle_text}</small>
          </span>
        )}
        <span className="play-card-caption">{p.card.name}</span>
        {p.counters > 0 && <b className="counter-badge">+{p.counters}</b>}
        {p.tapped && <span className="tap-badge">Tapped</span>}
        {bottom.includes(p.id) && (
          <b className="bottom-badge">Bottom {bottom.indexOf(p.id) + 1}</b>
        )}
      </button>
    );
  }
  function drop(zone: SoloZone, e: React.DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (state.pieces.some((p) => p.id === id)) act({ type: "move", id, zone });
  }
  function undo() {
    const prev = past[past.length - 1];
    if (prev) {
      setFuture((h) => [state, ...h]);
      setState(prev);
      setFingerprint(
        (prev as SoloState & { deckVersion?: string }).deckVersion ||
          fingerprint,
      );
      setPast((h) => h.slice(0, -1));
      setBottom([]);
      setError("");
    }
  }
  function redo() {
    if (future[0]) {
      setPast((h) => [...h, state]);
      setState(future[0]);
      setFingerprint(
        (future[0] as SoloState & { deckVersion?: string }).deckVersion ||
          fingerprint,
      );
      setFuture((h) => h.slice(1));
      setBottom([]);
    }
  }
  function loadUpdatedDeck() {
    commit(startSolo(deck), version(deck));
    setSessionWarning("");
    setSelected("");
    setBottom([]);
    setDrawer(null);
    setRestart(false);
  }
  const updatedMainCards = deck.entries
    .filter((e) => e.board === "mainboard")
    .reduce((n, e) => n + e.qty, 0);
  const playable = state.pieces.filter(
    (piece) => !piece.token && piece.zone !== "command",
  ).length;
  if (!playable)
    return (
      <section className="solo-empty">
        <h1>
          {updatedMainCards
            ? "Your updated deck is ready"
            : "Add cards to begin"}
        </h1>
        <p>
          {updatedMainCards
            ? `This saved session has no library cards. Your deck now has ${updatedMainCards} mainboard card${updatedMainCards === 1 ? "" : "s"}. Load the updated deck to start an opening hand; Undo can restore this session.`
            : "Add mainboard cards to draw an opening hand. Commander, side and maybe cards stay outside the library."}
        </p>
        {updatedMainCards > 0 && (
          <button className="primary" onClick={loadUpdatedDeck}>
            Load updated deck
          </button>
        )}
        <button onClick={onBack}>Back to deck</button>
        {!!past.length && <button onClick={undo}>↶ Undo reset</button>}
      </section>
    );
  return (
    <section
      className={`solo-table ${opening ? "is-opening" : ""}`}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (
          (event.target as HTMLElement).matches("input,textarea,select") ||
          event.metaKey ||
          event.ctrlKey ||
          event.altKey
        )
          return;
        if (event.key === "Escape") {
          setSelected("");
          setDrawer(null);
          setTools(false);
          setRestart(false);
          setZoom(false);
        }
        if (restart || zoom) return;
        if (event.key.toLowerCase() === "d" && !opening) {
          event.preventDefault();
          act({ type: "draw", count: 1 });
        }
        if (event.key.toLowerCase() === "t" && card?.zone === "battlefield") {
          event.preventDefault();
          act({ type: "tap", id: card.id });
        }
      }}
    >
      <div className="playtest-corner-tools"><button onClick={onBack} aria-label="Close playtest">× <span>Close</span></button><button onClick={()=>setTools(true)} aria-label="Keybinds and game options">ⓘ <span>Keybinds</span></button><small>{deck.name}</small></div>
      <div className="solo-scorebar" aria-label="Playtest controls">
        <div className="life-control">
          <button
            aria-label="Lose one life"
            onClick={() => act({ type: "life", delta: -1 })}
          >
            −
          </button>
          <span>
            <strong>{state.life}</strong>
            <small>Life</small>
          </span>
          <button
            aria-label="Gain one life"
            onClick={() => act({ type: "life", delta: 1 })}
          >
            +
          </button>
        </div>
        <span className="compact-turn">Turn {state.turn}</span>
        <div className="quick-mana" aria-label="Mana pool totals">{Object.entries(state.mana).map(([color,value])=><button key={color} aria-label={`${color} mana pool: ${value}; edit mana`} onClick={()=>setTools(true)}><span className={'mana-symbol mana-symbol-'+color}>{color}</span><b>{value}</b></button>)}</div>
        <button
          disabled={opening || !count("library")}
          className="primary"
          onClick={() => act({ type: "draw", count: 1 })}
        >
          Draw
        </button>
        <button
          disabled={opening}
          aria-label="Next turn / untap"
          title="Untap battlefield, clear mana and draw according to your Options preference"
          onClick={() => act({ type: "nextTurn", draw: autoDraw })}
        >
          Next turn
        </button>
        <button disabled={!past.length} onClick={undo}>
          ↶ Undo
        </button>
        <button
          aria-label="Options"
          aria-expanded={tools}
          onClick={() => setTools(!tools)}
        >
          <span className="options-label">Game menu</span>
          <span className="options-symbol" aria-hidden="true">
            ⋯
          </span>
        </button>
        <button className="dice-quick" onClick={()=>{setTools(true);requestAnimationFrame(()=>document.getElementById('solo-random-tools')?.scrollIntoView({block:'nearest'}));}}>Dice &amp; coins</button>
      </div>
      <div className="solo-piles" aria-label="Playtest zones">
        {(
          ["library", "graveyard", "exile", "stack", "command"] as SoloZone[]
        ).map((zone) => (
          <button
            key={zone}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => drop(zone, event)}
            aria-label={`${labels[zone]} (${count(zone)})`}
            aria-pressed={drawer === zone}
            onClick={() => {
              setDrawer(drawer === zone ? null : zone);
              setPeek(false);
              setFind("");
            }}
          >
            <span className="pile-label">{labels[zone]} <b>{count(zone)}</b></span>
            <span className="pile-picture">{zone==='library'?<span className="chasm-cardback"><span>◇</span><small>STACKSYNERGY</small></span>:image(state.pieces.filter(p=>p.zone===zone).slice(-1)[0]?.card||{id:'empty',name:''})?<img src={image(state.pieces.filter(p=>p.zone===zone).slice(-1)[0]!.card)} alt=""/>:<span className="pile-empty">No cards</span>}</span>
          </button>
        ))}
      </div>
      {(sessionWarning || fingerprint !== version(deck)) && (
        <div role="status" className="session-warning">
          <span>
            {sessionWarning || "Deck updated. Your current game is preserved."}
          </span>
          <button onClick={() => setRestart(true)}>
            Start from updated deck
          </button>
        </div>
      )}
      {storageError && <p role="alert">{storageError}</p>}
      {error && (
        <p className="solo-error" role="alert">
          {error}
        </p>
      )}
      {state.pieces.filter((piece) => !piece.token).length <
        (deck.format === "commander" ? 100 : 60) && (
        <p className="incomplete-deck">
          Incomplete deck ·{" "}
          {state.pieces.filter((piece) => !piece.token).length} cards · Manual
          playtest.
        </p>
      )}
      {opening && count("hand") > 0 && (
        <div className="opening-banner">
          <div>
            <strong>
              {state.mulls ? "Review your new hand" : "Opening hand"}
            </strong>
            <p>
              {needed
                ? `Tap ${needed} cards to put on the bottom, in selection order. Selected ${bottom.length}/${needed}.`
                : "Keep these cards, or shuffle back and draw a new seven."}
            </p>
            <label>
              <input
                {...plainTextInputProps}
                type="checkbox"
                checked={state.freeMulligan}
                onChange={(e) => {
                  act({ type: "freeMulligan", value: e.target.checked });
                  setBottom([]);
                }}
              />{" "}
              First mulligan free
            </label>
          </div>
          <div>
            <button onClick={() => act({ type: "mulligan" })}>
              Mulligan ({state.mulls})
            </button>
            <button
              className="primary"
              disabled={bottom.length !== needed}
              onClick={() => act({ type: "keep", bottom })}
            >
              Keep {count("hand") - needed}
            </button>
            <button onClick={()=>setTools(true)}>Options</button>
          </div>
          <small className="opening-hand-hint">Swipe the hand to see every card</small>
          <small className="opening-manual-note">Manual play · resolve costs, triggers and combat yourself</small>
        </div>
      )}
      <div className={`solo-layout ${card ? "has-selection" : ""}`}>
        <div className="playmat">
          <div className="battlefield-surface">
          <div className="battlefield-heading">
            <h3>
              Battlefield <span>{count("battlefield")}</span>
            </h3>
            <small>Select for actions · D to draw · T to tap</small>
          </div>
          {["Permanents", "Lands"].map((row) => (
            <section
              className="battlefield-row"
              key={row}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => drop("battlefield", e)}
            >
              <div className="row-label">{row}</div>
              <div className="table-card-row">
                {state.pieces
                  .filter(
                    (p) =>
                      p.zone === "battlefield" &&
                      (row === "Lands"
                        ? (p.card.type_line || "").includes("Land")
                        : !(p.card.type_line || "").includes("Land")),
                  )
                  .map(tile)}
              </div>
              {!state.pieces.some(
                (p) =>
                  p.zone === "battlefield" &&
                  (row === "Lands"
                    ? (p.card.type_line || "").includes("Land")
                    : !(p.card.type_line || "").includes("Land")),
              ) && (
                <p className="zone-placeholder">
                  {row === "Lands"
                    ? "Your lands go here"
                    : "Play cards from your hand to begin"}
                </p>
              )}
            </section>
          ))}
          </div>
          <div className="hand-dock">
          <div className="hand-heading">
            <button className="hand-menu" onClick={()=>setTools(true)}>⋮ Playtester actions</button>
            <div className="hand-title">
              <h3>
                Hand <span>{count("hand")}</span>
              </h3>
              <small>
                {handLands} lands · {hand.length - handLands} other cards
              </small>
            </div>
          </div>
          <div
            className="hand-area"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => drop("hand", e)}
          >
            {state.pieces.filter((p) => p.zone === "hand").map(tile)}
            {!count("hand") && (
              <p className="zone-placeholder">
                Your hand is empty. Draw a card from your library.
              </p>
            )}
          </div>
          </div>
        </div>
        <aside className="solo-sidebar">
          {card ? (
            <section
              className="card-inspector"
              aria-label="Selected card actions"
            >
              <div className="inspector-heading">
                <strong>{card.card.name}</strong>
                <button
                  aria-label="Close card actions"
                  onClick={() => setSelected("")}
                >
                  ×
                </button>
              </div>
              {image(card.card, card.flipped ? 1 : 0) && (
                <button
                  className="inspector-art-button"
                  aria-label="Enlarge selected card"
                  onClick={() => setZoom(true)}
                >
                  <img
                    className="inspector-image"
                    src={image(card.card, card.flipped ? 1 : 0)}
                    alt={card.card.name}
                  />
                </button>
              )}
              <p className="inspector-oracle">
                {card.card.card_faces?.[card.flipped ? 1 : 0]?.oracle_text ||
                  card.card.oracle_text ||
                  card.card.type_line}
              </p>
              {!opening && (
                <div className="card-action-grid">
                  {["hand", "command"].includes(card.zone) && !isLand && (
                    <button
                      className="primary"
                      onClick={() => act({ type: "cast", id: card.id })}
                    >
                      Cast
                      {card.zone === "command"
                        ? ` · tax +${2 * (state.casts[card.id] || 0)}`
                        : ""}
                    </button>
                  )}
                  {card.zone === "hand" && isLand && (
                    <button
                      className="primary"
                      onClick={() => move("battlefield")}
                    >
                      Play land
                    </button>
                  )}
                  {card.zone === "stack" && isSpell && (
                    <button
                      className="primary"
                      onClick={() => move("graveyard")}
                    >
                      Resolve spell
                    </button>
                  )}
                  {card.zone !== "battlefield" &&
                    !(card.zone === "hand" && isLand) &&
                    !(card.zone === "stack" && isSpell) && (
                      <button onClick={() => move("battlefield")}>
                        {card.zone === "stack"
                          ? "Resolve to battlefield"
                          : "To battlefield"}
                      </button>
                    )}
                  {card.zone === "battlefield" && (
                    <button onClick={() => act({ type: "tap", id: card.id })}>
                      {card.tapped ? "Untap" : "Tap"}
                    </button>
                  )}
                  {card.zone !== "hand" && (
                    <button onClick={() => move("hand")}>To hand</button>
                  )}
                  <button onClick={() => move("graveyard")}>
                    {card.zone === "hand" ? "Discard" : "Graveyard"}
                  </button>
                  <button onClick={() => move("exile")}>Exile</button>
                  <button onClick={() => move("library", "top")}>
                    Library top
                  </button>
                  <button onClick={() => move("library", "bottom")}>
                    Library bottom
                  </button>
                  {deck.entries.some(
                    (e) =>
                      e.board === "commander" && e.card.id === card.card.id,
                  ) && (
                    <button onClick={() => move("command")}>
                      Command zone
                    </button>
                  )}
                  {(card.card.card_faces?.length || 0) > 1 && (
                    <button onClick={() => act({ type: "flip", id: card.id })}>
                      Other face
                    </button>
                  )}
                  <div className="card-counter">
                    <button
                      aria-label="Remove counter"
                      onClick={() =>
                        act({ type: "counter", id: card.id, delta: -1 })
                      }
                    >
                      −
                    </button>
                    <span>{card.counters} counters</span>
                    <button
                      aria-label="Add counter"
                      onClick={() =>
                        act({ type: "counter", id: card.id, delta: 1 })
                      }
                    >
                      +
                    </button>
                  </div>
                  {card.token && (
                    <button
                      onClick={() => act({ type: "removeToken", id: card.id })}
                    >
                      Remove token
                    </button>
                  )}
                </div>
              )}
              {opening && (
                <p className="help-text">
                  {needed
                    ? "Tap cards in your hand to select which ones to bottom."
                    : "Keep your hand to start playing."}
                </p>
              )}
            </section>
          ) : null}
        </aside>
      </div>
      {opening&&<div className="opening-destinations"><div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('text/plain');const piece=hand.find(p=>p.id===id);if(piece&&needed)choose(piece);}}><strong>Bottom of library</strong><span>{needed?`${bottom.length}/${needed} selected · drag or tap cards`:'No cards to bottom'}</span>{bottom.length>0&&<button onClick={()=>setBottom([])}>Clear choices</button>}</div><button onClick={()=>{setDrawer('exile');setPeek(false);}}>Exile <span>{count('exile')} cards · view zone</span></button></div>}
      {drawer && (
        <section
          className="zone-browser"
          aria-label={`${labels[drawer]} contents`}
        >
          <div className="screen-heading">
            <h3>
              {labels[drawer]} <span>{count(drawer)}</span>
            </h3>
            <button aria-label="Close zone" onClick={() => setDrawer(null)}>
              Close
            </button>
          </div>
          {drawer === "library" && (
            <div className="library-reveal-controls">
              <button onClick={() => act({ type: "shuffle" })}>Shuffle</button>
              <button
                aria-pressed={peek}
                onClick={() => {
                  setPeek(true);
                  setFind("");
                }}
              >
                Top card
              </button>
              <button aria-pressed={!peek} onClick={() => setPeek(false)}>
                Search all
              </button>
              <small>Looking is a manual playtest action.</small>
            </div>
          )}
          {!(drawer === "library" && peek) && (
            <input
              {...plainTextInputProps}
              aria-label="Find card in zone"
              placeholder="Find a card…"
              value={find}
              onChange={(e) => setFind(e.target.value)}
            />
          )}
          <div className="table-card-row">
            {state.pieces
              .filter((p) => p.zone === drawer)
              .filter((p, i) =>
                drawer === "library" && peek
                  ? i === 0
                  : p.card.name.toLowerCase().includes(find.toLowerCase()),
              )
              .map(tile)}
          </div>
          {!count(drawer) && <p>This zone is empty.</p>}
        </section>
      )}
      {tools && (
        <section className="solo-tools" aria-label="Playtest options">
          <div className="options-heading">
            <h3>Playtest options</h3>
            <button onClick={() => setTools(false)}>Close options</button>
          </div>
          <div className="options-session-actions">
            <button disabled={!future.length} onClick={redo}>
              ↷ Redo
            </button>
            <button
              onClick={() => {
                setTools(false);
                setRestart(true);
              }}
            >
              New game
            </button>
            <button disabled={opening} onClick={() => act({ type: "phase" })}>
              {phases[state.phase]} ›
            </button>
            <label>
              Draw count
              <input
                {...plainTextInputProps}
                aria-label="Number of cards to draw"
                type="number"
                min="1"
                max="100"
                value={drawCount}
                onChange={(event) =>
                  setDrawCount(
                    Math.max(1, Math.min(100, Number(event.target.value) || 1)),
                  )
                }
              />
            </label>
            <button
              disabled={opening || !count("library")}
              onClick={() => act({ type: "draw", count: drawCount })}
            >
              Draw selected count
            </button>
          </div>
          <div>
            <h3 id="solo-random-tools">Turn preferences &amp; random tools</h3>
            <p className="keybind-help">Keyboard: D draws one card; T taps or untaps the selected permanent; Escape closes panels. Select a card for actions. You resolve rules manually.</p>
            <label>
              <input
                {...plainTextInputProps}
                type="checkbox"
                checked={autoDraw}
                onChange={(e) => setAutoDraw(e.target.checked)}
              />{" "}
              Draw a card with Next turn
            </label>
            <p>
              Untaps your battlefield and clears mana. Use the phase control for
              a step-by-step turn.
            </p>
            <button
              onClick={() =>
                setRandom(
                  `D6: ${(crypto.getRandomValues(new Uint32Array(1))[0] % 6) + 1}`,
                )
              }
            >
              Roll D6
            </button>
            <button
              onClick={() =>
                setRandom(
                  crypto.getRandomValues(new Uint32Array(1))[0] % 2
                    ? "Heads"
                    : "Tails",
                )
              }
            >
              Flip coin
            </button>
            <strong role="status">{random}</strong>
          </div>
          <div>
            <h3>Mana pool</h3>
            <div className="mana-pool">
              {Object.keys(state.mana).map((c) => (
                <div key={c} className={`mana-${c}`}>
                  <button
                    aria-label={`Remove ${c} mana`}
                    onClick={() => act({ type: "mana", color: c, delta: -1 })}
                  >
                    −
                  </button>
                  <span>
                    {c}
                    <b>{state.mana[c]}</b>
                  </span>
                  <button
                    aria-label={`Add ${c} mana`}
                    onClick={() => act({ type: "mana", color: c, delta: 1 })}
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3>Create token</h3>
            <input
              {...plainTextInputProps}
              aria-label="Token name"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              maxLength={80}
            />
            <input
              {...plainTextInputProps}
              aria-label="Token characteristics"
              value={tokenStats}
              onChange={(e) => setTokenStats(e.target.value)}
              maxLength={120}
            />
            <button
              disabled={opening}
              onClick={() =>
                act({ type: "token", name: tokenName, stats: tokenStats })
              }
            >
              Create token
            </button>
          </div>
          <div>
            <h3>Additional trackers</h3>
            {(["poison", "damage"] as const).map((key) => (
              <div className="tracker-row" key={key}>
                <span>{key === "poison" ? "Poison" : "Damage dealt"}</span>
                <button
                  aria-label={`Decrease ${key}`}
                  onClick={() => act({ type: key, delta: -1 })}
                >
                  −
                </button>
                <b>{state[key]}</b>
                <button
                  aria-label={`Increase ${key}`}
                  onClick={() => act({ type: key, delta: 1 })}
                >
                  +
                </button>
              </div>
            ))}
          </div>
          <details className="solo-history">
            <summary>Game history · {state.log.length} actions</summary>
            {state.log.map((message, i) => (
              <p key={i}>{message}</p>
            ))}
          </details>
        </section>
      )}
      <div className="solo-footer">
        <span role="status">{state.log[0]}</span>
        <small>Manual goldfish · You resolve costs, triggers and combat</small>
      </div>

      {restart && (
        <div className="modal-backdrop" onClick={() => setRestart(false)}>
          <section
            className="solo-restart solo-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Start a new game"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Shuffle up again?</h2>
            <p>
              Start with a new opening seven. Your saved deck stays the same.
              Undo can restore this game.
            </p>
            <button onClick={() => setRestart(false)}>Keep playing</button>
            <button
              className="primary"
              onClick={() => {
                commit(startSolo(deck), version(deck));
                setSessionWarning("");
                setSelected("");
                setBottom([]);
                setDrawer(null);
                setRestart(false);
              }}
            >
              New game
            </button>
          </section>
        </div>
      )}
      {zoom && card && (
        <div className="modal-backdrop" onClick={() => setZoom(false)}>
          <section
            className="solo-dialog solo-zoom"
            role="dialog"
            aria-modal="true"
            aria-label={card.card.name}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setZoom(false)}>Close preview</button>
            <img
              src={image(card.card, card.flipped ? 1 : 0)}
              alt={card.card.name}
            />
            <p>{card.card.name}</p>
          </section>
        </div>
      )}
    </section>
  );
}
