// Simulator shoppers (demo/testing): a setup made on /sim is registered here and replayed like a ghost
// (?ghost=<id>), so every store page, the lab panel and /api/visit see it exactly like a fixture shopper.
// shortcut: in-memory, one process, oldest dropped after 50; fine for a demo, lost on restart.
import type { Shopper } from "@/data/shoppers";

const g = globalThis as unknown as { __babelSim?: Map<string, Shopper> };
export const simShoppers: Map<string, Shopper> = (g.__babelSim ??= new Map());

export function registerSim(path: string, partner: Shopper["partner"], events: Shopper["events"]): Shopper {
  const id = `sim${Math.random().toString(36).slice(2, 8)}`; // lowercase: the ghost label is lower-cased back into the id
  const s: Shopper = {
    id, label: "Simulated shopper (set up on /sim)", startPath: path, partner, events, pages: [],
    revisit: { startPath: path, events, pages: [] },
  };
  simShoppers.set(id, s);
  if (simShoppers.size > 50) simShoppers.delete(simShoppers.keys().next().value!);
  return s;
}
