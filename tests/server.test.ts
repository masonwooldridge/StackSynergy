import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
const dir = mkdtempSync(join(tmpdir(), "cardchasm-test-"));
let server: Server;
let url: string;
const a = { cookie: "" },
  b = { cookie: "" };
async function request(
  client: { cookie: string },
  path: string,
  body?: unknown,
  method?: string,
) {
  const r = await fetch(url + path, {
    method: method || (body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json", Cookie: client.cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (r.headers.get("set-cookie"))
    client.cookie = r.headers.get("set-cookie")!.split(";")[0];
  return { status: r.status, data: await r.json() };
}
beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_PATH = join(dir, "app.sqlite");
  process.env.CARD_CACHE = join(dir, "cards.sqlite");
  const { app } = await import("../server/index");
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.on("listening", () => r()));
  const address = server.address() as { port: number };
  url = `http://127.0.0.1:${address.port}/api`;
  await request(a, "/auth/register", {
    email: "a@test.invalid",
    password: "test-only-password-123",
  });
  await request(b, "/auth/register", {
    email: "b@test.invalid",
    password: "test-only-password-123",
  });
});
afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  rmSync(dir, { recursive: true, force: true });
});
// Test-only fixtures in a temporary database; no demo records in user data.
const fixture = {
  id: crypto.randomUUID(),
  name: "Integration fixture",
  kind: "deck",
  format: "modern",
  notes: "",
  revision: 0,
  entries: [
    {
      id: crypto.randomUUID(),
      card: {
        id: crypto.randomUUID(),
        name: "Test fixture card",
        type_line: "Basic Land",
        legalities: { modern: "legal" },
      },
      qty: 60,
      board: "mainboard",
      language: "en",
      condition: "near_mint",
      finish: "nonfoil",
      purchasePrice: "",
      notes: "",
      tags: "",
    },
  ],
};
describe("HTTP persistence, isolation and independent clients", () => {
  it("requires authentication", async () =>
    expect((await request({ cookie: "" }, "/documents")).status).toBe(401));
  it("stores and reloads a document and detects conflicts", async () => {
    const created = await request(
      a,
      "/documents/" + fixture.id,
      fixture,
      "PUT",
    );
    expect(created.status).toBe(200);
    expect(created.data.revision).toBe(1);
    expect((await request(a, "/documents")).data[0].entries[0].qty).toBe(60);
    expect(
      (await request(a, "/documents/" + fixture.id, fixture, "PUT")).status,
    ).toBe(409);
  });
  it("prevents cross-account reads and overwrites", async () => {
    expect((await request(b, "/documents")).data).toEqual([]);
    expect(
      (await request(b, "/documents/" + fixture.id, fixture, "PUT")).status,
    ).toBe(409);
  });
  it("two actual accounts join, draw, synchronize and reconnect with hidden information", async () => {
    const mine = await request(a, "/me");
    const other = { ...fixture, id: crypto.randomUUID() };
    await request(b, "/documents/" + other.id, other, "PUT");
    let r = (
      await request(a, "/rooms", {
        name: "Player A",
        public: false,
        format: "modern",
      })
    ).data;
    const code = r.code;
    await request(b, `/rooms/${code}/join`, { name: "Player B" });
    await request(a, `/rooms/${code}/deck`, { deckId: fixture.id });
    await request(b, `/rooms/${code}/deck`, { deckId: other.id });
    r = (await request(a, `/rooms/${code}`)).data;
    await request(a, `/rooms/${code}/actions`, {
      id: crypto.randomUUID(),
      revision: r.revision,
      action: "ready",
    });
    r = (await request(b, `/rooms/${code}`)).data;
    await request(b, `/rooms/${code}/actions`, {
      id: crypto.randomUUID(),
      revision: r.revision,
      action: "ready",
    });
    r = (await request(a, `/rooms/${code}`)).data;
    r = (
      await request(a, `/rooms/${code}/actions`, {
        id: crypto.randomUUID(),
        revision: r.revision,
        action: "start",
      })
    ).data;
    const command = {
      id: crypto.randomUUID(),
      revision: r.revision,
      action: "opening",
    };
    r = (await request(a, `/rooms/${code}/actions`, command)).data;
    expect(
      r.players.find((p: { id: string }) => p.id === mine.data.user).pieces,
    ).toHaveLength(7);
    const opponent = (await request(b, `/rooms/${code}`)).data;
    expect(opponent.players[0].handCount).toBe(7);
    expect(opponent.players[0].pieces).toHaveLength(0);
    expect(JSON.stringify(opponent)).not.toContain(fixture.entries[0].card.id);
    expect(
      (await request(a, `/rooms/${code}/actions`, command)).data.revision,
    ).toBe(r.revision);
    const reconnected = { cookie: a.cookie };
    expect(
      (await request(reconnected, `/rooms/${code}`)).data.players[0].pieces,
    ).toHaveLength(7);
    expect(
      (
        await request(b, `/rooms/${code}/actions`, {
          id: crypto.randomUUID(),
          revision: r.revision,
          action: "move",
          piece: r.players[0].pieces[0].id,
          zone: "battlefield",
        })
      ).status,
    ).toBe(409);
  });
  it("rejects cross-origin writes", async () => {
    const r = await fetch(url + "/logout", {
      method: "POST",
      headers: { Origin: "https://attacker.invalid", Cookie: a.cookie },
    });
    expect(r.status).toBe(403);
  });
});

describe("atomic binder moves", () => {
  it("preserves metadata, rejects other accounts and stale revisions, and undoes both sides", async () => {
    const source = {
      ...fixture,
      id: crypto.randomUUID(),
      kind: "collection",
      entries: [
        {
          ...fixture.entries[0],
          id: crypto.randomUUID(),
          qty: 3,
          notes: "Preserve this lot",
          finish: "foil",
        },
      ],
    };
    const target = { ...source, id: crypto.randomUUID(), entries: [] };
    const savedSource = (
      await request(a, "/documents/" + source.id, source, "PUT")
    ).data;
    const savedTarget = (
      await request(a, "/documents/" + target.id, target, "PUT")
    ).data;
    const payload = {
      source: source.id,
      target: target.id,
      sourceRevision: savedSource.revision,
      targetRevision: savedTarget.revision,
      entries: [source.entries[0].id],
    };
    expect((await request(b, "/inventory/move", payload)).status).toBe(409);
    const moved = await request(a, "/inventory/move", payload);
    expect(moved.status).toBe(200);
    expect(moved.data.documents[0].entries).toEqual([]);
    expect(moved.data.documents[1].entries).toEqual(source.entries);
    expect((await request(a, "/inventory/move", payload)).status).toBe(409);
    expect(
      (await request(a, "/documents/" + source.id + "/history")).data,
    ).toEqual([]);
    expect(
      (await request(b, "/inventory/move/" + moved.data.id + "/undo", {}))
        .status,
    ).toBe(409);
    const undone = await request(
      a,
      "/inventory/move/" + moved.data.id + "/undo",
      {},
    );
    expect(undone.status).toBe(200);
    expect(undone.data.documents[0].entries).toEqual(source.entries);
    expect(undone.data.documents[1].entries).toEqual([]);
    expect(
      (await request(a, "/inventory/move/" + moved.data.id + "/undo", {}))
        .status,
    ).toBe(409);
  });
});
