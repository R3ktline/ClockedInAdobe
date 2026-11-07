// In-memory visit state shared by the API routes (demo scope: one Node process, no database).
import type {
  Hypothesis, InteractionEvent, MarkerId, Markers, PartnerContext, Persona, Slide, Template,
} from "@/babel/schema";
import { computeMarkers, findTriggers } from "@/babel/markers";
import type { LlmTranscript } from "@/babel/agents/director";

// "checkin" = a routine look by the agent, not a threshold crossing.
export type Trigger = MarkerId | "checkin";

export type TraceEntry = {
  at: number; // ms since visit start
  kind: "visit" | "trigger" | "slide" | "hold" | "result" | "skip";
  text: string;
  triggers?: Trigger[];
  markers?: Partial<Record<MarkerId, number>>;
  hypothesis?: Hypothesis;
  diff?: string[];
  errors?: string[][];
  clamps?: string[];
  rounds?: number;
  ms?: number;
  mocked?: boolean;
  met?: boolean;
  llm?: LlmTranscript;
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
  pendingTriggers: Trigger[];
  lastLookAt: number;      // when the agent was last asked to look
  eventsAtLastLook: number;
  directorBusy: boolean;
  lastDirectorSlideAt?: number;
  minorCount: number;
  standardView: boolean;
};

const MIN_GAP_MS = Number(process.env.BABEL_MIN_SLIDE_GAP_MS ?? 20_000);
const MAX_MINOR_SLIDES = 5;
// The agent also takes a look on its own after this long with new activity, so changes are not only
// threshold-driven. 0 turns check-ins off.
const CHECKIN_MS = Number(process.env.BABEL_CHECKIN_MS ?? 15_000);
const CHECKIN_MIN_EVENTS = 3;

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
    lastLookAt: 0,
    eventsAtLastLook: 0,
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

  const crossed: Trigger[] = findTriggers(prev, v.markers);
  const fresh = v.events.length - v.eventsAtLastLook;
  const checkin = !crossed.length && CHECKIN_MS > 0 && now - v.lastLookAt >= CHECKIN_MS && fresh >= CHECKIN_MIN_EVENTS;
  if ((!crossed.length && !checkin) || v.standardView) return { trigger: false };
  const tooSoon = v.lastDirectorSlideAt !== undefined && now - v.lastDirectorSlideAt < MIN_GAP_MS;
  if (tooSoon || v.minorCount >= MAX_MINOR_SLIDES) {
    if (!checkin) v.trace.push({ at: now, kind: "skip", text: `${crossed.join(", ")} crossed, but ${tooSoon ? "the last slide was too recent" : "the slide limit is reached"}`, triggers: crossed });
    return { trigger: false };
  }
  const triggers: Trigger[] = checkin ? ["checkin"] : crossed;
  v.pendingTriggers = [...new Set([...v.pendingTriggers, ...triggers])];
  v.lastLookAt = now;
  v.eventsAtLastLook = v.events.length;
  v.trace.push({
    at: now, kind: "trigger", triggers, markers: values(v.markers),
    text: checkin ? `check-in: ${fresh} new events, the agent takes a look` : `${crossed.join(", ")} crossed 0.6`,
  });
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

export { describeDiff } from "@/babel/schema/diff";
