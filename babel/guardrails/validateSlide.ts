// Slide validation (GUARDRAILS §1, layers 5-8): schema → registry → brand clamp → change budget.
// The policy layer (banned words, persona labels) arrives in Phase 2.
import { Slide, type BlockId, type BrandKit, type Registry, type SlideBlock, type Theme } from "@/babel/schema";

export type ValidateInput = {
  slide: unknown;
  prev?: Slide;          // the slide currently shown, if any
  registry: Registry;
  brand: BrandKit;
  returning: boolean;    // is this a return visit?
};

export type ValidateResult =
  | { ok: true; slide: Slide; clamps: string[]; fixes: string[] }
  | { ok: false; errors: string[]; clamps: string[] };

const DENSITY = ["airy", "comfortable", "compact"] as const;
const MAX_MINOR_CHANGES = 2;

export function validateSlide({ slide: raw, prev, registry, brand, returning }: ValidateInput): ValidateResult {
  const parsed = Slide.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, clamps: [], errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  const slide = structuredClone(parsed.data);
  const errors: string[] = [];
  const clamps: string[] = [];
  const fixes: string[] = [];

  // Registry: only declared blocks and variants.
  const declared = registry[slide.template];
  if (!declared) return { ok: false, clamps, errors: [`template "${slide.template}" is not in this store's registry`] };
  const seen = new Set<BlockId>();
  for (const b of slide.blocks) {
    const spec = declared[b.id];
    if (!spec) { errors.push(`block "${b.id}" is not declared for ${slide.template}`); continue; }
    if (seen.has(b.id)) errors.push(`block "${b.id}" appears twice`);
    seen.add(b.id);
    if (spec.required && b.variant === "hidden") {
      b.variant = spec.neutral;
      b.collapsed = true;
      fixes.push(`${b.id} is required: collapsed instead of hidden`);
    }
    if (!spec.variants.includes(b.variant)) {
      errors.push(`block "${b.id}" has no variant "${b.variant}" (allowed: ${spec.variants.join(", ")})`);
    }
  }
  // Fill in any declared block the slide left out, at the end, in its neutral variant.
  let nextOrder = Math.max(...slide.blocks.map((b) => b.order)) + 1;
  for (const [id, spec] of Object.entries(declared) as [BlockId, NonNullable<(typeof declared)[BlockId]>][]) {
    if (!seen.has(id)) {
      slide.blocks.push({ id, variant: spec.neutral, order: nextOrder++ });
      fixes.push(`${id} was missing: added in its neutral variant`);
    }
  }
  slide.blocks = normaliseOrder(slide.blocks);

  // Brand clamp: never rejected, always pulled back inside the brand's ranges and logged.
  clampTheme(slide.theme, brand, clamps);

  // Change budget.
  if (errors.length === 0) errors.push(...checkBudget(slide, prev, returning));

  return errors.length ? { ok: false, errors, clamps } : { ok: true, slide, clamps, fixes };
}

function normaliseOrder(blocks: SlideBlock[]): SlideBlock[] {
  return [...blocks].sort((a, b) => a.order - b.order).map((b, i) => ({ ...b, order: i + 1 }));
}

function clampTheme(theme: Theme, brand: BrandKit, clamps: string[]) {
  const { typeScale, radius, density, contrast } = brand.ranges;
  const clampNum = (key: "typeScale" | "radius", [lo, hi]: [number, number]) => {
    const v = theme[key];
    const c = Math.min(hi, Math.max(lo, v));
    if (c !== v) { clamps.push(`${key} ${v} → ${c} (brand range ${lo}-${hi})`); theme[key] = c; }
  };
  clampNum("typeScale", typeScale);
  clampNum("radius", radius);
  if (!density.includes(theme.density)) {
    const c = density.includes("comfortable") ? "comfortable" : density[0];
    clamps.push(`density ${theme.density} → ${c} (not allowed by brand)`);
    theme.density = c;
  }
  if (!contrast.includes(theme.contrast)) {
    clamps.push(`contrast ${theme.contrast} → ${contrast[0]} (not allowed by brand)`);
    theme.contrast = contrast[0];
  }
}

function checkBudget(slide: Slide, prev: Slide | undefined, returning: boolean): string[] {
  const samePage = prev && prev.template === slide.template;
  switch (slide.kind) {
    case "explicit":
      return [];
    case "initial":
      return samePage ? ["an initial slide is only allowed on page load"] : [];
    case "major": {
      if (!returning) return ["major slides are only allowed on a return visit"];
      if (samePage && prev.index > 0) return ["a major slide must be the first change of a return visit"];
      return samePage ? keptUnchanged(slide, prev) : [];
    }
    case "minor": {
      if (!samePage) return ["a minor slide needs a previous slide on the same page"];
      const errors = keptUnchanged(slide, prev);
      const changed = changedBlocks(prev.blocks, slide.blocks);
      if (changed.length > MAX_MINOR_CHANGES) {
        errors.push(`minor slides may change at most ${MAX_MINOR_CHANGES} blocks; this changes ${changed.length} (${changed.join(", ")})`);
      }
      if (slide.persona.dialect !== prev.persona.dialect) errors.push("minor slides may not change the dialect");
      const a = prev.theme, b = slide.theme;
      if (Math.abs(DENSITY.indexOf(a.density) - DENSITY.indexOf(b.density)) > 1) errors.push("density may move one step at most");
      if (Math.abs(a.typeScale - b.typeScale) > 0.1 + 1e-9) errors.push("typeScale may move by 0.1 at most");
      if (Math.abs(a.radius - b.radius) > 4) errors.push("radius may move by 4px at most");
      if (a.contrast !== b.contrast || a.motion !== b.motion) errors.push("minor slides may not change contrast or motion");
      return errors;
    }
  }
}

function keptUnchanged(slide: Slide, prev: Slide): string[] {
  const changed = new Set(changedBlocks(prev.blocks, slide.blocks));
  return prev.keep.filter((id) => changed.has(id)).map((id) => `block "${id}" is carried over and may not change`);
}

// A block counts as changed if its variant or collapsed state changed, or it had to move.
// "Had to move" = not in the longest common subsequence of the two orders, so moving one
// block up counts as one change, not as every block it pushed down.
export function changedBlocks(before: SlideBlock[], after: SlideBlock[]): BlockId[] {
  const a = [...before].sort((x, y) => x.order - y.order).map((b) => b.id);
  const b = [...after].sort((x, y) => x.order - y.order).map((b) => b.id);
  const stayed = lcs(a, b);
  const prevById = new Map(before.map((x) => [x.id, x]));
  return after
    .filter((x) => {
      const p = prevById.get(x.id);
      return !p || p.variant !== x.variant || !!p.collapsed !== !!x.collapsed || !stayed.has(x.id);
    })
    .map((x) => x.id);
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
