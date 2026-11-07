// View validation (GUARDRAILS §1 layers 5-9): schema → registry → brand clamp → change budget → policy.
// Pure. Every view that reaches a shopper passed this, whoever built it (rules, Director, Concierge).
import { View, type BlockId, type BrandKit, type Dialect, type Registry, type Theme, type ViewBlock } from "@/babel/schema";
import { checkText } from "./policy";

export const MAX_NEXT_CHANGES = 3; // blocks a later page may change beyond the dialect's own restyle

export type Budget = {
  reference?: View;           // the last view of this page type in this visit (continuity)
  dialectChangeAllowed: boolean;
  carryOver?: ViewBlock[];    // return visit: blocks that must look and sit exactly as last visit
};

export type Checked =
  | { ok: true; view: View; clamps: string[]; fixes: string[] }
  | { ok: false; errors: string[]; clamps: string[] };

/** Blocks that differ between two views. A reorder counts only the blocks that actually moved (outside the
 *  longest common order), so pulling one block up is one change, not a cascade. */
export function changedBlocks(a: ViewBlock[], b: ViewBlock[]): BlockId[] {
  const byId = (l: ViewBlock[]) => new Map(l.map((x) => [x.id, x]));
  const A = byId(a), B = byId(b);
  const changed = new Set<BlockId>();
  for (const id of new Set([...A.keys(), ...B.keys()])) {
    const x = A.get(id), y = B.get(id);
    if (!x || !y || x.variant !== y.variant || !!x.collapsed !== !!y.collapsed) changed.add(id);
  }
  const seqA = [...a].sort((p, q) => p.order - q.order).map((x) => x.id).filter((id) => B.has(id));
  const seqB = [...b].sort((p, q) => p.order - q.order).map((x) => x.id).filter((id) => A.has(id));
  const keep = lcs(seqA, seqB);
  for (const id of seqB) if (!keep.has(id)) changed.add(id);
  return [...changed];
}

function lcs(a: BlockId[], b: BlockId[]): Set<BlockId> {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = new Set<BlockId>();
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i] === b[j]) { out.add(a[i]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  return out;
}

export function clampTheme(theme: Theme, brand: BrandKit, clamps: string[]) {
  const { typeScale, radius, density, contrast } = brand.ranges;
  const num = (key: "typeScale" | "radius", [lo, hi]: [number, number]) => {
    const v = theme[key], c = Math.min(hi, Math.max(lo, v));
    if (c !== v) { clamps.push(`${key} ${v} → ${c} (brand range ${lo}-${hi})`); theme[key] = c; }
  };
  num("typeScale", typeScale);
  num("radius", radius);
  if (!density.includes(theme.density)) {
    const c = density.includes("comfortable") ? "comfortable" : density[0];
    clamps.push(`density ${theme.density} → ${c} (not allowed by the brand)`);
    theme.density = c;
  }
  if (!contrast.includes(theme.contrast)) {
    clamps.push(`contrast ${theme.contrast} → ${contrast[0]} (not allowed by the brand)`);
    theme.contrast = contrast[0];
  }
}

export function validateView(raw: unknown, registry: Registry, brand: BrandKit, budget: Budget): Checked {
  const parsed = View.safeParse(raw);
  if (!parsed.success) return { ok: false, clamps: [], errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const view = structuredClone(parsed.data);
  const errors: string[] = [], clamps: string[] = [], fixes: string[] = [];

  // Registry: only declared blocks and variants; required blocks are always visible and open.
  const declared = registry[view.template];
  if (!declared) return { ok: false, clamps, errors: [`page type "${view.template}" is not in this store's registry`] };
  const seen = new Set<BlockId>();
  for (const b of view.blocks) {
    const spec = declared[b.id];
    if (!spec) { errors.push(`block "${b.id}" is not declared for ${view.template}`); continue; }
    if (seen.has(b.id)) errors.push(`block "${b.id}" appears twice`);
    seen.add(b.id);
    if (!spec.variants.includes(b.variant)) errors.push(`block "${b.id}" has no variant "${b.variant}" (allowed: ${spec.variants.join(", ")})`);
    if (spec.required && b.collapsed) { b.collapsed = false; fixes.push(`${b.id} is required: kept open`); }
  }
  let next = Math.max(0, ...view.blocks.map((b) => b.order)) + 1;
  for (const [id, spec] of Object.entries(declared) as [BlockId, NonNullable<(typeof declared)[BlockId]>][]) {
    if (!seen.has(id)) { view.blocks.push({ id, variant: spec.neutral, order: next++ }); fixes.push(`${id} was missing: added in its neutral variant`); }
  }
  view.blocks = [...view.blocks].sort((a, b) => a.order - b.order).map((b, i) => ({ ...b, order: i + 1 }));

  // Brand clamp: never rejected, always pulled back inside the brand's ranges and logged.
  clampTheme(view.theme, brand, clamps);

  // Change budget.
  if (!errors.length) errors.push(...checkBudget(view, registry, budget));

  // Policy: the rationale is shopper-facing text.
  errors.push(...checkText(view.rationale, "rationale", brand).map((e) => `rationale: ${e}`));

  return errors.length ? { ok: false, errors, clamps } : { ok: true, view, clamps, fixes };
}

function checkBudget(view: View, registry: Registry, { reference: ref, dialectChangeAllowed, carryOver }: Budget): string[] {
  const errors: string[] = [];
  if (view.kind === "return" && carryOver) {
    for (const k of carryOver) {
      const b = view.blocks.find((x) => x.id === k.id);
      if (!b || b.variant !== k.variant || b.order !== k.order) errors.push(`"${k.id}" is carried over from last visit and must stay ${k.variant} at position ${k.order}`);
    }
  }
  if (view.kind !== "next" || !ref || ref.template !== view.template) return errors;

  const dialectChanged = ref.persona.dialect !== view.persona.dialect;
  if (dialectChanged && !dialectChangeAllowed) errors.push("the look (dialect) already changed once this visit; it stays for the rest of the visit");
  const restyled = (id: BlockId, variant: string, d: Dialect) => {
    const spec = registry[view.template]?.[id];
    return !!spec && variant === (spec.byDialect?.[d] ?? spec.neutral);
  };
  const changed = changedBlocks(ref.blocks, view.blocks).filter((id) => {
    if (!dialectChanged) return true;
    const a = ref.blocks.find((b) => b.id === id), b = view.blocks.find((x) => x.id === id);
    // A block that only follows the new dialect's own variant is part of the restyle, not an extra change.
    return !(a && b && a.order === b.order && !!a.collapsed === !!b.collapsed && restyled(id, b.variant, view.persona.dialect));
  });
  if (changed.length > MAX_NEXT_CHANGES) errors.push(`a later page may change at most ${MAX_NEXT_CHANGES} blocks; this changes ${changed.length} (${changed.join(", ")})`);
  for (const id of ref.keep) if (changed.includes(id)) errors.push(`"${id}" is carried over and may not change`);
  if (!dialectChanged) {
    const a = ref.theme, b = view.theme;
    if (Math.abs(a.typeScale - b.typeScale) > 0.1 + 1e-9) errors.push("text size may move one step (0.1) per page");
    if (a.density !== b.density || a.radius !== b.radius) errors.push("spacing and corners change only with the look (dialect)");
    if (a.contrast !== b.contrast || a.motion !== b.motion) errors.push("contrast and motion follow the shopper's settings and do not change between pages");
  }
  return errors;
}
