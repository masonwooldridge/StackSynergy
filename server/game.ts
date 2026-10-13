import { randomInt, randomUUID } from "node:crypto";
import type { Card, Document } from "../shared/model.ts";
export type Zone =
  | "library"
  | "hand"
  | "battlefield"
  | "graveyard"
  | "exile"
  | "command"
  | "stack";
export interface Piece {
  id: string;
  card: Card;
  zone: Zone;
  tapped: boolean;
  counters: number;
  flipped: boolean;
  revealed: boolean;
}
export interface Player {
  id: string;
  name: string;
  ready: boolean;
  deckName: string;
  pieces: Piece[];
  life: number;
  tax: number;
  damage: Record<string, number>;
  lastSeen: number;
  mulligans: number;
}
export interface Room {
  code: string;
  host: string;
  public: boolean;
  format: string;
  started: boolean;
  players: Player[];
  revision: number;
  turn: number;
  log: string[];
  commands: string[];
  chat: { name: string; text: string }[];
}
export function shuffle<T>(a: T[]) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
export function loadDeck(d: Document): Piece[] {
  return shuffle(
    d.entries
      .filter((e) => e.board === "mainboard" || e.board === "commander")
      .flatMap((e) =>
        Array.from({ length: e.qty }, () => ({
          id: randomUUID(),
          card: e.card,
          zone: (e.board === "commander" ? "command" : "library") as Zone,
          tapped: false,
          counters: 0,
          flipped: false,
          revealed: false,
        })),
      ),
  );
}
export function viewRoom(r: Room, viewer: string) {
  return {
    ...r,
    commands: undefined,
    players: r.players.map((p) => ({
      ...p,
      online: Date.now() - p.lastSeen < 15000,
      pieces: p.pieces.filter(
        (c) =>
          c.zone !== "library" &&
          (c.zone !== "hand" || p.id === viewer || c.revealed),
      ),
      libraryCount: p.pieces.filter((c) => c.zone === "library").length,
      handCount: p.pieces.filter((c) => c.zone === "hand").length,
    })),
    me: viewer,
  };
}
export function act(
  r: Room,
  actor: string,
  input: {
    id: string;
    revision: number;
    action: string;
    piece?: string;
    zone?: Zone;
    value?: number;
    target?: string;
    text?: string;
  },
): Room {
  if (r.commands.includes(input.id)) return r;
  if (input.revision !== r.revision)
    throw Error("Stale game state. Refresh and try again.");
  const next = structuredClone(r);
  const p = next.players.find((p) => p.id === actor);
  if (!p) throw Error("Not a room member");
  const log = (text: string) => next.log.unshift(`${p.name}: ${text}`);
  if (input.action === "start") {
    if (actor !== next.host) throw Error("Only the host can start");
    if (next.players.length < 2 || !next.players.every((p) => p.ready))
      throw Error("At least two ready players required");
    next.started = true;
    log("started the game");
  } else if (input.action === "chat") {
    if (!input.text?.trim() || input.text.length > 500)
      throw Error("Message must be 1–500 characters");
    next.chat.push({ name: p.name, text: input.text });
    next.chat = next.chat.slice(-100);
  } else if (input.action === "kick") {
    if (actor !== next.host || next.started || input.target === actor)
      throw Error("Cannot remove this player");
    next.players = next.players.filter((p) => p.id !== input.target);
    log("removed a player");
  } else if (input.action === "ready") {
    if (next.started || !p.pieces.length)
      throw Error("Select a deck before readying");
    p.ready = !p.ready;
  } else {
    if (!next.started) throw Error("Game has not started");
    if (input.action === "draw") {
      const card = p.pieces.find((c) => c.zone === "library");
      if (!card) throw Error("Library is empty");
      card.zone = "hand";
      card.revealed = false;
      log("drew a card");
    } else if (input.action === "opening") {
      if (p.pieces.some((c) => c.zone === "hand"))
        throw Error("Hand already drawn");
      p.pieces
        .filter((c) => c.zone === "library")
        .slice(0, 7)
        .forEach((c) => (c.zone = "hand"));
      log("drew opening hand");
    } else if (input.action === "mulligan") {
      if (p.mulligans >= 7) throw Error("Mulligan limit reached");
      p.pieces.forEach((c) => {
        if (c.zone === "hand") {
          c.zone = "library";
          c.revealed = false;
        }
      });
      p.pieces = shuffle(p.pieces);
      p.pieces
        .filter((c) => c.zone === "library")
        .slice(0, 7)
        .forEach((c) => (c.zone = "hand"));
      p.mulligans++;
      log("took a London mulligan; manually bottom required cards");
    } else if (input.action === "shuffle") {
      const hidden = shuffle(p.pieces.filter((c) => c.zone === "library")).map(
        (c) => ({ ...c, id: randomUUID(), revealed: false }),
      );
      p.pieces = [...p.pieces.filter((c) => c.zone !== "library"), ...hidden];
      log("shuffled library");
    } else if (input.action === "turn") {
      if (next.players[next.turn % next.players.length].id !== actor)
        throw Error("Only the active player may pass the turn");
      next.turn++;
      log("passed the turn");
    } else if (input.action === "life" || input.action === "tax") {
      if (!Number.isInteger(input.value) || Math.abs(input.value!) > 999)
        throw Error("Invalid counter value");
      if (input.action === "life") p.life = input.value!;
      else p.tax = input.value!;
      log(`set ${input.action} to ${input.value}`);
    } else if (input.action === "damage") {
      if (
        !next.players.some((q) => q.id === input.target) ||
        !Number.isInteger(input.value) ||
        input.value! < 0 ||
        input.value! > 999
      )
        throw Error("Invalid commander damage");
      p.damage[input.target!] = input.value!;
      log("updated commander damage");
    } else if (input.action === "die") log(`rolled D6: ${randomInt(1, 7)}`);
    else if (input.action === "coin")
      log(randomInt(2) ? "flipped heads" : "flipped tails");
    else if (input.action === "token") {
      p.pieces.push({
        id: randomUUID(),
        card: { id: randomUUID(), name: input.text?.slice(0, 100) || "Token" },
        zone: "battlefield",
        tapped: false,
        counters: 0,
        flipped: false,
        revealed: true,
      });
      log("created a token");
    } else {
      const c = p.pieces.find((c) => c.id === input.piece);
      if (!c) throw Error("You may only act on your own cards");
      if (input.action === "move") {
        if (
          ![
            "library",
            "hand",
            "battlefield",
            "graveyard",
            "exile",
            "command",
            "stack",
          ].includes(input.zone || "")
        )
          throw Error("Invalid zone");
        const wasPrivate = c.zone === "hand" || c.zone === "library";
        const toPrivate = input.zone === "hand" || input.zone === "library";
        log(
          `moved ${wasPrivate && toPrivate ? "a private card" : c.card.name} to ${input.zone}`,
        );
        c.zone = input.zone!;
        c.revealed = !toPrivate;
        c.tapped = false;
        if (input.zone === "library") {
          p.pieces = p.pieces.filter((x) => x.id !== c.id);
          c.id = randomUUID();
          p.pieces.push(c);
        }
      } else if (input.action === "reveal") {
        if (c.zone === "library")
          throw Error("Draw the card before revealing it");
        c.revealed = true;
        log(`revealed ${c.card.name}`);
      } else if (input.action === "tap") {
        if (c.zone !== "battlefield")
          throw Error("Only battlefield cards can be tapped");
        c.tapped = !c.tapped;
        log(`toggled tap on ${c.card.name}`);
      } else if (input.action === "flip") {
        if (c.zone === "library" || (c.zone === "hand" && !c.revealed))
          throw Error("Reveal or play first");
        c.flipped = !c.flipped;
        log(`flipped ${c.card.name}`);
      } else if (input.action === "counter") {
        if (!Number.isInteger(input.value) || Math.abs(input.value!) > 999)
          throw Error("Invalid counters");
        c.counters = input.value!;
        log(`updated counters on ${c.card.name}`);
      } else throw Error("Unsupported action");
    }
  }
  next.revision++;
  next.commands.push(input.id);
  next.commands = next.commands.slice(-2000);
  next.log = next.log.slice(0, 300);
  return next;
}
