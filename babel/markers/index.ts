// Deterministic markers from interaction signals (docs/MARKERS.md). Pure functions; no LLM.
// Foundation covers 3 of the 13 markers; Track D adds the rest in Phase 2.
import type { InteractionEvent, MarkerId, Markers, MarkerValue } from "@/babel/schema";

type Rule = {
  weight: (e: InteractionEvent) => number; // contribution of one event, 0 if it doesn't count
  halfLifeMs?: number;                     // transient markers fade; session markers don't
};

const isTrustPolicy = (e: InteractionEvent) => e.type === "policy_open" && (e.value === "returns" || e.value === "warranty");

export const RULES: Partial<Record<MarkerId, Rule>> = {
  trustNeed: {
    weight: (e) =>
      isTrustPolicy(e) ? 0.45
      : e.type === "policy_open" ? 0.2
      : e.type === "review_open" ? 0.35
      : e.type === "block_open" && e.blockId === "trust" ? 0.3
      : e.type === "block_dwell" && e.blockId === "trust" ? Math.min(Number(e.value ?? 0) / 20000, 0.3)
      : 0,
  },
  hesitation: {
    halfLifeMs: 30_000,
    weight: (e) =>
      e.type === "idle" && e.blockId === "buyBox" ? 0.5
      : e.type === "idle" ? 0.15
      : e.type === "remove_from_cart" ? 0.6
      : e.type === "hover_price" ? 0.25
      : e.type === "back_nav" ? 0.15
      : 0,
  },
  // Only opening or reading detail counts. Page views alone never raise it ("volume is not interest").
  infoAppetite: {
    weight: (e) =>
      e.type === "block_open" && e.blockId === "specs" ? 0.4
      : e.type === "block_dwell" && e.blockId === "specs" ? Math.min(Number(e.value ?? 0) / 15000, 0.4)
      : e.type === "compare_add" ? 0.3
      : 0,
  },
};

// Fading markers can go down; session totals only rise. The Director needs this to place sensible bets.
export const markerKinds = () =>
  Object.fromEntries(Object.entries(RULES).map(([id, r]) => [id, r!.halfLifeMs ? "fades" : "accumulates"]));

const saturate = (x: number) => 1 - Math.exp(-x);
const round = (x: number) => Math.round(x * 100) / 100;

function valueAt(rule: Rule, events: InteractionEvent[], now: number) {
  const parts = events
    .filter((e) => e.t <= now)
    .map((e) => {
      const decay = rule.halfLifeMs ? 0.5 ** ((now - e.t) / rule.halfLifeMs) : 1;
      return { e, w: rule.weight(e) * decay };
    })
    .filter((p) => p.w > 0);
  return { value: saturate(parts.reduce((s, p) => s + p.w, 0)), parts };
}

export function computeMarkers(events: InteractionEvent[], now: number): Markers {
  const out: Markers = {};
  for (const [id, rule] of Object.entries(RULES) as [MarkerId, Rule][]) {
    const { value, parts } = valueAt(rule, events, now);
    const before = valueAt(rule, events, Math.max(0, now - 10_000)).value;
    const trend: MarkerValue["trend"] = value - before > 0.05 ? "up" : before - value > 0.05 ? "down" : "flat";
    const evidence = parts
      .sort((a, b) => b.w - a.w)
      .slice(0, 5)
      .map(({ e }) => ({ t: e.t, type: e.type, note: e.value === undefined ? e.blockId : String(e.value) }));
    out[id] = { value: round(value), trend, evidence };
  }
  return out;
}

export const TRIGGER_THRESHOLD = 0.6;
const TRIGGER_MARKERS: MarkerId[] = ["hesitation", "trustNeed", "confusion"];

// Markers that crossed the threshold upward since the previous snapshot.
export function findTriggers(prev: Markers | undefined, next: Markers): MarkerId[] {
  return TRIGGER_MARKERS.filter((id) => {
    const now = next[id]?.value ?? 0;
    const before = prev?.[id]?.value ?? 0;
    return now >= TRIGGER_THRESHOLD && before < TRIGGER_THRESHOLD;
  });
}
