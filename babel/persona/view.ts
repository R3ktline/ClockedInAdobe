// Deterministic page views from a persona (rules, no LLM). The store says what each dialect and need means for
// its own blocks (registry byDialect / byNeed); this file only adds theme presets and plain-words rationales.
import type {
  BlockId, BrandKit, CopyRegister, Dialect, Need, PartnerContext, Persona, Registry, Skin, Template, Theme, View, ViewBlock, ViewKind,
} from "@/babel/schema";

export const CONFIDENCE_THRESHOLD = 0.55;
export const NEUTRAL: Persona = { dialect: "standard", need: "balanced", confidence: 0 };
export const TYPE_STEP = 0.1;

const round2 = (x: number) => Math.round(x * 100) / 100;

export function themeFor(dialect: Dialect, brand: BrandKit, ctx?: PartnerContext): Theme {
  const [rLo, rHi] = brand.ranges.radius;
  const mid = Math.round((rLo + rHi) / 2);
  const base: Record<Dialect, Theme> = {
    guided: { density: "airy", typeScale: 1.2, contrast: "normal", radius: mid, motion: "reduced" },
    standard: { density: "comfortable", typeScale: 1, contrast: "normal", radius: mid, motion: "full" },
    dense: { density: "compact", typeScale: 0.95, contrast: "normal", radius: rLo, motion: "full" },
    visual: { density: "comfortable", typeScale: 1.05, contrast: "normal", radius: rHi, motion: "full" },
  };
  const t = { ...base[dialect] };
  if (ctx?.account?.accessibility?.highContrast || ctx?.device?.prefersContrast) t.contrast = "high";
  if (ctx?.account?.accessibility?.reducedMotion || ctx?.device?.prefersReducedMotion) t.motion = "reduced";
  if (ctx?.account?.accessibility?.largeText) t.typeScale = Math.max(t.typeScale, 1.2);
  return t;
}

export function moveBlock(blocks: ViewBlock[], id: BlockId, to: number): ViewBlock[] {
  const ordered = [...blocks].sort((a, b) => a.order - b.order);
  const from = ordered.findIndex((b) => b.id === id);
  if (from < 0) return ordered;
  const [moved] = ordered.splice(from, 1);
  ordered.splice(Math.max(0, Math.min(to - 1, ordered.length)), 0, moved);
  return ordered.map((b, i) => ({ ...b, order: i + 1 }));
}

/** Put some blocks at exact positions (carry-over) and let the others keep their relative order around them. */
export function pinBlocks(blocks: ViewBlock[], pinned: { id: BlockId; order: number }[]): ViewBlock[] {
  const ordered = [...blocks].sort((a, b) => a.order - b.order);
  const slots: (ViewBlock | undefined)[] = new Array(ordered.length).fill(undefined);
  const placed = new Set<BlockId>();
  for (const p of pinned) {
    const b = ordered.find((x) => x.id === p.id);
    const at = Math.max(0, Math.min(ordered.length - 1, p.order - 1));
    if (b && !slots[at]) { slots[at] = b; placed.add(b.id); }
  }
  const rest = ordered.filter((b) => !placed.has(b.id));
  return slots.map((s) => s ?? rest.shift()!).map((b, i) => ({ ...b, order: i + 1 }));
}

/** The blocks a persona gets on a page type: store default, then the dialect's variants, then the need's presets. */
export function blocksFor(persona: Pick<Persona, "dialect" | "need">, template: Template, registry: Registry): ViewBlock[] {
  const declared = registry[template] ?? {};
  let blocks: ViewBlock[] = Object.entries(declared).map(([id, spec], i) => ({
    id: id as BlockId, variant: spec!.byDialect?.[persona.dialect] ?? spec!.neutral, order: i + 1,
  }));
  const moves: [BlockId, number][] = [];
  for (const b of blocks) {
    const preset = declared[b.id]?.byNeed?.[persona.need];
    if (!preset) continue;
    if (preset.variant) b.variant = preset.variant;
    if (preset.collapsed !== undefined) b.collapsed = preset.collapsed;
    if (preset.order) moves.push([b.id, preset.order]);
  }
  for (const [id, to] of moves) blocks = moveBlock(blocks, id, to);
  return blocks;
}

const DIALECT_TEXT: Record<Dialect, string> = {
  guided: "Larger text, plain descriptions and one main button.",
  standard: "The store's usual layout.",
  dense: "A compact layout with the full details.",
  visual: "Bigger pictures and less text.",
};
const NEED_TEXT: Partial<Record<Need, string>> = {
  reassurance: " Returns, warranty and reviews come first, without promotion badges.",
  specs: " Specifications and a comparison come first.",
  quick: " The buy button comes first; the rest is folded away.",
  deals: " Lower prices and the store's current promotions come first. Prices are the same for everyone.",
  inspiration: " More pictures to browse.",
};
export const rationaleFor = (p: Pick<Persona, "dialect" | "need">) => DIALECT_TEXT[p.dialect] + (NEED_TEXT[p.need] ?? "");

export const copyRegisterFor = (p: Pick<Persona, "dialect" | "need">, model?: CopyRegister): CopyRegister =>
  p.dialect === "guided" ? "plain" : model ?? (p.dialect === "dense" || p.need === "specs" ? "technical" : "standard");

export type BuildArgs = {
  persona: Persona;
  template: Template;
  registry: Registry;
  brand: BrandKit;
  ctx?: PartnerContext;
  kind?: ViewKind;
  source?: View["source"];
  copyRegister?: CopyRegister;
  skin?: Skin;
  typeScaleStep?: number; // net steps the shopper or the agent asked for, on top of the dialect's preset
  id?: string;
};

export function buildView(a: BuildArgs): View {
  const theme = themeFor(a.persona.dialect, a.brand, a.ctx);
  if (a.typeScaleStep) theme.typeScale = round2(theme.typeScale + a.typeScaleStep * TYPE_STEP);
  return {
    id: a.id ?? `${a.template}-${Math.random().toString(36).slice(2, 10)}`,
    template: a.template,
    kind: a.kind ?? "first",
    source: a.source ?? "rules",
    persona: a.persona,
    theme,
    skin: a.skin ?? "none",
    copyRegister: copyRegisterFor(a.persona, a.copyRegister),
    blocks: blocksFor(a.persona, a.template, a.registry),
    keep: [],
    rationale: rationaleFor(a.persona),
  };
}

/** The store's own page: what "Standard view" and "no consent" show. */
export const standardView = (template: Template, registry: Registry, brand: BrandKit, ctx?: PartnerContext): View => ({
  ...buildView({ persona: NEUTRAL, template, registry, brand, ctx, kind: "standard", source: "none", skin: "none" }),
  rationale: "The store's standard page. Nothing is adapted.",
});
