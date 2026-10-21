import { expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import type { ClientRequest, IncomingMessage, ServerResponse } from "node:http";
import Database from "better-sqlite3";
import { forwardProxyCancellation } from "../server/proxyCancellation";
import { createCardCache } from "../server/cardCache";
import { createCardProvider, retrySeconds } from "../server/cardProvider";
it("forwards a premature close, preserves normal completion, and removes its listener on upstream close", () => {
  for (const ended of [false, true]) {
    const up = Object.assign(new EventEmitter(), { destroy: vi.fn() }),
      down = Object.assign(new EventEmitter(), { writableEnded: ended });
    forwardProxyCancellation(
      up as unknown as ClientRequest,
      {} as IncomingMessage,
      down as unknown as ServerResponse,
    );
    expect(down.listenerCount("close")).toBe(1);
    down.emit("close");
    expect(up.destroy).toHaveBeenCalledTimes(ended ? 0 : 1);
    up.emit("close");
    expect(down.listenerCount("close")).toBe(0);
  }
  const up = Object.assign(new EventEmitter(), { destroy: vi.fn() }),
    down = Object.assign(new EventEmitter(), { writableEnded: false });
  forwardProxyCancellation(
    up as unknown as ClientRequest,
    {} as IncomingMessage,
    down as unknown as ServerResponse,
  );
  up.emit("close");
  down.emit("close");
  expect(up.destroy).not.toHaveBeenCalled();
});
it("expires and bounds public cache rows/bytes without touching a separate user table", () => {
  const db = new Database(":memory:");
  try {
    db.exec(
      'CREATE TABLE documents (id TEXT);INSERT INTO documents VALUES ("kept")'.replace(
        '"kept"',
        "'kept'",
      ),
    );
    const cache = createCardCache(db, { rows: 2, bytes: 12 }),
      future = Date.now() + 10000;
    cache.write("old", "abc", Date.now() - 1);
    cache.write("a", "abcd", future);
    cache.write("b", "abcd", future + 1);
    cache.write("c", "abcd", future + 2);
    expect(cache.read("old")).toBeUndefined();
    expect(cache.read("a")).toBeUndefined();
    expect(cache.read("b")).toBeDefined();
    cache.write("oversized", "x".repeat(13), future + 3);
    expect(cache.read("oversized")).toBeUndefined();
    expect(db.prepare("SELECT id FROM documents").get()).toEqual({
      id: "kept",
    });
    const byteCache = createCardCache(db, { rows: 10, bytes: 5 });
    byteCache.write("d", "abcd", future + 4);
    expect(
      (
        db
          .prepare("SELECT SUM(length(CAST(data AS BLOB))) AS bytes FROM cache")
          .get() as { bytes: number }
      ).bytes,
    ).toBeLessThanOrEqual(5);
  } finally {
    db.close();
  }
});
it("caps distinct pending lookups, keeps an identical subscriber shared, and releases capacity after rejection", async () => {
  let clock = 0;
  let reject!: (e: Error) => void;
  const fetcher = vi.fn(
    () => new Promise<Response>((_resolve, r) => (reject = r)),
  );
  const get = createCardProvider({
    read: () => undefined,
    write: () => {},
    fetch: fetcher as typeof fetch,
    spacing: 0,
    maxPending: 1,
    now: () => clock,
  });
  const a = get("/cards/a"),
    b = get("/cards/a");
  const failA = expect(a).rejects.toThrow("connection failed"),
    failB = expect(b).rejects.toThrow("connection failed");
  await expect(get("/cards/b")).rejects.toThrow("queue is busy");
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  reject(new Error("fixture offline"));
  await Promise.all([failA, failB]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  clock = 3000;
  fetcher.mockImplementation(async () =>
    Response.json({
      id: "fixture",
      name: "Recovered",
      type_line: "Artifact",
      color_identity: [],
      legalities: { commander: "legal" },
    }),
  );
  await expect(get("/cards/b")).resolves.toMatchObject({ name: "Recovered" });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(retrySeconds("999999999999999999999999", Date.now(), 30)).toBe(86400);
});
