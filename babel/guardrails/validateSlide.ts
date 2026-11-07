// Slide validation (GUARDRAILS §1, layers 5-8): schema → registry → brand clamp → change budget.
// The policy layer (banned words, persona labels) arrives in Phase 2.
import { Slide, type BlockId, type BrandKit, type Registry, type SlideBlock, type Theme } from "@/babel/schema";
import { changedBlocks } from "@/babel/schema/diff";

export { changedBlocks };

export type ValidateInput = {
  slide: unknown;
  prev?: Slide;          // the slide currently shown, if any
  lastChanged?: BlockId[]; // blocks the previous slide itself changed: they get one slide off
  registry: Registry;
  brand: BrandKit;
  returning: boolean;    // is this a return visit?
};

export type ValidateResult =
  | { ok: true; slide: Slide; clamps: string[]; fixes: string[] }
  | { ok: false; errors: string[]; clamps: string[] };

const DENSITY = ["airy", "comfortable", "compact"] as const;
const MAX_MINOR_CHANGES = 4;

export function validateSlide({ slide: raw, prev, lastChanged, registry, brand, returning }: ValidateInput): ValidateResult {
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
  if (errors.length === 0) errors.push(...checkBudget(slide, prev, returning, lastChanged));

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

function checkBudget(slide: Slide, prev: Slide | undefined, returning: boolean, lastChanged?: BlockId[]): string[] {
  const samePage = prev && prev.template === slide.template;
  switch (slide.kind) {
    case "explicit":
      return [];
    case "initial":
      return samePage ? ["an initial slide is only allowed on page load"] : [];
    case "major": {
      // A calibration slide is the one big change that lands, behind a curtain, once the shopper's profile is clear.
      if (slide.trigger === "calibration") return samePage ? keptUnchanged(slide, prev) : [];
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
      // Blocks the previous slide changed get one slide off, so an element is not
      // reworked twice in a row and the page has time to settle.
      if (lastChanged) {
        const hot = changed.filter((id) => lastChanged.includes(id));
        if (hot.length) errors.push(`fresh from the last slide, leave for this one: ${hot.join(", ")}`);
      }
      const a = prev.theme, b = slide.theme;
      if (Math.abs(DENSITY.indexOf(a.density) - DENSITY.indexOf(b.density)) > 1) errors.push("density may move one step at most");
      if (Math.abs(a.typeScale - b.typeScale) > 0.2 + 1e-9) errors.push("typeScale may move by 0.2 at most");
      if (Math.abs(a.radius - b.radius) > 8) errors.push("radius may move by 8px at most");
      if (a.contrast !== b.contrast || a.motion !== b.motion) errors.push("minor slides may not change contrast or motion");
      if ((prev.skin ?? "none") !== (slide.skin ?? "none")) errors.push("minor slides may not change the skin (the whole look)");
      return errors;
    }
  }
}

function keptUnchanged(slide: Slide, prev: Slide): string[] {
  const changed = new Set(changedBlocks(prev.blocks, slide.blocks));
  return prev.keep.filter((id) => changed.has(id)).map((id) => `block "${id}" is carried over and may not change`);
}
