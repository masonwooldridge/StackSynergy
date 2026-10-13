import type express from "express";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Document } from "../shared/model.ts";
export function installInventory(
  app: express.Express,
  db: Database.Database,
  user: (req: express.Request) => string | undefined,
) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS inventory_moves (id TEXT PRIMARY KEY,user TEXT NOT NULL,source TEXT NOT NULL,target TEXT NOT NULL,before_source TEXT NOT NULL,before_target TEXT NOT NULL,source_revision INTEGER NOT NULL,target_revision INTEGER NOT NULL,at INTEGER NOT NULL,undone INTEGER NOT NULL DEFAULT 0)",
  );
  const read = (id: string, owner: string) => {
    const row = db
      .prepare("SELECT data FROM documents WHERE id=? AND user=?")
      .get(id, owner) as { data: string } | undefined;
    if (!row) throw Error("Binder or list not found.");
    return JSON.parse(row.data) as Document;
  };
  const write = (doc: Document, owner: string) =>
    db
      .prepare("UPDATE documents SET data=?,revision=? WHERE id=? AND user=?")
      .run(JSON.stringify(doc), doc.revision, doc.id, owner);
  app.post("/api/inventory/move", (req, res) => {
    try {
      const p = z
        .object({
          source: z.string().uuid(),
          target: z.string().uuid(),
          sourceRevision: z.number().int(),
          targetRevision: z.number().int(),
          entries: z.array(z.string().uuid()).min(1).max(1000),
        })
        .parse(req.body);
      const owner = user(req)!;
      const result = db.transaction(() => {
        const source = read(p.source, owner),
          target = read(p.target, owner);
        if (
          source.id === target.id ||
          source.kind === "deck" ||
          source.kind !== target.kind ||
          source.deleted ||
          target.deleted
        )
          throw Error(
            "Move owned cards between owned binders, or tracking cards between lists.",
          );
        if (
          source.revision !== p.sourceRevision ||
          target.revision !== p.targetRevision
        )
          throw Error("A binder changed. Refresh before moving cards.");
        const ids = new Set(p.entries);
        const entries = source.entries.filter((e) => ids.has(e.id));
        if (entries.length !== ids.size)
          throw Error("Selected rows no longer exist.");
        if (target.entries.length + entries.length > 20000)
          throw Error("Destination is full.");
        const sourceBefore = JSON.stringify(source),
          targetBefore = JSON.stringify(target);
        source.entries = source.entries.filter((e) => !ids.has(e.id));
        const targetIds = new Set(target.entries.map((e) => e.id));
        target.entries.push(
          ...entries.map((e) =>
            targetIds.has(e.id) ? { ...e, id: randomUUID() } : e,
          ),
        );
        source.revision++;
        target.revision++;
        write(source, owner);
        write(target, owner);
        const id = randomUUID();
        db.prepare(
          "INSERT INTO inventory_moves VALUES(?,?,?,?,?,?,?,?,?,0)",
        ).run(
          id,
          owner,
          source.id,
          target.id,
          sourceBefore,
          targetBefore,
          source.revision,
          target.revision,
          Date.now(),
        );
        return { id, documents: [source, target] };
      })();
      res.json(result);
    } catch (e) {
      res.status(409).json({ error: (e as Error).message });
    }
  });
  app.post("/api/inventory/move/:id/undo", (req, res) => {
    try {
      const owner = user(req)!;
      const documents = db.transaction(() => {
        const move = db
          .prepare("SELECT * FROM inventory_moves WHERE id=? AND user=?")
          .get(req.params.id, owner) as
          | {
              source: string;
              target: string;
              before_source: string;
              before_target: string;
              source_revision: number;
              target_revision: number;
              undone: number;
            }
          | undefined;
        if (!move || move.undone)
          throw Error("Move is unavailable or already undone.");
        const source = read(move.source, owner),
          target = read(move.target, owner);
        if (
          source.revision !== move.source_revision ||
          target.revision !== move.target_revision
        )
          throw Error(
            "A binder changed after this move. Move these rows back manually.",
          );
        const a = JSON.parse(move.before_source) as Document,
          b = JSON.parse(move.before_target) as Document;
        a.revision = source.revision + 1;
        b.revision = target.revision + 1;
        write(a, owner);
        write(b, owner);
        db.prepare(
          "UPDATE inventory_moves SET undone=1,at=? WHERE id=? AND user=?",
        ).run(Date.now(), req.params.id, owner);
        return [a, b];
      })();
      res.json({ documents });
    } catch (e) {
      res.status(409).json({ error: (e as Error).message });
    }
  });
}
