// Store defaults the Insights agent learned from many shoppers: a few block changes that every new visit to a
// page type now starts with. Kept in the database (collection "defaults") so a restart does not undo them.
import { loadAll, put } from "./db";
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
  pending?: boolean;  // suggested by the AI, waiting for the merchant; only becomes active when approved
};

// An entry without a changes list would crash every page open, so drop it.
const read = () => loadAll<StoreDefault>("defaults").map(([, d]) => d).filter((d) => d && Array.isArray(d.changes) && typeof d.store === "string");
const g = globalThis as unknown as { __babelDefaults?: StoreDefault[] };
const all: StoreDefault[] = (g.__babelDefaults ??= read());

const save = () => put("defaults", all.map((d) => [d.id, d]));

export const listDefaults = () => [...all].sort((a, b) => b.at - a.at);
export const activeDefaults = (store: string, template: Template) => all.filter((d) => d.active && d.store === store && d.template === template);

export function addDefault(d: Omit<StoreDefault, "id" | "at" | "active" | "pending">, pending = false): StoreDefault {
  const made = { ...d, id: crypto.randomUUID().slice(0, 8), at: Date.now(), active: !pending, ...(pending ? { pending } : {}) };
  all.push(made);
  save();
  return made;
}

// Revert takes back an active default; on a pending suggestion it dismisses it.
export function revertDefault(id: string): boolean {
  const d = all.find((x) => x.id === id && (x.active || x.pending));
  if (d) { d.active = false; d.pending = false; save(); }
  return !!d;
}

export function approveDefault(id: string): boolean {
  const d = all.find((x) => x.id === id && x.pending);
  if (d) { d.active = true; d.pending = false; save(); }
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
