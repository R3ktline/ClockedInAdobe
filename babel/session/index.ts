// Visit state shared by the API routes (demo scope: one Node process, no database), plus the per-visitor
// memory that survives restarts.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  Hypothesis, InteractionEvent, MarkerId, Markers, PartnerContext, Persona, Slide, Template,
} from "@/babel/schema";
import { computeMarkers, findTriggers } from "@/babel/markers";
import { readShopper } from "@/babel/persona";
import { TRAIT_NAMES, TRAITS, type Groups } from "@/babel/persona/signalModel";
import type { LlmTranscript } from "@/babel/agents/director";

// "checkin" = a routine look by the agent; "zoom" = the shopper zoomed the page in; "chat" = the shopper typed a request.
export type Trigger = MarkerId | "checkin" | "zoom" | "chat";

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
  slideIndex?: number; // on "result": which slide the bet was about (Insights reads it)
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
  zoom: number;            // current page zoom relative to page load
  shopper?: ReturnType<typeof readShopper>; // David's signal model, re-read on every batch of events
  visitorId?: string;      // set only with consent; keys the cross-page memory
  prior?: Groups;          // what this shopper's earlier pages taught the model
  directorBusy: boolean;
  lastDirectorSlideAt?: number;
  minorCount: number;
  standardView: boolean;
};

// How much the agent is let loose (BABEL_INTERVENTION): "normal" is the original pacing, "high" (default) lets it
// look sooner and change the page more often. The change budget per slide (validateSlide) is the same at both.
const HIGH = (process.env.BABEL_INTERVENTION ?? "high") !== "normal";
const MIN_GAP_MS = Number(process.env.BABEL_MIN_SLIDE_GAP_MS ?? (HIGH ? 8_000 : 20_000));
const MAX_MINOR_SLIDES = HIGH ? 12 : 5;
// The agent also takes a look on its own after this long with new activity, so changes are not only
// threshold-driven. 0 turns check-ins off.
const CHECKIN_MS = Number(process.env.BABEL_CHECKIN_MS ?? (HIGH ? 5_000 : 15_000));
const CHECKIN_MIN_EVENTS = HIGH ? 2 : 3;

// A visitor who comes back after this long is a return visit (the only time a major slide is allowed).
const RETURN_AFTER_MS = Number(process.env.BABEL_RETURN_AFTER_MS ?? 30 * 60_000);

// Cross-visit memory, consented visitors only: per random visitor id, what the signal model learned, the
// last view the agent chose for each page type, and when we last saw them. Kept in .babel/memory.json so a
// server restart does not wipe it (BABEL_MEMORY_FILE overrides; off under vitest).
// shortcut: one JSON file, one process, no locking; swap for a database when there is more than one server.
type Remembered = { groups?: Groups; slides: Partial<Record<Template, Slide>>; visits: number; lastSeenAt: number };
const memoryFile = () => process.env.BABEL_MEMORY_FILE ?? (process.env.VITEST ? "" : path.join(process.cwd(), ".babel", "memory.json"));

function readMemory(): Map<string, Remembered> {
  try {
    const all = JSON.parse(readFileSync(memoryFile(), "utf8")) as Record<string, Remembered>;
    return new Map(Object.entries(all).filter(([, r]) => r && typeof r.slides === "object" && typeof r.lastSeenAt === "number"));
  } catch { return new Map(); } // no file yet, or unreadable: start empty
}

const g = globalThis as unknown as { __babelVisits?: Map<string, Visit>; __babelRemembered?: Map<string, Remembered>; __babelSave?: ReturnType<typeof setTimeout> };
const visits: Map<string, Visit> = (g.__babelVisits ??= new Map());
const memory: Map<string, Remembered> = (g.__babelRemembered ??= readMemory());

export function writeMemory() {
  const f = memoryFile();
  if (!f) return;
  try { mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(Object.fromEntries(memory))); } catch { /* best effort */ }
}
export function reloadMemory() { memory.clear(); for (const [k, v] of readMemory()) memory.set(k, v); }
const save = () => { g.__babelSave ??= setTimeout(() => { g.__babelSave = undefined; writeMemory(); }, 500); };

function remember(id: string, patch: Partial<Remembered>) {
  memory.set(id, { slides: {}, visits: 1, lastSeenAt: Date.now(), ...memory.get(id), ...patch });
  save();
}

// What is kept about a visitor, for the debug panel.
export const memoryOf = (visitorId?: string) => {
  const r = visitorId ? memory.get(visitorId) : undefined;
  return r && { visits: r.visits, lastSeenAt: r.lastSeenAt, hasProfile: !!r.groups, remembered: Object.keys(r.slides).filter((t) => r.slides[t as Template]) };
};
export const recall = (visitorId?: string) => (visitorId ? memory.get(visitorId)?.groups : undefined);
export const recallSlide = (visitorId: string | undefined, template: Template) => (visitorId ? memory.get(visitorId)?.slides[template] : undefined);
export const forget = (visitorId: string) => { const had = memory.delete(visitorId); save(); return had; };

// Called when a page opens. Coming back after a long gap makes this a return visit.
export function startSession(visitorId: string, now = Date.now()): { returning: boolean; visits: number } {
  const r = memory.get(visitorId);
  const returning = !!r && now - r.lastSeenAt > RETURN_AFTER_MS;
  const n = r ? r.visits + (returning ? 1 : 0) : 1;
  remember(visitorId, { visits: n, lastSeenAt: now });
  return { returning, visits: n };
}
// A return visit hands back what the browser kept (consented localStorage), already scaled down.
export const rememberGroups = (visitorId: string, groups: Groups) => remember(visitorId, { groups });

export const getVisit = (id: string) => visits.get(id);
export const listVisits = () => [...visits.values()].sort((a, b) => b.startedAt - a.startedAt);
export const elapsed = (v: Visit) => Date.now() - v.startedAt;

export function createVisit(init: {
  store: string; template: Template; productId?: string; partner: PartnerContext; persona: Persona; slide: Slide; reasons: string[];
  visitorId?: string;
}): Visit {
  const v: Visit = {
    id: crypto.randomUUID(),
    store: init.store,
    template: init.template,
    productId: init.productId,
    partner: init.partner,
    returning: init.partner.visitor.returning,
    visitorId: init.partner.consent.personalization ? init.visitorId : undefined,
    prior: init.partner.consent.personalization ? recall(init.visitorId) : undefined,
    startedAt: Date.now(),
    events: [],
    markers: {},
    slides: [init.slide],
    slideAt: { [init.slide.id]: { t: 0, markers: {} } },
    scored: [],
    trace: [{ at: 0, kind: "visit", text: `slide 0 from ${init.slide.source === "cache" ? "memory" : "rules"}: ${init.persona.dialect} × ${init.persona.need}`, diff: init.reasons }],
    pendingTriggers: [],
    lastLookAt: 0,
    eventsAtLastLook: 0,
    zoom: 1,
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
  // Zooming in is a direct sign the text is too small: act on it now, don't wait for a threshold.
  let zoomedTo = 0; // highest zoom-in in this batch, 0 if none
  for (const e of events) {
    if (e.type !== "page_zoom" || typeof e.value !== "number") continue;
    if (e.value >= v.zoom + 0.1) zoomedTo = Math.max(zoomedTo, e.value);
    v.zoom = e.value;
  }
  const zoomedIn = zoomedTo > 0;
  if (events.some((e) => e.type === "view_switch" && e.value === "standard")) v.standardView = true;
  if (!v.partner.consent.personalization) return { trigger: false }; // no consent: no markers (GUARDRAILS §2)

  const now = Math.max(elapsed(v), ...v.events.map((e) => e.t));
  const prev = v.markers;
  v.markers = computeMarkers(v.events, now);
  v.shopper = readShopper(v.partner, v.events, v.prior);
  if (v.visitorId && v.shopper.profile) remember(v.visitorId, { groups: v.shopper.profile.groups, lastSeenAt: Date.now() });
  // Going back from a view is a "no": do not bring it back as this page type's starting view.
  if (v.visitorId && events.some((e) => e.type === "slide_prev")) remember(v.visitorId, { slides: { ...memory.get(v.visitorId)?.slides, [v.template]: undefined } });
  scoreHypotheses(v, now);

  const crossed: Trigger[] = [...findTriggers(prev, v.markers), ...(zoomedIn ? ["zoom" as const] : [])];
  const fresh = v.events.length - v.eventsAtLastLook;
  const checkin = !crossed.length && CHECKIN_MS > 0 && now - v.lastLookAt >= CHECKIN_MS && fresh >= CHECKIN_MIN_EVENTS;
  if ((!crossed.length && !checkin) || v.standardView) return { trigger: false };
  const tooSoon = !zoomedIn && v.lastDirectorSlideAt !== undefined && now - v.lastDirectorSlideAt < MIN_GAP_MS;
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
    text: checkin ? `check-in: ${fresh} new events, the agent takes a look`
      : crossed.map((t) => (t === "zoom" ? `zoomed in to ${Math.round(zoomedTo * 100)}%` : `${t} crossed 0.6`)).join(", "),
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
      at: now, kind: "result", met, hypothesis: s.hypothesis, slideIndex: s.index,
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
  // The agent's latest accepted view becomes what this page type opens with next time.
  if (v.visitorId && slide.source === "director") remember(v.visitorId, { slides: { ...memory.get(v.visitorId)?.slides, [v.template]: slide } });
}

export { describeDiff } from "@/babel/schema/diff";

// The signal model's read of the shopper in the team's marker names, for the Director and /merchant.
export function shopperSummary(v: Visit) {
  const p = v.shopper?.profile;
  if (!p) return null;
  const m = v.shopper!.model;
  return {
    suggested: { dialect: m.dialect, need: m.need, confidence: m.confidence, dialectWhy: m.dialectWhy, needWhy: m.needWhy, copyRegister: m.copyRegister, giftContext: m.giftContext },
    traits: Object.fromEntries(TRAITS.map((t) => [TRAIT_NAMES[t], { value: p.traits[t].value, confidence: p.traits[t].conf }])),
    stage: p.stage,
    buyingFor: p.buyingFor,
  };
}
