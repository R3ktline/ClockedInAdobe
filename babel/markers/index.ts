// The 13 marketing markers (docs/MARKERS.md), computed deterministically from interaction signals. Pure
// functions, no LLM. They answer a marketer's questions, trigger the Director and feed the merchant panel. They do
// NOT pick the persona: that is the signal model's job (one shopper read, babel/persona).
import type { Category, EventType, InteractionEvent, MarkerId, Markers, MarkerValue, Stage } from "@/babel/schema";

/** An event placed on the visit's clock: t = ms since the visit started, page = page index in the visit. */
export type VisitEvent = InteractionEvent & { page: number; adapted?: boolean };

const UNITS = /\b\d+(\.\d+)?\s?(gb|tb|mb|mah|hz|ghz|w|kg|mm|cm|db|rpm)\b|\b[A-Z]{2,5}\d*\b/;
const CONVERSATIONAL = /\b(for my|for a|good for|easy to|something|which one|what is|how do|i need)\b/i;
const PRICE_WORDS = /\b(cheap|cheapest|deal|discount|offer|sale|under|budget|lei|ron)\b/i;
const ENGAGE: EventType[] = ["block_open", "block_dwell", "review_open", "policy_open", "compare_add", "add_to_cart", "gallery_swipe", "image_zoom", "filter", "sort"];

// ---------------------------------------------------------------- weights (hand-set, [ASSUMPTION])
type Scalar = Exclude<MarkerId, "purchaseIntent" | "categoryAffinity" | "featureInterest" | "abandonmentRisk">;
type Rule = { halfLifeMs?: number; bipolar?: boolean };

export const RULES: Record<Scalar, Rule> = {
  priceSensitivity: {},
  infoAppetite: { halfLifeMs: 120_000 },
  jargonComfort: { bipolar: true },
  trustNeed: { halfLifeMs: 180_000 },
  hesitation: { halfLifeMs: 30_000 },
  confusion: { halfLifeMs: 30_000 },
  inspirationAppetite: { halfLifeMs: 180_000 },
  interactionFluency: { bipolar: true },
  adaptationAcceptance: { bipolar: true },
};

/** Per-event contribution to each scalar marker. Some need context (what came before), hence the pre-pass. */
export function weigh(events: VisitEvent[]): Map<VisitEvent, Partial<Record<Scalar, number>>> {
  const out = new Map<VisitEvent, Partial<Record<Scalar, number>>>();
  const engagedOnPage = new Map<number, boolean>();
  let lastSearchAt = -Infinity, clickedSinceSearch = true;
  for (const e of events) {
    const w: Partial<Record<Scalar, number>> = {};
    const v = String(e.value ?? "");
    switch (e.type) {
      case "policy_open":
        w.trustNeed = v === "returns" || v === "warranty" ? 0.45 : 0.2;
        if (v === "delivery") w.trustNeed = 0.2;
        break;
      case "review_open": w.trustNeed = 0.35; w.infoAppetite = 0.1; break;
      case "review_sort": w.trustNeed = 0.3; break;
      case "block_open":
        if (e.blockId === "specs") w.infoAppetite = 0.4;
        if (e.blockId === "trust") w.trustNeed = 0.3;
        if (e.target === "spec:technical") w.jargonComfort = 0.5;
        if (e.target === "glossary") w.jargonComfort = -0.6;
        break;
      case "block_dwell": {
        const ms = Number(e.value ?? 0);
        if (e.blockId === "specs") w.infoAppetite = Math.min(ms / 15_000, 0.4);
        if (e.blockId === "trust") w.trustNeed = Math.min(ms / 20_000, 0.3);
        break;
      }
      case "page_zoom":
        if (e.blockId === "specs") w.infoAppetite = 0.3;
        if (e.blockId === "trust") w.trustNeed = 0.3;
        break;
      case "compare_add": w.infoAppetite = 0.3; w.interactionFluency = 0.2; break;
      case "idle": w.hesitation = e.blockId === "buyBox" ? 0.5 : 0.15; break;
      case "remove_from_cart": w.hesitation = 0.6; break;
      case "hover_price": w.hesitation = 0.25; w.priceSensitivity = 0.1; break;
      case "back_nav": w.hesitation = 0.15; w.confusion = 0.3; w.interactionFluency = -0.15; break;
      case "dead_click": w.confusion = 0.3; w.interactionFluency = -0.4; break;
      case "rage_click": w.confusion = 0.5; w.interactionFluency = -0.6; break;
      case "mis_tap": w.interactionFluency = -0.6; w.confusion = 0.1; break;
      case "keyboard_nav": w.interactionFluency = 0.3; break;
      case "sort": if (v.startsWith("price")) w.priceSensitivity = 0.5; w.interactionFluency = 0.1; break;
      case "filter":
        if (v.startsWith("price") || v === "on_sale") w.priceSensitivity = 0.4;
        if (v.includes(":")) w.jargonComfort = 0.4;
        w.interactionFluency = 0.2;
        break;
      case "search":
        if (UNITS.test(v) && !CONVERSATIONAL.test(v)) w.jargonComfort = 0.8;
        else if (CONVERSATIONAL.test(v)) w.jargonComfort = -0.8;
        if (PRICE_WORDS.test(v)) w.priceSensitivity = 0.5;
        if (!clickedSinceSearch && e.t - lastSearchAt < 30_000) w.confusion = 0.3; // refined, nothing clicked
        w.interactionFluency = 0.15;
        lastSearchAt = e.t; clickedSinceSearch = false;
        break;
      case "product_click":
        clickedSinceSearch = true;
        if (e.blockId === "compare" && v === "cheaper") w.priceSensitivity = 0.4;
        break;
      case "gallery_swipe": w.inspirationAppetite = 0.3; break;
      case "image_zoom": w.inspirationAppetite = 0.2; break;
      case "scroll": if (v === "fast") w.inspirationAppetite = 0.2; break;
      case "category_click": w.inspirationAppetite = 0.15; break;
      case "page_view":
        // Volume is not interest: a new page after a page with nothing opened counts towards confusion.
        if (e.page > 0 && engagedOnPage.get(e.page - 1) === false) w.confusion = 0.25;
        break;
      case "view_undo": w.adaptationAcceptance = -0.8; break;
      case "view_switch": if (v === "standard") w.adaptationAcceptance = -1; break;
    }
    if (ENGAGE.includes(e.type) && e.adapted) w.adaptationAcceptance = (w.adaptationAcceptance ?? 0) + 0.3;
    if (!engagedOnPage.has(e.page)) engagedOnPage.set(e.page, false);
    if (ENGAGE.includes(e.type)) engagedOnPage.set(e.page, true);
    out.set(e, w);
  }
  return out;
}

const saturate = (x: number) => 1 - Math.exp(-Math.max(0, x));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const r2 = (x: number) => Math.round(x * 100) / 100;

function scalarAt(id: Scalar, events: VisitEvent[], weights: ReturnType<typeof weigh>, now: number) {
  const rule = RULES[id];
  const parts = events.filter((e) => e.t <= now).map((e) => {
    const decay = rule.halfLifeMs ? 0.5 ** ((now - e.t) / rule.halfLifeMs) : 1;
    return { e, w: (weights.get(e)?.[id] ?? 0) * decay };
  }).filter((p) => p.w !== 0);
  const sum = parts.reduce((s, p) => s + p.w, 0);
  return { value: rule.bipolar ? sigmoid(sum) : saturate(sum), parts };
}

// ---------------------------------------------------------------- purchase intent, stage, vectors

export function stageOf(events: VisitEvent[]): Stage {
  let cart = 0;
  for (const e of events) cart += e.type === "add_to_cart" ? 1 : e.type === "remove_from_cart" ? -1 : 0;
  if (cart > 0 || events.some((e) => e.type === "checkout_start" || e.type === "reorder_click")) return "deciding";
  const views = new Map<string, number>();
  for (const e of events) if (e.type === "page_view" && e.productId) views.set(e.productId, (views.get(e.productId) ?? 0) + 1);
  const compares = events.filter((e) => e.type === "compare_add").length;
  if (compares >= 2 || [...views.values()].filter((n) => n >= 2).length >= 2) return "comparing";
  const opens = events.filter((e) => ["block_open", "review_open", "policy_open"].includes(e.type)).length;
  return opens >= 2 ? "researching" : "browsing";
}

function purchaseIntent(events: VisitEvent[]) {
  const seen = new Set<string>();
  const parts: { e: VisitEvent; w: number }[] = [];
  for (const e of events) {
    let w = 0;
    if (e.type === "add_to_cart") w = 0.6;
    else if (e.type === "checkout_start") w = 0.8;
    else if (e.type === "reorder_click") w = 0.5;
    else if (e.type === "remove_from_cart") w = -0.5;
    else if (e.type === "compare_add") w = 0.15;
    else if (e.type === "policy_open" && e.value === "delivery") w = 0.25;
    else if (e.type === "page_view" && e.productId) { if (seen.has(e.productId)) w = 0.3; seen.add(e.productId); }
    if (w) parts.push({ e, w });
  }
  return { value: saturate(parts.reduce((s, p) => s + p.w, 0)), parts };
}

function vector(events: VisitEvent[], keyOf: (e: VisitEvent) => [string, number] | undefined) {
  const tally = new Map<string, number>();
  const parts: { e: VisitEvent; w: number }[] = [];
  for (const e of events) {
    const kv = keyOf(e);
    if (!kv) continue;
    tally.set(kv[0], (tally.get(kv[0]) ?? 0) + kv[1]);
    parts.push({ e, w: kv[1] });
  }
  const total = [...tally.values()].reduce((s, v) => s + v, 0);
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([key, v]) => ({ key, value: r2(v / total) }));
  return { value: top[0]?.value ?? 0, parts, top };
}

export const categoryOfId = (id?: string): Category | undefined => ({
  home: "home", elec: "electronics", fash: "fashion", groc: "groceries", toy: "toys", hb: "health_beauty",
} as Record<string, Category>)[id?.split("-")[0] ?? ""];

// ---------------------------------------------------------------- snapshot

export type Snapshot = { markers: Markers; stage: Stage };

function pack(parts: { e: VisitEvent; w: number }[], value: number, before: number, top?: MarkerValue["top"]): MarkerValue {
  const trend: MarkerValue["trend"] = value - before > 0.05 ? "up" : before - value > 0.05 ? "down" : "flat";
  const evidence = [...parts].sort((a, b) => Math.abs(b.w) - Math.abs(a.w)).slice(0, 5)
    .map(({ e }) => ({ t: e.t, page: e.page, type: e.type, note: e.target ?? (e.value === undefined ? e.blockId : String(e.value)) }));
  return { value: r2(Math.min(1, Math.max(0, value))), trend, evidence, ...(top ? { top } : {}) };
}

export function computeMarkers(events: VisitEvent[], now: number): Snapshot {
  const weights = weigh(events);
  const markers: Markers = {};
  const past = (ms: number) => events.filter((e) => e.t <= ms);
  const earlier = Math.max(0, now - 10_000);
  for (const id of Object.keys(RULES) as Scalar[]) {
    const { value, parts } = scalarAt(id, events, weights, now);
    markers[id] = pack(parts, value, scalarAt(id, past(earlier), weights, earlier).value);
  }
  const pi = purchaseIntent(events);
  markers.purchaseIntent = pack(pi.parts, pi.value, purchaseIntent(past(earlier)).value);
  const cat = vector(events, (e) => {
    const c = categoryOfId(e.productId) ?? (e.type === "category_click" ? String(e.value) : undefined);
    if (!c) return undefined;
    return [c, e.type === "add_to_cart" ? 3 : e.type === "page_view" ? 1 : 0.5];
  });
  markers.categoryAffinity = pack(cat.parts, cat.value, cat.value, cat.top);
  const feat = vector(events, (e) => {
    if (e.target?.startsWith("spec:") && e.target !== "spec:technical") return [e.target.slice(5), 1];
    if (e.type === "filter" && String(e.value).includes(":") && !String(e.value).startsWith("brand:")) return [String(e.value).split(":")[0], 1];
    return undefined;
  });
  markers.featureInterest = pack(feat.parts, feat.value, feat.value, feat.top);
  // Abandonment risk is a composite: it names a cause (hesitation, confusion), it never licenses pressure.
  const h = markers.hesitation!.value, c = markers.confusion!.value;
  const lastIdle = [...events].reverse().find((e) => e.type === "idle");
  const stage = stageOf(events);
  const risk = 0.5 * h + 0.5 * c + (lastIdle && Number(lastIdle.value) >= 10_000 ? 0.2 : 0) - (stage === "deciding" ? 0.3 : 0);
  const trendOf = (id: MarkerId) => markers[id]!.trend;
  markers.abandonmentRisk = {
    ...pack([], risk, risk),
    trend: trendOf("hesitation") === "up" || trendOf("confusion") === "up" ? "up" : trendOf("hesitation") === "down" ? "down" : "flat",
    evidence: [...markers.hesitation!.evidence, ...markers.confusion!.evidence].slice(0, 5),
  };
  return { markers, stage };
}

// ---------------------------------------------------------------- triggers and hypothesis windows

export const TRIGGER_THRESHOLD = 0.6;
const TRIGGER_MARKERS: MarkerId[] = ["hesitation", "trustNeed", "confusion"];

/** Markers that crossed the threshold upward since the previous snapshot, plus a stage change. */
export function findTriggers(prev: Snapshot | undefined, next: Snapshot): (MarkerId | "stage")[] {
  const crossed: (MarkerId | "stage")[] = TRIGGER_MARKERS.filter((id) =>
    (next.markers[id]?.value ?? 0) >= TRIGGER_THRESHOLD && (prev?.markers[id]?.value ?? 0) < TRIGGER_THRESHOLD);
  if (prev && prev.stage !== next.stage) crossed.push("stage");
  return crossed;
}

/**
 * How much a marker was fed by behaviour inside a time window: the raw (undecayed) sum of event weights.
 * Hypotheses compare the window after a view with an equal window before it, so a fading marker does not
 * "come true" just because time passed. Vector and composite markers fall back to their main drivers.
 */
export function windowWeight(marker: MarkerId, events: VisitEvent[], from: number, to: number): number {
  const inWin = events.filter((e) => e.t >= from && e.t < to);
  if (marker === "purchaseIntent") return purchaseIntent(inWin).parts.reduce((s, p) => s + p.w, 0);
  if (marker === "abandonmentRisk") return windowWeight("hesitation", events, from, to) + windowWeight("confusion", events, from, to);
  if (marker === "categoryAffinity" || marker === "featureInterest") return inWin.length;
  const w = weigh(events);
  return inWin.reduce((s, e) => s + (w.get(e)?.[marker as Scalar] ?? 0), 0);
}

/** Fading markers can go down; accumulating ones mostly rise. The Director gets this to place sensible bets. */
export const markerKinds = (): Record<MarkerId, "fades" | "accumulates" | "both ways"> => ({
  purchaseIntent: "accumulates", priceSensitivity: "accumulates", infoAppetite: "fades", jargonComfort: "both ways",
  trustNeed: "fades", hesitation: "fades", confusion: "fades", inspirationAppetite: "fades", categoryAffinity: "accumulates",
  featureInterest: "accumulates", interactionFluency: "both ways", abandonmentRisk: "fades", adaptationAcceptance: "both ways",
});
