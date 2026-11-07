// Rules for slide 0 and the fallback (SPEC §3.5). Instant, no LLM. Every later slide is the Director's.
import type {
  BlockId, BrandKit, Dialect, Need, PartnerContext, Persona, Registry, Slide, SlideBlock, Template, Theme,
} from "@/babel/schema";

export const CONFIDENCE_THRESHOLD = 0.55;
export const NEUTRAL_PERSONA: Persona = { dialect: "standard", need: "balanced", confidence: 0 };

export function initialPersona(ctx: PartnerContext): { persona: Persona; reasons: string[] } {
  if (!ctx.consent.personalization) return { persona: NEUTRAL_PERSONA, reasons: ["no consent: standard view"] };
  const reasons: string[] = [];
  const dialect: Record<Dialect, number> = { guided: 0, standard: 0, dense: 0, visual: 0 };
  const need: Record<Need, number> = { specs: 0, deals: 0, inspiration: 0, reassurance: 0, quick: 0, balanced: 0 };
  const add = <K extends string>(scores: Record<K, number>, key: K, w: number, why: string) => {
    scores[key] += w;
    reasons.push(`${why} → ${key} +${w}`);
  };
  const a11y = ctx.account?.accessibility;
  const d = ctx.device;
  if (a11y?.largeText) add(dialect, "guided", 0.5, "large text set in account");
  if (d && d.zoom >= 1.25) add(dialect, "guided", 0.3, `zoom ${d.zoom}`);
  if (a11y?.highContrast || d?.prefersContrast) add(dialect, "guided", 0.2, "high contrast preferred");
  if (d?.pointer === "fine" && d.viewportWidth >= 1280) add(dialect, "dense", 0.15, "desktop, fine pointer");
  if (d?.pointer === "coarse" && d.viewportWidth < 500) add(dialect, "visual", 0.2, "phone");
  // Campaign tags carry intent, never demographics (GUARDRAILS §3). ageBand is deliberately unused.
  const tag = ctx.campaign?.intentTag;
  if (tag === "specs") { add(dialect, "dense", 0.4, "specs campaign"); add(need, "specs", 0.6, "specs campaign"); }
  if (tag === "new-season") { add(dialect, "visual", 0.4, "new-season campaign"); add(need, "inspiration", 0.6, "new-season campaign"); }
  if (tag === "deal") add(need, "deals", 0.7, "deal campaign");
  if (tag === "gift") add(need, "reassurance", 0.6, "gift campaign");
  const repeat = ctx.account?.orderCategories?.some((c) => c === "groceries" || c === "health_beauty");
  if (ctx.visitor.returning && repeat) add(need, "quick", 0.6, "returning repeat buyer");

  const [topDialect, dConf] = top(dialect);
  const [topNeed, nConf] = top(need);
  const useDialect = dConf >= CONFIDENCE_THRESHOLD ? topDialect : "standard";
  const useNeed = nConf >= CONFIDENCE_THRESHOLD ? topNeed : "balanced";
  const confidence = Math.min(1, Math.max(useDialect === "standard" ? 0 : dConf, useNeed === "balanced" ? 0 : nConf));
  if (useDialect === "standard" && useNeed === "balanced") reasons.push("weak evidence: standard view");
  return { persona: { dialect: useDialect, need: useNeed, confidence: round(confidence) }, reasons };
}

function top<K extends string>(scores: Record<K, number>): [K, number] {
  return (Object.entries(scores) as [K, number][]).sort((a, b) => b[1] - a[1])[0];
}
const round = (x: number) => Math.round(x * 100) / 100;

// The store's reading of each dialect lives in its registry (byDialect); the theme presets live here.
function themeFor(dialect: Dialect, brand: BrandKit, ctx?: PartnerContext): Theme {
  const [rLo, rHi] = brand.ranges.radius;
  const mid = Math.round((rLo + rHi) / 2);
  const base: Record<Dialect, Theme> = {
    guided: { density: "airy", typeScale: 1.25, contrast: "normal", radius: mid, motion: "reduced" },
    standard: { density: "comfortable", typeScale: 1, contrast: "normal", radius: mid, motion: "full" },
    dense: { density: "compact", typeScale: 0.95, contrast: "normal", radius: rLo, motion: "full" },
    visual: { density: "comfortable", typeScale: 1.05, contrast: "normal", radius: rHi, motion: "full" },
  };
  const theme = { ...base[dialect] };
  if (ctx?.account?.accessibility?.highContrast || ctx?.device?.prefersContrast) theme.contrast = "high";
  if (ctx?.account?.accessibility?.reducedMotion || ctx?.device?.prefersReducedMotion) theme.motion = "reduced";
  return theme;
}

// Which block a need pulls up, and to which position.
const NEED_PROMOTES: Partial<Record<Need, { block: BlockId; to: number }>> = {
  reassurance: { block: "trust", to: 2 },
  specs: { block: "specs", to: 2 },
  quick: { block: "buyBox", to: 1 },
};

export function moveBlock(blocks: SlideBlock[], id: BlockId, to: number): SlideBlock[] {
  const ordered = [...blocks].sort((a, b) => a.order - b.order);
  const from = ordered.findIndex((b) => b.id === id);
  if (from < 0) return ordered;
  const [moved] = ordered.splice(from, 1);
  ordered.splice(Math.max(0, Math.min(to - 1, ordered.length)), 0, moved);
  return ordered.map((b, i) => ({ ...b, order: i + 1 }));
}

const DIALECT_TEXT: Record<Dialect, string> = {
  guided: "Larger text, plain descriptions and one main button.",
  standard: "The store's usual layout.",
  dense: "A compact layout with the full specifications.",
  visual: "Bigger photos and less text.",
};
const NEED_TEXT: Partial<Record<Need, string>> = {
  reassurance: " Returns, warranty and reviews are near the top.",
  specs: " Specifications come first.",
  quick: " The buy button comes first.",
};

export type BuildArgs = {
  persona: Persona;
  template: Template;
  registry: Registry;
  brand: BrandKit;
  ctx?: PartnerContext;
  index?: number;
  kind?: Slide["kind"];
  trigger?: Slide["trigger"];
  source?: Slide["source"];
  parentId?: string;
};

// Deterministic slide for a persona. Callers still run it through validateSlide.
export function buildSlide(a: BuildArgs): Slide {
  const declared = a.registry[a.template] ?? {};
  let blocks: SlideBlock[] = Object.entries(declared).map(([id, spec], i) => ({
    id: id as BlockId,
    variant: spec!.byDialect?.[a.persona.dialect] ?? spec!.neutral,
    order: i + 1,
  }));
  const promote = NEED_PROMOTES[a.persona.need];
  if (promote && declared[promote.block]) blocks = moveBlock(blocks, promote.block, promote.to);
  return {
    id: `${a.template}-${a.index ?? 0}-${Math.random().toString(36).slice(2, 8)}`,
    index: a.index ?? 0,
    parentId: a.parentId,
    kind: a.kind ?? "initial",
    trigger: a.trigger ?? "page_load",
    template: a.template,
    persona: a.persona,
    theme: themeFor(a.persona.dialect, a.brand, a.ctx),
    copyRegister:
      a.persona.dialect === "guided" ? "plain"
      : a.persona.dialect === "dense" || a.persona.need === "specs" ? "technical"
      : "standard",
    blocks,
    keep: [],
    rationale: DIALECT_TEXT[a.persona.dialect] + (NEED_TEXT[a.persona.need] ?? ""),
    confidence: a.persona.confidence,
    source: a.source ?? "rules",
  };
}
