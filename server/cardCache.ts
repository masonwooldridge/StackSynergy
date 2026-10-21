import type Database from "better-sqlite3";
/** Public provider facts only. Eviction changes cache reuse, never user documents. */
export function createCardCache(
  db: Database.Database,
  limits = { rows: 2048, bytes: 64 * 1024 * 1024 },
) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY,data TEXT NOT NULL,expires INTEGER NOT NULL);CREATE INDEX IF NOT EXISTS cache_expiry ON cache(expires)",
  );
  const remove = db.prepare("DELETE FROM cache WHERE key=?");
  function prune() {
    db.prepare("DELETE FROM cache WHERE expires<=?").run(Date.now());
    const rows = db
      .prepare(
        "SELECT key,length(CAST(data AS BLOB)) AS bytes FROM cache ORDER BY expires,key",
      )
      .all() as { key: string; bytes: number }[];
    let count = rows.length,
      bytes = rows.reduce((n, r) => n + r.bytes, 0);
    for (const row of rows) {
      if (count <= limits.rows && bytes <= limits.bytes) break;
      remove.run(row.key);
      count--;
      bytes -= row.bytes;
    }
  }
  db.transaction(prune)();
  const read = (path: string) =>
    db.prepare("SELECT data,expires FROM cache WHERE key=?").get(path) as
      { data: string; expires: number } | undefined;
  const write = db.transaction(
    (path: string, data: string, expires: number) => {
      if (Buffer.byteLength(data) <= limits.bytes)
        db.prepare("INSERT OR REPLACE INTO cache VALUES(?,?,?)").run(
          path,
          data,
          expires,
        );
      prune();
    },
  );
  return { read, write };
}
