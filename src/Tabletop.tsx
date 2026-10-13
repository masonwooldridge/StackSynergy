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
export default function Tabletop({ deck }: { deck: Document }) {
  const storageKey = `cardchasm-solo-v2:${deck.id}`;
  const [fingerprint] = useState(() => version(deck));
  const [state, setState] = useState<SoloState>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (
        saved?.version === version(deck) &&
        Array.isArray(saved.state?.pieces) &&
        saved.state?.mana &&
        saved.state?.casts
      )
        return saved.state;
    } catch {
      /* New session if storage is unavailable. */
    }
    return startSolo(deck);
  });
  const [past, setPast] = useState<SoloState[]>([]),
    [future, setFuture] = useState<SoloState[]>([]);
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
        JSON.stringify({ version: fingerprint, state }),
      );
    } catch {
      /* Playing remains available without storage. */
    }
  }, [fingerprint, state, storageKey]);
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
      previous?.focus();
    };
  }, [restart, zoom]);
  function commit(next: SoloState) {
    setPast((h) => [...h.slice(-49), state]);
    setFuture([]);
    setState(next);
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
    } else setSelected(p.id);
  }
  function move(zone: SoloZone, position?: "top" | "bottom") {
    if (card) act({ type: "move", id: card.id, zone, position });
  }
  function tile(p: SoloPiece) {
    const src = image(p.card, p.flipped ? 1 : 0);
    return (
      <button
        key={p.id}
        draggable={!opening}
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
      setPast((h) => h.slice(0, -1));
      setBottom([]);
      setError("");
    }
  }
  function redo() {
    if (future[0]) {
      setPast((h) => [...h, state]);
      setState(future[0]);
      setFuture((h) => h.slice(1));
      setBottom([]);
    }
  }
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
      <div className="solo-topline">
        <div>
          <span className="solo-kicker">SOLO PLAYTEST</span>
          <h2>{deck.name}</h2>
          <small>
            {deck.format} · {state.pieces.filter((p) => !p.token).length} cards
            · Local session
          </small>
        </div>
        <div className="solo-top-actions">
          <button disabled={!past.length} onClick={undo}>
            ↶ Undo
          </button>
          <button disabled={!future.length} onClick={redo}>
            ↷ Redo
          </button>
          <button aria-expanded={tools} onClick={() => setTools(!tools)}>
            Tools
          </button>
          <button onClick={() => setRestart(true)}>New game</button>
        </div>
      </div>
      <div className="solo-scorebar">
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
        <div className="turn-control">
          <span>
            Turn <strong>{state.turn}</strong>
          </span>
          <button disabled={opening} onClick={() => act({ type: "phase" })}>
            {phases[state.phase]} ›
          </button>
          <button
            disabled={opening}
            className="primary"
            onClick={() => act({ type: "nextTurn", draw: autoDraw })}
          >
            Next turn
          </button>
        </div>
        <div className="solo-piles">
          {(["graveyard", "exile", "stack", "command"] as SoloZone[]).map(
            (zone) => (
              <button
                key={zone}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => drop(zone, e)}
                aria-pressed={drawer === zone}
                onClick={() => {
                  setDrawer(drawer === zone ? null : zone);
                  setFind("");
                }}
              >
                {labels[zone]}
                <b>{count(zone)}</b>
              </button>
            ),
          )}
        </div>
      </div>
      {error && (
        <p className="solo-error" role="alert">
          {error}
        </p>
      )}
      {opening && (
        <div className="opening-banner">
          <div>
            <strong>
              {state.mulls ? "Review your new hand" : "Your opening hand"}
            </strong>
            <p>
              {needed
                ? `Tap ${needed} cards to put on the bottom, in selection order. Selected ${bottom.length}/${needed}.`
                : "Keep these cards, or shuffle back and draw a new seven."}
            </p>
            <label>
              <input
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
              Mulligan{state.mulls ? ` (${state.mulls})` : ""}
            </button>
            <button
              className="primary"
              disabled={bottom.length !== needed}
              onClick={() => act({ type: "keep", bottom })}
            >
              Keep {count("hand") - needed}
            </button>
          </div>
        </div>
      )}
      <div className="solo-layout">
        <div className="playmat">
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
          {!!count("command") && (
            <section className="command-strip">
              <h3>Command zone</h3>
              <div className="table-card-row">
                {state.pieces.filter((p) => p.zone === "command").map(tile)}
              </div>
            </section>
          )}
          <div className="hand-heading">
            <div className="hand-title">
              <h3>
                Hand <span>{count("hand")}</span>
              </h3>
              <small>
                {handLands} lands · {hand.length - handLands} other cards
              </small>
            </div>
            <div className="draw-controls">
              <button
                disabled={opening || !count("library")}
                onClick={() => act({ type: "draw", count: drawCount })}
              >
                Draw{drawCount > 1 ? ` ${drawCount}` : ""}
              </button>
              <input
                aria-label="Number of cards to draw"
                type="number"
                min="1"
                max="100"
                value={drawCount}
                onChange={(e) =>
                  setDrawCount(
                    Math.max(1, Math.min(100, Number(e.target.value) || 1)),
                  )
                }
              />
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
        <aside className="solo-sidebar">
          <div className="library-widget">
            <button
              className="library-back"
              aria-label={`Library: ${count("library")} cards`}
              onClick={() => {
                setDrawer(drawer === "library" ? null : "library");
                setFind("");
              }}
            >
              <span className="card-back-mark">◇</span>
              <strong>{count("library")}</strong>
              <small>Library</small>
            </button>
            <div>
              <button
                disabled={opening || !count("library")}
                className="primary"
                onClick={() => act({ type: "draw", count: 1 })}
              >
                Draw a card
              </button>
              <button onClick={() => act({ type: "shuffle" })}>Shuffle</button>
              <button
                onClick={() => {
                  setDrawer("library");
                  setPeek(true);
                  setFind("");
                }}
              >
                Look at top
              </button>
              <button
                onClick={() => {
                  setDrawer("library");
                  setPeek(false);
                  setFind("");
                }}
              >
                Search library
              </button>
            </div>
          </div>
          {card ? (
            <section className="card-inspector">
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
          ) : (
            <div className="inspector-empty">
              <span>◇</span>
              <strong>Select a card</strong>
              <p>View rules text, cast, move, tap or add counters.</p>
            </div>
          )}
        </aside>
      </div>
      {drawer && (
        <section className="zone-browser">
          <div className="screen-heading">
            <h3>
              {labels[drawer]} <span>{count(drawer)}</span>
            </h3>
            <button onClick={() => setDrawer(null)}>Close</button>
          </div>
          {drawer === "library" && (
            <div className="library-reveal-controls">
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
        <section className="solo-tools">
          <div>
            <h3>Turn preferences</h3>
            <label>
              <input
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
              aria-label="Token name"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              maxLength={80}
            />
            <input
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
        </section>
      )}
      <div className="solo-footer">
        <span role="status">{state.log[0]}</span>
        <small>Manual goldfish · You resolve costs, triggers and combat</small>
      </div>
      <details className="solo-history">
        <summary>Game history · {state.log.length} actions</summary>
        {state.log.map((message, i) => (
          <p key={i}>{message}</p>
        ))}
      </details>
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
                commit(startSolo(deck));
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
