import { useEffect, useState } from "react";
import type { Document } from "../shared/model";
import { image } from "../shared/model";
import type { Room, Player, Piece, Zone } from "../server/game";
import { api } from "./api";
type View = Omit<Room, "players"> & {
  me: string;
  players: (Player & {
    online: boolean;
    libraryCount: number;
    handCount: number;
  })[];
};
export default function Multiplayer({ decks }: { decks: Document[] }) {
  const [room, setRoom] = useState<View | null>(null);
  const [code, setCode] = useState(
    () => localStorage.getItem("cardchasm-room") || "",
  );
  const [name, setName] = useState("Planeswalker");
  const [format, setFormat] = useState("commander");
  const [isPublic, setPublic] = useState(false);
  const [rooms, setRooms] = useState<
    { code: string; format: string; players: number }[]
  >([]);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState("");
  const [selected, setSelected] = useState<Piece | null>(null);
  const [deckId, setDeckId] = useState("");
  async function run(fn: () => Promise<void>) {
    try {
      await fn();
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function join(c = code) {
    await run(async () => {
      const r = await api<View>(`/rooms/${c.trim().toUpperCase()}/join`, {
        name,
      });
      setRoom(r);
      localStorage.setItem("cardchasm-room", r.code);
    });
  }
  const roomCode = room?.code;
  useEffect(() => {
    if (!roomCode) return;
    const id = setInterval(() => {
      api<View>("/rooms/" + roomCode)
        .then(setRoom)
        .catch((e) => setMessage("Disconnected: " + e.message + ". Retrying…"));
    }, 2000);
    return () => clearInterval(id);
  }, [roomCode]);
  async function action(action: string, extra: Record<string, unknown> = {}) {
    if (!room) return;
    await run(async () => {
      setRoom(
        await api<View>(`/rooms/${room.code}/actions`, {
          id: crypto.randomUUID(),
          revision: room.revision,
          action,
          ...extra,
        }),
      );
      setSelected(null);
    });
  }
  const me = room?.players.find((p) => p.id === room.me);
  return (
    <section>
      <div className="section-heading">
        <div>
          <div className="eyebrow">REAL ACCOUNTS · SHARED TABLE</div>
          <h1>A place at the table.</h1>
        </div>
      </div>
      <p>
        Manual rules tabletop. Server-synchronized every two seconds; draws and
        shuffles are resolved on the server. Hands remain private until
        explicitly revealed. No multiplayer undo.
      </p>
      {message && (
        <div className="notice" role="alert">
          {message}
        </div>
      )}
      {!room ? (
        <>
          <div className="panel">
            <label>
              Display name
              <input
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div className="toolbar">
              <select
                aria-label="Room format"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                {[
                  "commander",
                  "standard",
                  "modern",
                  "pioneer",
                  "pauper",
                  "legacy",
                  "vintage",
                ].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setPublic(e.target.checked)}
                />
                Public lobby
              </label>
              <button
                className="primary"
                onClick={() =>
                  run(async () => {
                    const r = await api<View>("/rooms", {
                      name,
                      format,
                      public: isPublic,
                    });
                    setRoom(r);
                    localStorage.setItem("cardchasm-room", r.code);
                  })
                }
              >
                Host game
              </button>
            </div>
            <div className="toolbar">
              <input
                aria-label="Room code"
                placeholder="Room code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button onClick={() => join()}>Join / reconnect</button>
              <button
                onClick={() => run(async () => setRooms(await api("/rooms")))}
              >
                Find public games
              </button>
            </div>
            {rooms.map((r) => (
              <div className="toolbar" key={r.code}>
                <p>
                  {r.code} · {r.format} · {r.players} players
                </p>
                <button onClick={() => join(r.code)}>Join</button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="panel">
            <div className="toolbar">
              <h2>Room {room.code}</h2>
              <span>
                {room.format} · revision {room.revision}
              </span>
              <button
                onClick={() => {
                  setRoom(null);
                  setSelected(null);
                }}
              >
                Back to lobbies
              </button>
            </div>
            <p>
              Invite another account with this room code. Current turn:{" "}
              {room.players[room.turn % room.players.length]?.name}.
            </p>
            {!room.started && (
              <div className="toolbar">
                <select
                  aria-label="Multiplayer deck"
                  value={deckId}
                  onChange={(e) => setDeckId(e.target.value)}
                >
                  <option value="">Select deck</option>
                  {decks
                    .filter((d) => d.format === room.format)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
                <button
                  disabled={!deckId}
                  onClick={() =>
                    run(async () =>
                      setRoom(
                        await api(`/rooms/${room.code}/deck`, { deckId }),
                      ),
                    )
                  }
                >
                  Load deck
                </button>
                <button
                  disabled={!me?.deckName}
                  onClick={() => action("ready")}
                >
                  {me?.ready ? "Unready" : "Ready"}
                </button>
                {room.host === room.me && (
                  <button className="primary" onClick={() => action("start")}>
                    Start game
                  </button>
                )}
              </div>
            )}
            <div className="feature-grid">
              {room.players.map((p) => (
                <div key={p.id}>
                  <h3>
                    {p.name} {p.id === room.me ? "(you)" : ""}
                  </h3>
                  <p>
                    {p.online ? "Connected" : "Disconnected"} ·{" "}
                    {p.ready ? "Ready" : "Preparing"}
                    <br />
                    {p.deckName || "No deck"}
                    <br />
                    Life: {p.life} · Hand: {p.handCount} · Library:{" "}
                    {p.libraryCount}
                    <br />
                    Tax: {p.tax} · Mulligans: {p.mulligans}
                  </p>
                  {p.id === room.me && room.started && (
                    <div className="toolbar">
                      <button
                        onClick={() => action("life", { value: p.life - 1 })}
                      >
                        − life
                      </button>
                      <button
                        onClick={() => action("life", { value: p.life + 1 })}
                      >
                        + life
                      </button>
                      <button
                        onClick={() => action("tax", { value: p.tax + 2 })}
                      >
                        + tax
                      </button>
                    </div>
                  )}
                  {room.host === room.me &&
                    p.id !== room.me &&
                    !room.started && (
                      <button onClick={() => action("kick", { target: p.id })}>
                        Remove player
                      </button>
                    )}
                </div>
              ))}
            </div>
          </div>
          {room.started && (
            <>
              <div className="panel toolbar">
                <button onClick={() => action("opening")}>Opening seven</button>
                <button onClick={() => action("draw")}>Draw</button>
                <button onClick={() => action("mulligan")}>
                  London mulligan
                </button>
                <button onClick={() => action("shuffle")}>Shuffle</button>
                <button onClick={() => action("turn")}>Pass turn</button>
                <button onClick={() => action("die")}>D6</button>
                <button onClick={() => action("coin")}>Coin</button>
                <button onClick={() => action("token", { text: "Token" })}>
                  Token
                </button>
              </div>
              {selected && (
                <div className="panel toolbar">
                  <strong>{selected.card.name}</strong>
                  <select
                    aria-label="Online move zone"
                    defaultValue={selected.zone}
                    onChange={(e) =>
                      action("move", {
                        piece: selected.id,
                        zone: e.target.value,
                      })
                    }
                  >
                    {(
                      [
                        "library",
                        "hand",
                        "battlefield",
                        "graveyard",
                        "exile",
                        "command",
                        "stack",
                      ] as Zone[]
                    ).map((z) => (
                      <option key={z}>{z}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => action("reveal", { piece: selected.id })}
                  >
                    Reveal
                  </button>
                  <button onClick={() => action("tap", { piece: selected.id })}>
                    Tap / untap
                  </button>
                  <button
                    onClick={() => action("flip", { piece: selected.id })}
                  >
                    Flip
                  </button>
                  <button
                    onClick={() =>
                      action("counter", {
                        piece: selected.id,
                        value: selected.counters + 1,
                      })
                    }
                  >
                    + counter ({selected.counters})
                  </button>
                </div>
              )}
              {room.players.map((p) => (
                <div className="panel" key={p.id}>
                  <h2>{p.name}’s table</h2>
                  <div className="tabletop">
                    {(
                      [
                        "hand",
                        "battlefield",
                        "graveyard",
                        "exile",
                        "command",
                        "stack",
                      ] as Zone[]
                    ).map((z) => (
                      <section className="zone" key={z}>
                        <h3>
                          {z} {z === "hand" ? p.handCount : ""}
                        </h3>
                        <div className="mini-cards">
                          {p.pieces
                            .filter((c) => c.zone === z)
                            .map((c) => (
                              <button
                                key={c.id}
                                disabled={p.id !== room.me}
                                className={c.tapped ? "tapped" : ""}
                                onClick={() => setSelected(c)}
                              >
                                {image(c.card, c.flipped ? 1 : 0) ? (
                                  <img
                                    alt={c.card.name}
                                    src={image(c.card, c.flipped ? 1 : 0)}
                                  />
                                ) : (
                                  c.card.name
                                )}
                                {c.counters > 0 && <b>+{c.counters}</b>}
                              </button>
                            ))}
                          {z === "hand" && p.id !== room.me && (
                            <span>{p.handCount} private cards</span>
                          )}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
          <div className="panel">
            <h3>Table chat</h3>
            {room.chat.map((c, i) => (
              <p key={i}>
                <strong>{c.name}:</strong> {c.text}
              </p>
            ))}
            <form
              className="toolbar"
              onSubmit={(e) => {
                e.preventDefault();
                void action("chat", { text: chat });
                setChat("");
              }}
            >
              <input
                aria-label="Chat message"
                maxLength={500}
                value={chat}
                onChange={(e) => setChat(e.target.value)}
              />
              <button>Send</button>
            </form>
            <details>
              <summary>Shared game log</summary>
              {room.log.map((l, i) => (
                <p key={i}>{l}</p>
              ))}
            </details>
          </div>
        </>
      )}
    </section>
  );
}
