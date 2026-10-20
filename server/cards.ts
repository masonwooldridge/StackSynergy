import Database from "better-sqlite3";
const cache = new Database(process.env.CARD_CACHE || "data/cards.sqlite");
cache.exec(
  "CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, data TEXT NOT NULL, expires INTEGER NOT NULL)",
);
let chain = Promise.resolve();
let next = 0;
export async function scryfall(path: string): Promise<unknown> {
  if (!/^\/(?:cards\/|catalog\/|sets(?:$|\/))/.test(path))
    throw Error("Unsupported card endpoint");
  const hit = cache
    .prepare("SELECT data FROM cache WHERE key=? AND expires>?")
    .get(path, Date.now()) as { data: string } | undefined;
  if (hit) return JSON.parse(hit.data);
  const task = chain.then(async () => {
    await new Promise((r) => setTimeout(r, Math.max(0, next - Date.now())));
    next = Date.now() + 150;
    const res = await fetch("https://api.scryfall.com" + path, {
      headers: {
        "User-Agent": "StackSynergy/0.1 (local MTG companion)",
        Accept: "application/json;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok)
      throw Error(
        res.status === 429
          ? "Card provider rate limit; please wait."
          : `Card provider returned ${res.status}`,
      );
    const data = await res.json();
    cache
      .prepare("INSERT OR REPLACE INTO cache VALUES(?,?,?)")
      .run(path, JSON.stringify(data), Date.now() + 86400000);
    return data;
  });
  chain = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}
