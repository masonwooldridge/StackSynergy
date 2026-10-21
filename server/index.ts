import {cardDataStamp} from "../shared/cardDataProvenance.ts";
import {CardDataError} from "./cardProvider.ts";
import { cardSearchPath } from "../shared/cardSearchRequest";
import {InitialTestBudget} from './aiBudget.ts';
import {resolve,dirname} from 'node:path';
import {installDeckAI,requestOpenAI} from './deckAI.ts';
import {evidenceFor,evidenceUrl,evidenceReviewedAt} from '../shared/commanderEvidence.ts';
import {commanderCandidateQueries,rankCommanderCards} from "../shared/commanderRelevance.ts";
import { documentSchema } from "../shared/documentSchema.ts";
import express from "express";
import cookieParser from "cookie-parser";
import Database from "better-sqlite3";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { mkdirSync } from "node:fs";
import { z } from "zod";
import type { Document } from "../shared/model.ts";
import { printingPages } from "../shared/printingPages.ts";
import { applyProposal, type Proposal } from "../shared/proposals.ts";
import { deckSearchTerms } from "../shared/discovery.ts";
import { focusMechanic, mechanicQueries, roleQueries, roles, mechanics, type Strategy } from "../shared/recommendations.ts";
import { newEntry } from "../shared/deckEditing.ts";
import { installInventory } from "./inventory.ts";
import { installRooms } from "./rooms.ts";
mkdirSync("data", { recursive: true });
const { scryfall } = await import("./cards.ts");
export const app = express();
const aiBudget=new InitialTestBudget(resolve(dirname(process.env.DATABASE_PATH||'data/cardchasm.sqlite'),'ai-initial-test-budget.sqlite'));
const db = new Database(process.env.DATABASE_PATH || "data/cardchasm.sqlite");
db.pragma("journal_mode = WAL");
db.exec(`CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY); INSERT OR IGNORE INTO migrations VALUES(1);
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,salt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,user TEXT NOT NULL,data TEXT NOT NULL,revision INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS history(id TEXT,user TEXT,data TEXT,at INTEGER);
CREATE TABLE IF NOT EXISTS rooms(code TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS proposals(id TEXT PRIMARY KEY,user TEXT NOT NULL,data TEXT NOT NULL,applied TEXT);
CREATE TABLE IF NOT EXISTS ai_usage(user TEXT,day TEXT,count INTEGER,PRIMARY KEY(user,day));`);
app.use(express.json({ limit: "3mb" }));
app.use(cookieParser());
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  if (
    !["GET", "HEAD"].includes(req.method) &&
    req.headers.origin &&
    req.headers.origin !== `${req.protocol}://${req.headers.host}` &&
    ![
      process.env.APP_ORIGIN ||
        (process.env.NODE_ENV !== "production" ? "http://127.0.0.1:5173" : ""),
      ...(process.env.APP_ORIGINS || "").split(",").map((origin) => origin.trim()),
    ].includes(req.headers.origin)
  ) {
    res.status(403).json({ error: "Origin rejected" });
    return;
  }
  next();
});
const limits = new Map<string, { n: number; until: number }>();
app.use("/api", (req, res, next) => {
  const key = req.ip || "local";
  let v = limits.get(key);
  if (!v || v.until < Date.now()) {
    v = { n: 0, until: Date.now() + 60000 };
    limits.set(key, v);
  }
  if (++v.n > 240) {
    res.status(429).json({ error: "Too many requests. Wait a minute." });
    return;
  }
  next();
});
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function user(req: express.Request) {
  const row = db
    .prepare("SELECT user FROM sessions WHERE token=? AND expires>?")
    .get(hash(req.cookies.session || ""), Date.now()) as
    { user: string } | undefined;
  return row?.user;
}
app.get("/api/me", (req, res) =>
  res.json({ user: user(req) || null, aiConfigured: !!process.env.AI_API_KEY&&process.env.AI_CHAT_ENABLED==='true' }),
);
const credentials = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(200),
});
app.post("/api/auth/:action", async (req, res) => {
  const key = "auth:" + (req.ip || "local");
  let attempts = limits.get(key);
  if (!attempts || attempts.until < Date.now()) {
    attempts = { n: 0, until: Date.now() + 15 * 60000 };
    limits.set(key, attempts);
  }
  if (++attempts.n > 20) {
    res
      .status(429)
      .json({ error: "Too many sign-in attempts. Wait 15 minutes." });
    return;
  }
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Use an email and a password of at least 12 characters.",
    });
    return;
  }
  const { email, password } = parsed.data;
  let account = db.prepare("SELECT * FROM users WHERE email=?").get(email) as
    { id: string; password: string; salt: string } | undefined;
  if (req.params.action === "register") {
    if (account) {
      res.status(409).json({ error: "Account already exists. Sign in with its original password; creating an account does not reset it." });
      return;
    }
    const salt = randomBytes(16).toString("hex");
    account = {
      id: randomUUID(),
      password: scryptSync(password, salt, 64).toString("hex"),
      salt,
    };
    db.prepare("INSERT INTO users VALUES(?,?,?,?)").run(
      account.id,
      email,
      account.password,
      salt,
    );
  } else if (
    req.params.action !== "login" ||
    !account ||
    !timingSafeEqual(
      Buffer.from(account.password, "hex"),
      scryptSync(password, account.salt, 64),
    )
  ) {
    res.status(401).json({ error: "Email or password did not match. Use the password set for this local StackSynergy account." });
    return;
  }
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
    hash(token),
    account.id,
    Date.now() + 7 * 86400000,
  );
  res.cookie("session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 86400000,
  });
  res.json({ user: account.id });
});
app.post("/api/logout", (req, res) => {
  db.prepare("DELETE FROM sessions WHERE token=?").run(
    hash(req.cookies.session || ""),
  );
  res.clearCookie("session");
  res.json({ ok: true });
});
function cardRequestSignal(req:express.Request,res:express.Response){const controller=new AbortController();req.on("aborted",()=>controller.abort());res.on("close",()=>{if(!res.writableEnded)controller.abort();});return controller.signal;}
function sendCardError(res:express.Response,error:unknown){if(res.destroyed)return;const e=error as Error;if(error instanceof CardDataError){if(error.retryAfter)res.setHeader("Retry-After",String(error.retryAfter));res.status(error.status).json({error:e.message,cardDataFailure:true,retryAfterSeconds:error.retryAfter});}else res.status(502).json({error:e.message});}
app.get("/api/catalog/creature-types",async (_req,res)=>{try{res.json(await scryfall("/catalog/creature-types"));}catch(e){sendCardError(res,e);}});
app.get("/api/sets", async (_req, res) => {
  try { res.json(await scryfall("/sets")); }
  catch(e) { sendCardError(res,e); }
});
app.get("/api/cards", async (req, res) => {
  const signal=cardRequestSignal(req,res);const stamps:import("../shared/cardDataProvenance.ts").CardDataStamp[]=[];const readCard=async(path:string)=>{const data=await scryfall(path,signal);const stamp=cardDataStamp(data);if(stamp)stamps.push(stamp);return data;};
  try {
    const q = String(req.query.q || "").trim();
    if (!q || q.length > 1000) throw Error("Enter a search query.");
    const mode = String(req.query.mode || "search");
    const page = Number(req.query.page || 1);
    if (!Number.isInteger(page) || page < 1 || page > 100)
      throw Error("Invalid result page.");
    let path = `/cards/search?q=${encodeURIComponent(q)}&unique=cards`;
    if (mode === "named") path = `/cards/named?exact=${encodeURIComponent(q)}`;
    if (mode === "prints")
      path = `/cards/search?q=${encodeURIComponent("oracleid:" + q)}&unique=prints`;
    if (mode === "autocomplete")
      path = `/cards/autocomplete?q=${encodeURIComponent(q)}`;
    if (mode === "id") path = "/cards/" + encodeURIComponent(q);
    if (mode === "search" || mode === "prints") path += `&page=${page}`;
    if (mode === "search") path = cardSearchPath({q,page,unique:req.query.unique===undefined?undefined:String(req.query.unique),order:req.query.order===undefined?undefined:String(req.query.order),dir:req.query.dir===undefined?undefined:String(req.query.dir),extras:String(req.query.extras||"0"),multilingual:String(req.query.multilingual||"0")});
    if (mode === "prints") {
      const base = path.replace(/&page=\d+$/, "");
      const data = await printingPages(
        async (n) =>
          (await readCard(
            `${base}&page=${n}`,
          )) as import("../shared/printingPages.ts").CardPage,
      );
      res.json({ data, has_more: false });
    } else res.json(await readCard(path));
  } catch (e) {
    if (String(req.query.mode || "search") === "search" && (e as Error).message === "Card provider returned 404") { res.json({data:[],has_more:false}); return; }
    sendCardError(res,e);
  }
});
app.get("/api/suggestions", async (req, res) => {
  const signal=cardRequestSignal(req,res);const stamps:import("../shared/cardDataProvenance.ts").CardDataStamp[]=[];const readCard=async(path:string)=>{const data=await scryfall(path,signal);const stamp=cardDataStamp(data);if(stamp)stamps.push(stamp);return data;};
  try {
    const ids = String(req.query.commanders || "").split(",");
    if (ids.length < 1 || ids.length > 2 || ids.some((id) => !z.string().uuid().safeParse(id).success)) {
      res.status(400).json({ error: "Choose one commander or a supported pair." });return;
    }
    const format = String(req.query.format || "commander");
    if (!["commander", "standard", "modern", "pioneer", "pauper", "legacy", "vintage"].includes(format)) {
      res.status(400).json({ error: "Unsupported format." });return;
    }
    const strategy = String(req.query.strategy || "auto") as Strategy;
    if (!["auto", "any", ...mechanics].includes(strategy)) { res.status(400).json({ error: "Unsupported strategy." });return; }
    const commanders = [];
    for (const id of ids) commanders.push(await readCard("/cards/" + id) as import("../shared/model.ts").Card);
    const deck: Document = { id: "scope", kind: "deck", name: "scope", format, notes: "", revision: 0, entries: commanders.map((card) => newEntry(card, "commander")) };
    const scope = deckSearchTerms(deck, "mainboard", req.query.rules !== "0").join(" ");
    const mechanic = focusMechanic(commanders, strategy), cards = new Map<string, import("../shared/model.ts").Card>(), unavailable: string[] = [];
    let failures = 0;
    for (const role of roles) {
      const query = role === "synergy" ? mechanic && mechanicQueries[mechanic] : roleQueries[role];
      if (!query) continue;
      try {
        const page = await readCard(`/cards/search?q=${encodeURIComponent(query + " " + scope+" game:paper -t:attraction -t:sticker -t:contraption")}&unique=cards&order=cmc&dir=asc&page=1`) as { data: import("../shared/model.ts").Card[] };
        if (!Array.isArray(page.data)) throw Error("Card facts unavailable.");
        for (const card of page.data.slice(0, 60)) cards.set(card.oracle_id || card.id, card);
        failures = 0;
      } catch (e) { if(e instanceof CardDataError && e.message!=="Card provider returned 404")throw e;unavailable.push(role);if (++failures >= 2 && !cards.size) break; }
    }
    for(const profile of commanderCandidateQueries(commanders)){try{const page=await readCard(`/cards/search?q=${encodeURIComponent(profile.query+' '+scope+' game:paper -t:attraction -t:sticker -t:contraption')}&unique=cards&order=cmc&dir=asc&page=1`) as {data:import('../shared/model.ts').Card[]};for(const card of page.data)if(profile.name!=='Reviewed commander recommendations'||evidenceFor(commanders)?.cards.includes(card.name))cards.set(card.oracle_id||card.id,card);}catch(e){if(e instanceof CardDataError && e.message!=="Card provider returned 404")throw e;unavailable.push(profile.name);}}
    if (!cards.size) { res.status(502).json({ error: "Card suggestions are unavailable. Try again later or use card search / pasted deck import." });return; }
    const ranked=rankCommanderCards([...cards.values()],commanders);res.json({cardData:stamps.length?{source:"Scryfall mixed cache/response",retrievedAt:stamps.map(s=>s.retrievedAt).sort()[0]}:undefined,cards:ranked.map(r=>r.card),rankings:ranked.map(r=>({id:r.card.id,score:r.score,reasons:r.reasons})),unavailable,source:"scryfall",rankingSource:evidenceFor(commanders)?"StackSynergy rules with dated, manually reviewed EDHREC examples; not live statistics":"StackSynergy rules; no reviewed EDHREC profile for this commander",commanderEvidence:evidenceFor(commanders)?{reviewedAt:evidenceReviewedAt,url:evidenceUrl(evidenceFor(commanders)!.slug),theme:evidenceFor(commanders)!.theme}:null});
  } catch (error) { sendCardError(res,error); }
});

installDeckAI(app,{
 budgetStatus:()=>aiBudget.status(),
 enabled:()=>process.env.AI_CHAT_ENABLED==='true',configured:()=>!!process.env.AI_API_KEY,model:()=>process.env.AI_CHAT_MODEL||'gpt-5-mini',account:user,
 documents:account=>db.prepare('SELECT data FROM documents WHERE user=?').all(account).map(row=>JSON.parse((row as {data:string}).data) as Document),
 card:scryfall,provider:(context,turns,signal)=>requestOpenAI(context,turns,signal,aiBudget),
 commit:(account,original,next)=>db.transaction(()=>{const row=db.prepare('SELECT data,revision FROM documents WHERE id=? AND user=?').get(original.id,account) as {data:string;revision:number}|undefined;if(!row||row.revision!==original.revision||JSON.stringify(JSON.parse(row.data))!==JSON.stringify(original))throw Error('Account deck changed. Request a fresh review.');const saved={...next,revision:original.revision+1};db.prepare('INSERT INTO history VALUES(?,?,?,?)').run(original.id,account,row.data,Date.now());db.prepare('UPDATE documents SET data=?,revision=? WHERE id=? AND user=?').run(JSON.stringify(saved),saved.revision,original.id,account);return saved;})(),
});
app.use("/api", (req, res, next) => {
  if (!user(req)) {
    res
      .status(401)
      .json({ error: "Sign in to use this server account feature. Guest deck saving does not require sign-in." });
    return;
  }
  next();
});
// A retry token is scoped to the authenticated account; copies never update existing decks.
db.exec("CREATE TABLE IF NOT EXISTS guest_copies(user TEXT,token TEXT,fingerprint TEXT,target TEXT,PRIMARY KEY(user,token))");
app.post("/api/documents/copy-guest", (req, res) => {
  const input = z.object({ token: z.string().uuid(), document: documentSchema }).safeParse(req.body);
  if (!input.success || input.data.document.deleted) { res.status(400).json({error:"Choose an active guest document."});return; }
  const owner = user(req)!, { token, document } = input.data;
  const fingerprint = hash(JSON.stringify(document));
  const result = db.transaction(() => {
    const receipt = db.prepare("SELECT fingerprint,target FROM guest_copies WHERE user=? AND token=?").get(owner,token) as {fingerprint:string;target:string}|undefined;
    if (receipt) {
      if (receipt.fingerprint !== fingerprint) return null;
      return { id:receipt.target, alreadyCopied:true };
    }
    const copy = {...document,id:randomUUID(),revision:1,name:document.name,entries:document.entries.map(entry=>({...entry,id:randomUUID()}))};
    db.prepare("INSERT INTO documents VALUES(?,?,?,?)").run(copy.id,owner,JSON.stringify(copy),copy.revision);
    db.prepare("INSERT INTO guest_copies VALUES(?,?,?,?)").run(owner,token,fingerprint,copy.id);
    return {id:copy.id,alreadyCopied:false};
  })();
  if (!result) { res.status(409).json({error:"This copy request changed. Start a new copy from the guest library."});return; }
  res.json(result);
});
app.get("/api/documents", (req, res) => {
  res.json(
    db
      .prepare("SELECT data FROM documents WHERE user=?")
      .all(user(req))
      .map((r) => JSON.parse((r as { data: string }).data)),
  );
});
app.put("/api/documents/:id", (req, res) => {
  const p = documentSchema.safeParse(req.body);
  if (!p.success || p.data.id !== req.params.id) {
    res.status(400).json({ error: "Invalid document." });
    return;
  }
  const d = p.data;
  const result = db.transaction(() => {
    const row = db
      .prepare("SELECT data,revision FROM documents WHERE id=? AND user=?")
      .get(d.id, user(req)) as { data: string; revision: number } | undefined;
    if (row && row.revision !== d.revision) return false;
    // Never allow an ID owned by another account to be overwritten.
    if (!row && db.prepare("SELECT id FROM documents WHERE id=?").get(d.id))
      return false;
    if (row)
      db.prepare("INSERT INTO history VALUES(?,?,?,?)").run(
        d.id,
        user(req),
        row.data,
        Date.now(),
      );
    d.revision++;
    db.prepare(
      "INSERT INTO documents VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=excluded.revision",
    ).run(d.id, user(req), JSON.stringify(d), d.revision);
    return true;
  })();
  if (!result) {
    res.status(409).json({
      error: "This document changed on another device. Refresh before editing.",
    });
    return;
  }
  res.json(d);
});
app.get("/api/documents/:id/history", (req, res) => {
  const barrier = db
    .prepare(
      "SELECT MAX(at) AS at FROM inventory_moves WHERE user=? AND (source=? OR target=?)",
    )
    .get(user(req), req.params.id, req.params.id) as { at: number | null };
  const rows = db
    .prepare(
      "SELECT data,at FROM history WHERE id=? AND user=? AND at>? ORDER BY at DESC LIMIT 30",
    )
    .all(req.params.id, user(req), barrier.at || 0);
  res.json(
    rows.map((row) => {
      const r = row as { data: string; at: number };
      return { document: JSON.parse(r.data), at: r.at };
    }),
  );
});
app.get("/api/backup", (req, res) =>
  res.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    documents: db
      .prepare("SELECT data FROM documents WHERE user=?")
      .all(user(req))
      .map((r) => JSON.parse((r as { data: string }).data)),
  }),
);
// Retire new requests on the older model path; existing reviewed proposals retain their validated apply route.
app.post("/api/assistant", (_req,res)=>{res.status(410).json({error:"Previous model analysis is retired. Use AI deck assistant for grounded conversation and reviewed swaps."});});
app.post("/api/assistant/:id/apply", (req, res) => {
  try {
    const selection = z
      .object({ changes: z.array(z.string().uuid()).min(1).max(30) })
      .parse(req.body);
    const result = db.transaction(() => {
      const stored = db
        .prepare("SELECT data,applied FROM proposals WHERE id=? AND user=?")
        .get(req.params.id, user(req)) as
        { data: string; applied: string | null } | undefined;
      if (!stored) throw Error("Proposal not found.");
      if (stored.applied)
        throw Error("Proposal already applied. Refresh the deck.");
      const proposal = JSON.parse(stored.data) as Proposal;
      const row = db
        .prepare("SELECT data FROM documents WHERE id=? AND user=?")
        .get(proposal.deckId, user(req)) as { data: string } | undefined;
      if (!row) throw Error("Deck not found.");
      const documents = db
        .prepare("SELECT data FROM documents WHERE user=?")
        .all(user(req))
        .map((r) => JSON.parse((r as { data: string }).data) as Document);
      const preview = applyProposal(
        proposal,
        user(req)!,
        JSON.parse(row.data),
        selection.changes,
        documents,
      );
      if(preview.validation.errors.length)throw Error(preview.validation.errors.join(" "));
      const previousDeck=JSON.parse(row.data) as Document;const playable=(d:Document)=>d.entries.filter(e=>e.board==="mainboard"||e.board==="commander").reduce((n,e)=>n+e.qty,0);if(previousDeck.format==="commander"&&playable(preview.document)!==playable(previousDeck))throw Error("AI upgrades must preserve the playable card count.");
      preview.document.revision++;
      db.prepare("INSERT INTO history VALUES(?,?,?,?)").run(
        proposal.deckId,
        user(req),
        row.data,
        Date.now(),
      );
      db.prepare(
        "UPDATE documents SET data=?,revision=? WHERE id=? AND user=?",
      ).run(
        JSON.stringify(preview.document),
        preview.document.revision,
        proposal.deckId,
        user(req),
      );
      db.prepare("UPDATE proposals SET applied=? WHERE id=?").run(
        JSON.stringify(selection.changes),
        proposal.id,
      );
      return preview;
    })();
    res.json(result);
  } catch (e) {
    res.status(409).json({ error: (e as Error).message });
  }
});
installInventory(app, db, user);
installRooms(app, db, user);
app.use(express.static("dist"));
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    void _next;
    res.status(500).json({ error: err.message });
  },
);
if (process.env.NODE_ENV !== "test")
  app.listen(
    Number(process.env.PORT) || 3001,
    process.env.HOST || "127.0.0.1",
    () => console.log("StackSynergy server: http://127.0.0.1:3001"),
  );
