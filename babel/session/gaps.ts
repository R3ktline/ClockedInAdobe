// "The agent wanted a variant the registry does not have." Kept for a human to build (rule 1: never rendered).
import type { Gap } from "@/babel/schema";

type Entry = Gap & { store: string; at: string; mocked: boolean; count: number };
const g = globalThis as unknown as { __babelGaps?: Entry[] };
const gaps = (g.__babelGaps ??= []);

export function recordGaps(store: string, list: Gap[], mocked: boolean) {
  for (const x of list) {
    const same = gaps.find((e) => e.store === store && e.block === x.block && e.wanted === x.wanted);
    if (same) { same.count++; same.at = new Date().toISOString(); }
    else gaps.push({ ...x, store, mocked, at: new Date().toISOString(), count: 1 });
  }
}
export const listGaps = () => [...gaps].sort((a, b) => b.count - a.count);
