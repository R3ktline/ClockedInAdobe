// Babel's database: one SQLite file (.babel/babel.db) through Node's built-in node:sqlite, no extra dependency.
// One table of JSON documents, keyed by collection and id. Each module keeps its in-memory copy for speed and
// writes through to here, so a server restart loses nothing. BABEL_DB_FILE overrides; vitest uses ":memory:".
// shortcut: one file, one process; move to Postgres when Babel runs on more than one server.
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Collection = "memory" | "visits" | "defaults" | "gaps" | "llm_usage";

const file = () => process.env.BABEL_DB_FILE ?? (process.env.VITEST ? ":memory:" : path.join(process.cwd(), ".babel", "babel.db"));

const g = globalThis as unknown as { __babelDb?: DatabaseSync | null };

// null = could not open: the store keeps working from memory only (rule 11), it just forgets on restart.
function db(): DatabaseSync | null {
  if (g.__babelDb === undefined) {
    try {
      const f = file();
      if (f !== ":memory:") mkdirSync(path.dirname(f), { recursive: true });
      const d = new DatabaseSync(f);
      d.exec(`PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS docs (
          collection TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, updated_at INTEGER NOT NULL,
          PRIMARY KEY (collection, id)
        );`);
      g.__babelDb = d;
      if (f !== ":memory:") importLegacy(path.dirname(f));
    } catch (e) {
      console.warn(`babel db: running without persistence (${e instanceof Error ? e.message : e})`);
      g.__babelDb = null;
    }
  }
  return g.__babelDb;
}

// One-time move from the JSON files Babel used before the database, into any collection that is still empty.
// The files stay on disk untouched; delete them once the database has them.
function importLegacy(dir: string) {
  const files: [Collection, string, (x: unknown) => [string, unknown][]][] = [
    ["memory", "memory.json", (x) => Object.entries(x as Record<string, unknown>)],
    ["defaults", "defaults.json", (x) => (x as { id: string }[]).map((d) => [d.id, d])],
    ["gaps", "gaps.json", (x) => (x as { id: string }[]).map((d) => [d.id, d])],
  ];
  for (const [c, name, rows] of files) {
    if (loadAll(c).length) continue;
    try { put(c, rows(JSON.parse(readFileSync(path.join(dir, name), "utf8")))); } catch { /* no file, or unreadable: nothing to move */ }
  }
}

/** Every document in a collection, oldest write first. */
export function loadAll<T>(c: Collection): [id: string, value: T][] {
  const rows = db()?.prepare("SELECT id, json FROM docs WHERE collection = ? ORDER BY updated_at, rowid").all(c) as { id: string; json: string }[] | undefined;
  return (rows ?? []).flatMap((r) => { try { return [[r.id, JSON.parse(r.json) as T]]; } catch { return []; } });
}

/** Insert or replace documents, in one transaction. */
export function put(c: Collection, rows: [id: string, value: unknown][]) {
  const d = db();
  if (!d || !rows.length) return;
  const stmt = d.prepare(`INSERT INTO docs (collection, id, json, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (collection, id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`);
  const now = Date.now();
  d.exec("BEGIN");
  try {
    for (const [id, v] of rows) stmt.run(c, id, JSON.stringify(v), now);
    d.exec("COMMIT");
  } catch (e) {
    d.exec("ROLLBACK");
    console.warn(`babel db: write to ${c} failed (${e instanceof Error ? e.message : e})`);
  }
}

export function remove(c: Collection, id: string) {
  db()?.prepare("DELETE FROM docs WHERE collection = ? AND id = ?").run(c, id);
}
