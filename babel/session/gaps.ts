// Variants the Director wished the store had (SlideProposal.gaps / hold.gaps). Same wish seen again bumps `count`.
// Kept in .babel/gaps.json (BABEL_GAPS_FILE overrides; off under vitest). A human turns a gap into a real variant.
// shortcut: one JSON file, one process, no locking; same as defaults.ts.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Gap, Template } from "@/babel/schema";

export type StoredGap = Gap & { id: string; store: string; template: Template; count: number; at: number; mocked: boolean; draft?: string };

const file = () => process.env.BABEL_GAPS_FILE ?? (process.env.VITEST ? "" : path.join(process.cwd(), ".babel", "gaps.json"));

function read(): StoredGap[] {
  try { return JSON.parse(readFileSync(file(), "utf8")) as StoredGap[]; } catch { return []; }
}
const g = globalThis as unknown as { __babelGaps?: StoredGap[] };
const all: StoredGap[] = (g.__babelGaps ??= read());

function save() {
  const f = file();
  if (!f) return;
  try { mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(all)); } catch { /* best effort */ }
}

export const listGaps = () => [...all].sort((a, b) => b.at - a.at);
export const getGap = (id: string) => all.find((x) => x.id === id);

export function recordGaps(store: string, template: Template, gaps: Gap[], mocked: boolean) {
  for (const gap of gaps) {
    const same = all.find((x) => x.store === store && x.template === template && x.block === gap.block && x.wanted.toLowerCase() === gap.wanted.toLowerCase());
    if (same) { same.count++; same.at = Date.now(); continue; }
    all.push({ ...gap, id: crypto.randomUUID().slice(0, 8), store, template, count: 1, at: Date.now(), mocked });
  }
  if (gaps.length) save();
}

export function markDrafted(id: string, draft: string) {
  const x = getGap(id);
  if (x) { x.draft = draft; save(); }
}
