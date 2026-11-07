// Store defaults the Insights agent learned from many shoppers: a few block changes that every new visit to a
// page type now starts with. Kept in .babel/defaults.json so a restart does not undo them
// (BABEL_DEFAULTS_FILE overrides; off under vitest).
// shortcut: one JSON file, one process, no locking; swap for a database when there is more than one server.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { moveBlock } from "@/babel/persona";
import type { BlockId, Slide, Template } from "@/babel/schema";

// Each part is set only when the Director actually changed it (a pure move has no variant).
export type DefaultChange = { id: BlockId; variant?: string; order?: number; collapsed?: boolean };

export type StoreDefault = {
  id: string;
  store: string;
  template: Template;
  changes: DefaultChange[];
  rationale: string;
  evidence: string[]; // plain-language counts behind it
  simulated: boolean; // every session behind it was a synthetic ghost shopper
  mocked: boolean;    // written by the mock LLM
  at: number;
  active: boolean;
};

const file = () => process.env.BABEL_DEFAULTS_FILE ?? (process.env.VITEST ? "" : path.join(process.cwd(), ".babel", "defaults.json"));

function read(): StoreDefault[] {
  try { return JSON.parse(readFileSync(file(), "utf8")) as StoreDefault[]; } catch { return []; } // no file yet, or unreadable
}
const g = globalThis as unknown as { __babelDefaults?: StoreDefault[] };
const all: StoreDefault[] = (g.__babelDefaults ??= read());

function save() {
  const f = file();
  if (!f) return;
  try { mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(all)); } catch { /* best effort */ }
}

export const listDefaults = () => [...all].sort((a, b) => b.at - a.at);
export const activeDefaults = (store: string, template: Template) => all.filter((d) => d.active && d.store === store && d.template === template);

export function addDefault(d: Omit<StoreDefault, "id" | "at" | "active">): StoreDefault {
  const made = { ...d, id: crypto.randomUUID().slice(0, 8), at: Date.now(), active: true };
  all.push(made);
  save();
  return made;
}

export function revertDefault(id: string): boolean {
  const d = all.find((x) => x.id === id && x.active);
  if (d) { d.active = false; save(); }
  return !!d;
}

// Lay the changes over a slide. Blocks the page does not have are skipped; the caller validates the result.
export function withDefaults(slide: Slide, defaults: StoreDefault[]): Slide {
  let blocks = structuredClone(slide.blocks);
  const changes = defaults.flatMap((d) => d.changes); // oldest first, so a newer default wins
  for (const c of changes) {
    const b = blocks.find((x) => x.id === c.id);
    if (!b) continue;
    if (c.variant) b.variant = c.variant;
    if (c.collapsed !== undefined) b.collapsed = c.collapsed;
  }
  for (const c of changes) if (c.order && blocks.some((x) => x.id === c.id)) blocks = moveBlock(blocks, c.id, c.order);
  return { ...slide, blocks };
}
