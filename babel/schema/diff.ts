// What changed between two slides. Pure; used by the validator (budget), the merchant trace and the
// shopper-facing "What changed" card.
import type { BlockId, Slide, SlideBlock } from "./index";

// A block counts as changed if its variant or collapsed state changed, or it had to move.
// "Had to move" = not in the longest common subsequence of the two orders, so moving one
// block up counts as one change, not as every block it pushed down.
export function changedBlocks(before: SlideBlock[], after: SlideBlock[]): BlockId[] {
  const moved = movedBlocks(before, after);
  const prevById = new Map(before.map((x) => [x.id, x]));
  return after
    .filter((x) => {
      const p = prevById.get(x.id);
      return !p || p.variant !== x.variant || !!p.collapsed !== !!x.collapsed || moved.has(x.id);
    })
    .map((x) => x.id);
}

// Blocks that actually moved, as opposed to being pushed along by another block's move.
export function movedBlocks(before: SlideBlock[], after: SlideBlock[]): Set<BlockId> {
  const a = [...before].sort((x, y) => x.order - y.order).map((b) => b.id);
  const b = [...after].sort((x, y) => x.order - y.order).map((b) => b.id);
  const stayed = lcs(a, b);
  return new Set(b.filter((id) => a.includes(id) && !stayed.has(id)));
}

function lcs(a: BlockId[], b: BlockId[]): Set<BlockId> {
  const dp = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = new Set<BlockId>();
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j]) { out.add(a[i]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return out;
}

const human = (s: string | number | boolean) => String(s).replaceAll("_", " ");

// One line per change. Pass the store's block labels to get shopper-readable names.
export function describeDiff(prev: Slide, next: Slide, labels: Partial<Record<BlockId, string>> = {}): string[] {
  const out: string[] = [];
  const name = (id: BlockId) => labels[id] ?? id;
  const before = new Map(prev.blocks.map((b) => [b.id, b]));
  const moved = movedBlocks(prev.blocks, next.blocks); // blocks pushed aside don't count as moved
  for (const b of [...next.blocks].sort((x, y) => x.order - y.order)) {
    const p = before.get(b.id);
    if (!p) { out.push(`${name(b.id)}: added (${human(b.variant)})`); continue; }
    if (p.variant !== b.variant) out.push(`${name(b.id)}: "${human(p.variant)}" → "${human(b.variant)}"`);
    if (moved.has(b.id)) out.push(`${name(b.id)}: moved from position ${p.order} to ${b.order}`);
    if (!!p.collapsed !== !!b.collapsed) out.push(`${name(b.id)}: ${b.collapsed ? "collapsed" : "expanded"}`);
  }
  if (prev.persona.dialect !== next.persona.dialect) out.push(`view style: ${prev.persona.dialect} → ${next.persona.dialect}`);
  if (prev.persona.need !== next.persona.need) out.push(`focus: ${prev.persona.need} → ${next.persona.need}`);
  if (prev.copyRegister !== next.copyRegister) out.push(`wording: ${prev.copyRegister} → ${next.copyRegister}`);
  for (const k of Object.keys(next.theme) as (keyof Slide["theme"])[]) {
    if (prev.theme[k] !== next.theme[k]) out.push(`${k}: ${human(prev.theme[k])} → ${human(next.theme[k])}`);
  }
  return out;
}
