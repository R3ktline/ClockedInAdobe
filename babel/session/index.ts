// In-memory visit state shared by the API routes (demo scope: one Node process, no database).
import type {
  BlockId, Hypothesis, InteractionEvent, MarkerId, Markers, PartnerContext, Persona, Slide, Template,
} from "@/babel/schema";
import { computeMarkers, findTriggers } from "@/babel/markers";
import { changedBlocks } from "@/babel/guardrails/validateSlide";

export type TraceEntry = {
  at: number; // ms since visit start
  kind: "visit" | "trigger" | "slide" | "hold" | "result" | "skip";
  text: string;
  triggers?: MarkerId[];
  markers?: Partial<Record<MarkerId, number>>;
  hypothesis?: Hypothesis;
  diff?: string[];
  errors?: string[][];
  clamps?: string[];
  rounds?: number;
  ms?: number;
  mocked?: boolean;
  met?: boolean;
};

export type Visit = {
  id: string;
  store: string;
  template: Template;
  productId?: string;
  partner: PartnerContext;
  returning: boolean;
  startedAt: number;
  events: InteractionEvent[];
  markers: Markers;
  slides: Slide[];
  slideAt: Record<string, { t: number; markers: Markers }>;
  scored: string[];
  trace: TraceEntry[];
  pendingTriggers: MarkerId[];
  directorBusy: boolean;
  lastDirectorSlideAt?: number;
  minorCount: number;
  standardView: boolean;
};

const MIN_GAP_MS = Number(process.env.BABEL_MIN_SLIDE_GAP_MS ?? 20_000);
const MAX_MINOR_SLIDES = 5;

const g = globalThis as unknown as { __babelVisits?: Map<string, Visit> };
const visits: Map<string, Visit> = (g.__babelVisits ??= new Map());

export const getVisit = (id: string) => visits.get(id);
export const listVisits = () => [...visits.values()].sort((a, b) => b.startedAt - a.startedAt);
export const elapsed = (v: Visit) => Date.now() - v.startedAt;

export function createVisit(init: {
  store: string; template: Template; productId?: string; partner: PartnerContext; persona: Persona; slide: Slide; reasons: string[];
}): Visit {
  const v: Visit = {
    id: crypto.randomUUID(),
    store: init.store,
    template: init.template,
    productId: init.productId,
    partner: init.partner,
    returning: init.partner.visitor.returning,
    startedAt: Date.now(),
    events: [],
    markers: {},
    slides: [init.slide],
    slideAt: { [init.slide.id]: { t: 0, markers: {} } },
    scored: [],
    trace: [{ at: 0, kind: "visit", text: `slide 0 from rules: ${init.persona.dialect} × ${init.persona.need}`, diff: init.reasons }],
    pendingTriggers: [],
    directorBusy: false,
    minorCount: 0,
    standardView: !init.partner.consent.personalization,
  };
  visits.set(v.id, v);
  return v;
}

const values = (m: Markers) =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v!.value])) as Partial<Record<MarkerId, number>>;

// Append events, recompute markers, score due hypotheses, and decide whether a slide is due.
export function recordEvents(v: Visit, events: InteractionEvent[]): { trigger: boolean } {
  v.events.push(...events);
  if (events.some((e) => e.type === "view_switch" && e.value === "standard")) v.standardView = true;
  if (!v.partner.consent.personalization) return { trigger: false }; // no consent: no markers (GUARDRAILS §2)

  const now = Math.max(elapsed(v), ...v.events.map((e) => e.t));
  const prev = v.markers;
  v.markers = computeMarkers(v.events, now);
  scoreHypotheses(v, now);

  const crossed = findTriggers(prev, v.markers);
  if (!crossed.length || v.standardView) return { trigger: false };
  const tooSoon = v.lastDirectorSlideAt !== undefined && now - v.lastDirectorSlideAt < MIN_GAP_MS;
  if (tooSoon || v.minorCount >= MAX_MINOR_SLIDES) {
    v.trace.push({ at: now, kind: "skip", text: `${crossed.join(", ")} crossed, but ${tooSoon ? "the last slide was too recent" : "the slide limit is reached"}`, triggers: crossed });
    return { trigger: false };
  }
  v.pendingTriggers = [...new Set([...v.pendingTriggers, ...crossed])];
  v.trace.push({ at: now, kind: "trigger", text: `${crossed.join(", ")} crossed ${0.6}`, triggers: crossed, markers: values(v.markers) });
  return { trigger: true };
}

function scoreHypotheses(v: Visit, now: number) {
  for (const s of v.slides) {
    const at = v.slideAt[s.id];
    if (!s.hypothesis || !at || v.scored.includes(s.id)) continue;
    const { marker, expect, withinSeconds } = s.hypothesis;
    if (now - at.t < withinSeconds * 1000) continue;
    const before = at.markers[marker]?.value ?? 0;
    const after = v.markers[marker]?.value ?? 0;
    const met = expect === "down" ? after < before : after > before;
    v.scored.push(s.id);
    v.trace.push({
      at: now, kind: "result", met, hypothesis: s.hypothesis,
      text: `slide ${s.index}: ${marker} ${before.toFixed(2)} → ${after.toFixed(2)}, expected ${expect}: ${met ? "met" : "not met"}`,
    });
  }
}

export function addSlide(v: Visit, slide: Slide) {
  const now = elapsed(v);
  v.slides.push(slide);
  v.slideAt[slide.id] = { t: now, markers: structuredClone(v.markers) };
  v.lastDirectorSlideAt = now;
  if (slide.kind === "minor") v.minorCount++;
}

// Human-readable change list between two slides, for the trace and the merchant panel.
export function describeDiff(prev: Slide, next: Slide): string[] {
  const out: string[] = [];
  const before = new Map(prev.blocks.map((b) => [b.id, b]));
  const changed = new Set(changedBlocks(prev.blocks, next.blocks)); // blocks pushed aside don't count as moved
  for (const b of next.blocks) {
    const p = before.get(b.id as BlockId);
    if (!p) { out.push(`${b.id}: added (${b.variant})`); continue; }
    if (p.variant !== b.variant) out.push(`${b.id}: ${p.variant} → ${b.variant}`);
    if (p.order !== b.order && changed.has(b.id)) out.push(`${b.id}: position ${p.order} → ${b.order}`);
    if (!!p.collapsed !== !!b.collapsed) out.push(`${b.id}: ${b.collapsed ? "collapsed" : "expanded"}`);
  }
  if (prev.persona.dialect !== next.persona.dialect) out.push(`dialect: ${prev.persona.dialect} → ${next.persona.dialect}`);
  if (prev.persona.need !== next.persona.need) out.push(`need: ${prev.persona.need} → ${next.persona.need}`);
  if (prev.copyRegister !== next.copyRegister) out.push(`copy: ${prev.copyRegister} → ${next.copyRegister}`);
  for (const k of Object.keys(next.theme) as (keyof Slide["theme"])[]) {
    if (prev.theme[k] !== next.theme[k]) out.push(`theme.${k}: ${prev.theme[k]} → ${next.theme[k]}`);
  }
  return out;
}
