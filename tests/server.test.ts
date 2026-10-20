import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
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
  process.env.APP_ORIGINS = "http://127.0.0.1:5173,http://localhost:5173";
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
  it("normalizes account email and never replaces a password through duplicate registration", async () => {
    const correct = "test-only-password-123";
    const login = await request(a, "/auth/login", { email: " A@TEST.INVALID ", password: correct });
    expect(login.status).toBe(200);
    const failed = await request(a, "/auth/login", { email: "a@test.invalid", password: "wrong-test-only-password" });
    expect(failed.status).toBe(401);
    const duplicate = await request(a, "/auth/register", { email: " A@TEST.INVALID ", password: "wrong-test-only-password" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.data.error).toContain("does not reset");
    expect((await request(a, "/auth/login", { email: "a@test.invalid", password: correct })).status).toBe(200);
  });
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
    await request(a, `/rooms/${code}/deck`, {
      deckId: fixture.id,
      casual: true,
    });
    await request(b, `/rooms/${code}/deck`, { deckId: other.id, casual: true });
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
  it("accepts both explicitly configured local development origins", async () => {
    for (const origin of ["http://127.0.0.1:5173", "http://localhost:5173"]) {
      const response = await fetch(url + "/auth/login", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: "{}",
      });
      expect(response.status).toBe(400);
    }
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

describe("durable atomic proposal application", () => {
  it("rejects another account and invalid legacy count-changing proposals", async () => {
    const { default: Database } = await import("better-sqlite3");
    const db = new Database(join(dir, "app.sqlite"));
    try {
      const account = (await request(a, "/me")).data.user;
      const deck = (await request(a, "/documents")).data.find(
        (d: { id: string }) => d.id === fixture.id,
      );
      const proposal = {
        id: crypto.randomUUID(),
        accountId: account,
        deckId: deck.id,
        revision: deck.revision,
        budget: 0,
        ownedOnly: false,
        analysis: "Fixture",
        changes: [
          {
            id: crypto.randomUUID(),
            entry: deck.entries[0],
            before: 60,
            after: 59,
            reason: "Fixture",
          },
        ],
        rejected: [],
        evidence: "Test only",
        retrievedAt: "fixture",
      };
      db.prepare("INSERT INTO proposals VALUES(?,?,?,NULL)").run(
        proposal.id,
        account,
        JSON.stringify(proposal),
      );
      const body = { changes: [proposal.changes[0].id] };
      expect(
        (await request(b, `/assistant/${proposal.id}/apply`, body)).status,
      ).toBe(409);
      const results = await Promise.all([
        request(a, `/assistant/${proposal.id}/apply`, body),
        request(a, `/assistant/${proposal.id}/apply`, body),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([409, 409]);
      const saved = (await request(a, "/documents")).data.find(
        (d: { id: string }) => d.id === deck.id,
      );
      expect(saved.entries[0].qty).toBe(60);
      expect(saved.revision).toBe(deck.revision);
      const stale = { ...proposal, id: crypto.randomUUID() };
      db.prepare("INSERT INTO proposals VALUES(?,?,?,NULL)").run(
        stale.id,
        account,
        JSON.stringify(stale),
      );
      expect(
        (await request(a, `/assistant/${stale.id}/apply`, body)).status,
      ).toBe(409);
    } finally {
      db.close();
    }
  });
});

describe("intentional room leaving", () => {
  it("transfers host and removes the last empty lobby", async () => {
    const hosted = (
      await request(a, "/rooms", {
        name: "Fixture A",
        public: false,
        format: "modern",
      })
    ).data;
    await request(b, `/rooms/${hosted.code}/join`, { name: "Fixture B" });
    expect((await request(a, `/rooms/${hosted.code}/leave`, {})).status).toBe(
      200,
    );
    const remaining = (await request(b, `/rooms/${hosted.code}`)).data;
    expect(remaining.players).toHaveLength(1);
    expect(remaining.host).toBe(remaining.me);
    expect((await request(a, `/rooms/${hosted.code}`)).status).toBe(403);
    expect((await request(b, `/rooms/${hosted.code}/leave`, {})).status).toBe(
      200,
    );
    expect((await request(b, `/rooms/${hosted.code}`)).status).toBe(404);
  });
});

it('copies guests without overwriting account documents and atomically deduplicates interrupted retries',async()=>{
 const token=crypto.randomUUID(),document={...fixture,id:crypto.randomUUID(),name:'Same name is allowed',revision:0};
 await request(a,'/documents/'+document.id,{...document,notes:'Existing account original'},'PUT');
 const before=await request(a,'/documents');
 const first=await request(a,'/documents/copy-guest',{token,document});expect(first.status).toBe(200);expect(first.data.id).not.toBe(document.id);
 const retry=await request(a,'/documents/copy-guest',{token,document});expect(retry.data).toEqual({id:first.data.id,alreadyCopied:true});
 const after=await request(a,'/documents');expect(after.data).toHaveLength(before.data.length+1);for(const old of before.data)expect(after.data).toContainEqual(old);
 const saved=after.data.find((d:typeof fixture)=>d.id===first.data.id);expect(saved.entries[0].id).not.toBe(document.entries[0].id);
 expect((await request(a,'/documents/copy-guest',{token,document:{...document,name:'Changed'}})).status).toBe(409);
 const separate=await request(b,'/documents/copy-guest',{token,document});expect(separate.status).toBe(200);expect(separate.data.id).not.toBe(first.data.id);
 const bdocs=(await request(b,'/documents')).data;expect(bdocs.some((d:typeof fixture)=>d.id===first.data.id)).toBe(false);
 expect((await request({cookie:''},'/documents/copy-guest',{token,document})).status).toBe(401);
});


it("search forwards filters/options, exposes Sets and keeps named/ID misses as errors", async () => {
  const realFetch = globalThis.fetch, paths:string[]=[];
  const spy=vi.spyOn(globalThis,"fetch").mockImplementation(async (input, init) => {
    const target=String(input);
    if(!target.startsWith("https://api.scryfall.com")) return realFetch(input,init);
    paths.push(target); const u=new URL(target);
    if(u.pathname === "/sets")return new Response(JSON.stringify({data:[{id:"set-fixture",code:"mkm",name:"Murders at Karlov Manor",card_count:451,set_type:"expansion"}]}),{headers:{"content-type":"application/json"}});
    if(u.searchParams.get("q")?.includes("no-search-hit") || u.pathname.includes("named") || u.pathname.includes("missing-card-id"))return new Response(JSON.stringify({object:"error",code:"not_found"}),{status:404});
    return new Response(JSON.stringify({data:[],has_more:false}),{headers:{"content-type":"application/json"}});
  });
  try {
    const q="lang:ja set:mkm ui-"+crypto.randomUUID(); const result=await request(a,"/cards?"+new URLSearchParams({q,unique:"prints",order:"released",dir:"desc",extras:"1",multilingual:"1"}));expect(result.status).toBe(200);const forwarded=new URL(paths[0]);expect(forwarded.searchParams.get("q")).toBe(q);expect(forwarded.searchParams.get("unique")).toBe("prints");expect(forwarded.searchParams.get("include_extras")).toBe("true");expect(forwarded.searchParams.get("include_multilingual")).toBe("true");
    const empty=await request(a,"/cards?q=no-search-hit-"+crypto.randomUUID());expect(empty.status).toBe(200);expect(empty.data).toEqual({data:[],has_more:false});
    expect((await request(a,"/cards?mode=named&q=missing-"+crypto.randomUUID())).status).toBe(502);
    expect((await request(a,"/cards?mode=id&q=missing-card-id-"+crypto.randomUUID())).status).toBe(502);
    const sets=await request(a,"/sets");expect(sets.status).toBe(200);expect(sets.data.data[0].code).toBe("mkm");
    const before=paths.length;expect((await request(a,"/cards?q=x&order=invalid")).status).toBe(502);expect(paths).toHaveLength(before);
  } finally {spy.mockRestore();}
});
