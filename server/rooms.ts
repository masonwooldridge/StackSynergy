import type express from "express";
import type Database from "better-sqlite3";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Document } from "../shared/model.ts";
import { authoritativeDeck } from "./deckValidation.ts";
import { scryfall } from "./cards.ts";
import { act, loadDeck, viewRoom } from "./game.ts";
import type { Room } from "./game.ts";
export function installRooms(
  app: express.Express,
  db: Database.Database,
  user: (req: express.Request) => string | undefined,
) {
  const read = (code: string) => {
    const row = db.prepare("SELECT data FROM rooms WHERE code=?").get(code) as
      { data: string } | undefined;
    if (!row) throw Error("Room not found");
    return JSON.parse(row.data) as Room;
  };
  const save = (r: Room) =>
    db
      .prepare(
        "INSERT INTO rooms VALUES(?,?) ON CONFLICT(code) DO UPDATE SET data=excluded.data",
      )
      .run(r.code, JSON.stringify(r));
  app.get("/api/rooms", (_req, res) =>
    res.json(
      db
        .prepare("SELECT data FROM rooms")
        .all()
        .map((x) => JSON.parse((x as { data: string }).data) as Room)
        .filter(
          (r) =>
            r.public &&
            !r.started &&
            r.players.some((p) => Date.now() - p.lastSeen < 15 * 60000) &&
            r.players.length < (r.format === "commander" ? 4 : 2),
        )
        .map((r) => ({
          code: r.code,
          format: r.format,
          players: r.players.length,
        })),
    ),
  );
  app.post("/api/rooms", (req, res) => {
    try {
      const p = z
        .object({
          name: z.string().min(1).max(40),
          public: z.boolean(),
          format: z.enum([
            "commander",
            "standard",
            "modern",
            "pioneer",
            "pauper",
            "legacy",
            "vintage",
          ]),
        })
        .parse(req.body);
      const id = user(req)!;
      const r: Room = {
        code: randomBytes(5).toString("hex").toUpperCase(),
        host: id,
        public: p.public,
        format: p.format,
        started: false,
        players: [
          {
            id,
            name: p.name,
            ready: false,
            deckName: "",
            pieces: [],
            life: p.format === "commander" ? 40 : 20,
            tax: 0,
            damage: {},
            lastSeen: Date.now(),
            mulligans: 0,
          },
        ],
        revision: 0,
        turn: 0,
        log: [],
        chat: [],
        commands: [],
      };
      save(r);
      res.json(viewRoom(r, id));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  app.post("/api/rooms/:code/join", (req, res) => {
    try {
      const r = read(String(req.params.code));
      const id = user(req)!;
      if (!r.players.some((p) => p.id === id)) {
        if (r.started || r.players.length >= (r.format === "commander" ? 4 : 2))
          throw Error("Room is full or already started");
        const name = z.string().min(1).max(40).parse(req.body.name);
        r.players.push({
          id,
          name,
          ready: false,
          deckName: "",
          pieces: [],
          life: r.format === "commander" ? 40 : 20,
          tax: 0,
          damage: {},
          lastSeen: Date.now(),
          mulligans: 0,
        });
        r.revision++;
        save(r);
      }
      res.json(viewRoom(r, id));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  app.get("/api/rooms/:code", (req, res) => {
    try {
      const r = read(String(req.params.code));
      const p = r.players.find((p) => p.id === user(req));
      if (!p) {
        res.status(403).json({ error: "Not a room member" });
        return;
      }
      p.lastSeen = Date.now();
      save(r);
      res.json(viewRoom(r, p.id));
    } catch (e) {
      res.status(404).json({ error: (e as Error).message });
    }
  });
  app.post("/api/rooms/:code/deck", async (req, res) => {
    try {
      const r = read(String(req.params.code));
      const p = r.players.find((p) => p.id === user(req));
      if (!p || r.started) throw Error("Deck cannot be changed now");
      const row = db
        .prepare("SELECT data FROM documents WHERE id=? AND user=?")
        .get(req.body.deckId, user(req)) as { data: string } | undefined;
      if (!row) throw Error("Deck not found");
      const deck = JSON.parse(row.data) as Document;
      if (deck.kind !== "deck" || deck.deleted || deck.format !== r.format)
        throw Error("Choose a deck matching the room format");
      if (deck.entries.reduce((n, e) => n + e.qty, 0) > 1000)
        throw Error("Deck too large");
      const casual = req.body.casual === true;
      const checked = casual
        ? {
            document: deck,
            validation: {
              status: "casual" as const,
              checkedAt: new Date().toISOString(),
              errors: [],
              warnings: ["Unverified deck loaded for agreed casual play."],
            },
          }
        : await authoritativeDeck(
            deck,
            async (id) =>
              (await scryfall(
                "/cards/" + encodeURIComponent(id),
              )) as import("../shared/model.ts").Card,
          );
      const updated = db.transaction(() => {
        const latest = read(String(req.params.code));
        if (latest.revision !== r.revision || latest.started)
          throw Error("Room changed during validation. Load your deck again.");
        const member = latest.players.find((q) => q.id === p.id)!;
        member.pieces = loadDeck(checked.document);
        member.deckName = deck.name;
        member.deckValidation = checked.validation;
        member.ready = false;
        member.acceptsCasual = casual;
        latest.revision++;
        save(latest);
        return latest;
      })();
      res.json(viewRoom(updated, p.id));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  app.post("/api/rooms/:code/leave", (req, res) => {
    try {
      db.transaction(() => {
        const r = read(String(req.params.code));
        const index = r.players.findIndex((p) => p.id === user(req));
        if (index < 0) throw Error("Not a room member");
        const active = r.players[r.turn % r.players.length]?.id;
        r.players.splice(index, 1);
        if (!r.players.length) {
          db.prepare("DELETE FROM rooms WHERE code=?").run(r.code);
          return;
        }
        if (r.host === user(req)) r.host = r.players[0].id;
        const activeIndex = r.players.findIndex((p) => p.id === active);
        r.turn = activeIndex < 0 ? index % r.players.length : activeIndex;
        r.finished = r.started && r.players.length < 2;
        r.revision++;
        r.log.unshift("A player left the table.");
        save(r);
      })();
      res.json({ left: true });
    } catch (e) {
      res.status(409).json({ error: (e as Error).message });
    }
  });
  app.post("/api/rooms/:code/actions", (req, res) => {
    try {
      const input = z
        .object({
          id: z.string().uuid(),
          revision: z.number().int().min(0),
          action: z.string().max(30),
          piece: z.string().uuid().optional(),
          zone: z
            .enum([
              "library",
              "hand",
              "battlefield",
              "graveyard",
              "exile",
              "command",
              "stack",
            ])
            .optional(),
          value: z.number().optional(),
          target: z.string().optional(),
          text: z.string().max(500).optional(),
        })
        .parse(req.body);
      const id = user(req)!;
      const r = db.transaction(() => {
        const n = act(read(String(req.params.code)), id, input);
        save(n);
        return n;
      })();
      res.json(viewRoom(r, id));
    } catch (e) {
      res.status(409).json({ error: (e as Error).message });
    }
  });
}
