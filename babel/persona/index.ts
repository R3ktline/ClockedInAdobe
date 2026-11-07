// Slide 0 and the fallback (SPEC §3.5). Instant, no LLM. Every later slide is the Director's.
import type {
  BlockId, BrandKit, CopyRegister, Dialect, InteractionEvent, Need, PartnerContext, Persona, Registry, Slide, SlideBlock, Template, Theme,
} from "@/babel/schema";
import { modelInputs } from "./modelInputs";
import { buildProfile, personaOf } from "./signalModel";

export const CONFIDENCE_THRESHOLD = 0.55;
export const NEUTRAL_PERSONA: Persona = { dialect: "standard", need: "balanced", confidence: 0 };

// Slide 0 and the in-visit "who is this shopper" read both come from David's signal model
// (./signalModel.ts). With no events yet, only declared needs (accessibility settings) and
// consented partner context can move it; everything else stays neutral until real behaviour.
export function readShopper(ctx: PartnerContext, events: InteractionEvent[] = []) {
  const { signals, context, declared } = modelInputs(events, ctx);
  const profile = buildProfile(signals, declared, context);
  return { profile, model: personaOf(profile) };
}

export function initialPersona(ctx: PartnerContext): { persona: Persona; reasons: string[]; copyRegister: CopyRegister } {
  if (!ctx.consent.personalization) return { persona: NEUTRAL_PERSONA, reasons: ["no consent: standard view"], copyRegister: "standard" };
  const { model } = readShopper(ctx);
  return {
    persona: { dialect: model.dialect, need: model.need, confidence: model.confidence },
    reasons: [`dialect: ${model.dialectWhy}`, `need: ${model.needWhy}`],
    copyRegister: model.copyRegister,
  };
}

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
  copyRegister?: CopyRegister; // the signal model's read; otherwise derived from the persona
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
    copyRegister: a.copyRegister ??
      (a.persona.dialect === "guided" ? "plain"
      : a.persona.dialect === "dense" || a.persona.need === "specs" ? "technical"
      : "standard"),
    blocks,
    keep: [],
    rationale: DIALECT_TEXT[a.persona.dialect] + (NEED_TEXT[a.persona.need] ?? ""),
    confidence: a.persona.confidence,
    source: a.source ?? "rules",
  };
}
