// Visitors, visits and pages (demo scope: one Node process, in memory, visitors also kept in .babel/memory.json).
//
// NEXT PAGE ONLY: the page a shopper is reading never changes on its own. Every page opens with a view computed
// here, on the server, before first paint (no LLM in the path): explicit choice → return visit → rules from the
// signal model + the Director's plan, inside the change budget. Only the shopper's own requests (chat, view switch,
// style, Standard view, undo) change the open page.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  BlockId, BrandKit, ExplicitChange, Hypothesis, InteractionEvent, MarkerId, PartnerContext, Persona, Plan, Registry, Skin, Template, View, ViewBlock,
} from "@/babel/schema";
import { computeMarkers, findTriggers, windowWeight, type Snapshot, type VisitEvent } from "@/babel/markers";
import { buildView, moveBlock, NEUTRAL, pickSkin, pinBlocks, readShopper, seeded, standardView, type ShopperRead } from "@/babel/persona";
import type { Groups } from "@/babel/persona/signalModel";
import { changedBlocks, validateView, type Checked } from "@/babel/guardrails/validate";
import { describeChanges, whyLines } from "./why";

// ---------------------------------------------------------------- config (one place)
export const CONFIG = {
  returnAfterMs: Number(process.env.BABEL_RETURN_AFTER_MS ?? 30 * 60_000), // away this long = a return visit
  returnCarry: 0.6,                                                          // how much last visit still counts
  minDirectorGapMs: Number(process.env.BABEL_MIN_DIRECTOR_GAP_MS ?? 8_000),  // nothing moves on screen: pacing is about cost
  maxDirectorRuns: 12,
  checkinMs: Number(process.env.BABEL_CHECKIN_MS ?? 15_000),
  checkinMinEvents: 3,
  carryOverBlocks: 2,
};

// ---------------------------------------------------------------- types
export type Trigger = MarkerId | "stage" | "checkin" | "page_leave";

export type TraceEntry = {
  at: number; // ms since the visit started
  kind: "visit" | "page" | "trigger" | "plan" | "hold" | "result" | "explicit" | "undo" | "guard" | "skip";
  text: string;
  page?: number;
  triggers?: Trigger[];
  markers?: Partial<Record<MarkerId, number>>;
  hypothesis?: Hypothesis;
  diff?: string[];
  errors?: string[][];
  clamps?: string[];
  rounds?: number;
  ms?: number;
  mocked?: boolean;
  met?: boolean | null;
  outcome?: { id: NonNullable<Hypothesis["outcome"]>; met: boolean };
  llm?: { model: string; input: string; rounds: { said: string; call?: { name: string; args: unknown }; verdict: string; ms: number }[] };
};

export type PageRec = {
  index: number;
  id: string;
  template: Template;
  productId?: string;
  path: string;
  openedAt: number;        // visit clock
  confirmed: boolean;      // the browser reported it was shown (renders the client never saw do not count)
  views: View[];           // what this page showed, in order; last = on screen. Explicit changes and undo push here
  planId?: string;         // the Director plan this page opened with, if any
  dialectChanged?: boolean; // this page used the visit's one dialect change
};

export type HypothesisRun = { viewId: string; page: number; planId: string; h: Hypothesis; from: number; scored: boolean };

type VisitMemory = { views: Partial<Record<Template, View>>; blockUse: Partial<Record<Template, Partial<Record<BlockId, number>>>> };
export type Visitor = {
  id: string;
  visits: number;
  lastSeenAt: number;
  groups?: Groups;
  explicit?: ExplicitChange;   // what the shopper asked for; wins over inference (ADR-003) until they change it
  current?: VisitMemory;
  previous?: VisitMemory;
  activeVisitId?: string;
};

export type Visit = {
  id: string;
  store: string;
  visitorId?: string;
  ghost?: string;
  partner: PartnerContext;
  returning: boolean;
  number: number;
  startedAt: number;       // epoch ms
  lastActiveAt: number;    // epoch ms
  pages: PageRec[];
  events: VisitEvent[];
  snapshot: Snapshot;
  shopper: ShopperRead;
  prior?: Groups;
  priorCarry: number;
  dialect?: Persona["dialect"]; // the look settles once per visit (dialectChanges ≤ 1)
  dialectChanges: number;
  typeStep: number;
  skin?: Skin;
  standard: boolean;
  explicit?: ExplicitChange;
  plan?: { id: string; plan: Plan; at: number; previews: Partial<Record<Template, View>> };
  frozen: BlockId[];       // blocks whose change the shopper undid: no plan may touch them again this visit
  directorBusy: boolean;
  directorRuns: number;
  lastDirectorAt?: number;
  eventsAtLastLook: number;
  hypotheses: HypothesisRun[];
  trace: TraceEntry[];
};

// ---------------------------------------------------------------- state
type State = { visits: Map<string, Visit>; visitors: Map<string, Visitor>; save?: ReturnType<typeof setTimeout> };
const g = globalThis as unknown as { __babel?: State };
const memoryFile = () => process.env.BABEL_MEMORY_FILE ?? (process.env.VITEST ? "" : path.join(process.cwd(), ".babel", "memory.json"));
function loadVisitors(): Map<string, Visitor> {
  const f = memoryFile();
  if (!f) return new Map();
  try {
    const all = JSON.parse(readFileSync(f, "utf8")) as Record<string, Visitor>;
    return new Map(Object.entries(all).filter(([, v]) => v && typeof v.lastSeenAt === "number").map(([k, v]) => [k, { ...v, activeVisitId: undefined }]));
  } catch { return new Map(); }
}
const state: State = (g.__babel ??= { visits: new Map<string, Visit>(), visitors: loadVisitors() });
const save = () => {
  const f = memoryFile();
  if (!f || state.save) return;
  state.save = setTimeout(() => {
    state.save = undefined;
    try { mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(Object.fromEntries(state.visitors))); } catch { /* best effort */ }
  }, 400);
};

export const getVisit = (id: string) => state.visits.get(id);
export const listVisits = () => [...state.visits.values()].sort((a, b) => b.lastActiveAt - a.lastActiveAt);
export const getVisitor = (id?: string) => (id ? state.visitors.get(id) : undefined);
export const clock = (v: Visit, now = Date.now()) => now - v.startedAt;
export const currentPage = (v: Visit) => v.pages.at(-1);
export const onScreen = (p: PageRec) => p.views.at(-1)!;

export function forget(visitorId: string) {
  const had = state.visitors.delete(visitorId);
  for (const v of state.visits.values()) if (v.visitorId === visitorId) { v.visitorId = undefined; v.standard = true; }
  save();
  return had;
}
/** Demo: pretend the shopper's last visit was days ago, so the next page starts a return visit. */
export function ageVisitor(visitorId: string) {
  const r = state.visitors.get(visitorId);
  if (!r) return;
  r.lastSeenAt = Date.now() - CONFIG.returnAfterMs - 1_000;
  r.activeVisitId = undefined;
  save();
}
export function resetAll() { state.visits.clear(); state.visitors.clear(); save(); }

// ---------------------------------------------------------------- opening a page

export type StoreCfg = { registry: Registry; brand: BrandKit };
export type OpenArgs = {
  store: string; cfg: StoreCfg; template: Template; productId?: string; path: string;
  partner: PartnerContext; visitorId?: string; ghost?: string; now?: number;
};
export type Opened = { visitId: string; pageId: string; view: View; why: string[]; changes: string[] };

function startVisit(a: OpenArgs, now: number): Visit {
  const consented = a.partner.consent.personalization && a.visitorId ? a.visitorId : undefined;
  let visitor = getVisitor(consented);
  const returning = !!visitor && now - visitor.lastSeenAt > CONFIG.returnAfterMs;
  if (consented) {
    if (!visitor) state.visitors.set(consented, (visitor = { id: consented, visits: 0, lastSeenAt: now }));
    visitor.visits += 1;
    if (visitor.current) visitor.previous = visitor.current;
    visitor.current = { views: {}, blockUse: {} };
  }
  const partner: PartnerContext = returning
    ? { ...a.partner, visitor: { returning: true, visits: Math.max(a.partner.visitor.visits, visitor!.visits) } }
    : a.partner;
  const prior = visitor?.groups;
  const priorCarry = returning ? CONFIG.returnCarry : 1;
  const v: Visit = {
    id: crypto.randomUUID(), store: a.store, visitorId: consented, ghost: a.ghost, partner, returning: returning || a.partner.visitor.returning,
    number: visitor?.visits ?? 1, startedAt: now, lastActiveAt: now, pages: [], events: [],
    snapshot: computeMarkers([], 0), shopper: readShopper(partner, [], prior, priorCarry), prior, priorCarry,
    dialectChanges: 0, typeStep: 0, standard: !a.partner.consent.personalization, explicit: visitor?.explicit,
    frozen: [], directorBusy: false, directorRuns: 0, eventsAtLastLook: 0, hypotheses: [],
    trace: [{ at: 0, kind: "visit", text: !a.partner.consent.personalization ? "no consent: standard store, nothing collected" : returning ? `return visit #${visitor!.visits}` : "new visit" }],
  };
  if (visitor) { visitor.activeVisitId = v.id; visitor.lastSeenAt = now; save(); }
  state.visits.set(v.id, v);
  return v;
}

function resolveVisit(a: OpenArgs, now: number): Visit {
  const visitor = getVisitor(a.partner.consent.personalization ? a.visitorId : undefined);
  const active = visitor?.activeVisitId ? state.visits.get(visitor.activeVisitId) : undefined;
  if (active && now - active.lastActiveAt < CONFIG.returnAfterMs && active.store === a.store) return active;
  return startVisit(a, now);
}

const lastViewOf = (v: Visit, template: Template) => [...v.pages].reverse().find((p) => p.template === template && p.confirmed);

/** Apply an explicit request (or the pinned one) on top of a view. */
export function withExplicit(base: View, x: ExplicitChange, cfg: StoreCfg, ctx: PartnerContext): View {
  const persona = { dialect: x.dialect ?? base.persona.dialect, need: x.need ?? base.persona.need, confidence: 1 };
  const rebuilt = x.dialect || x.need
    ? buildView({ persona, template: base.template, registry: cfg.registry, brand: cfg.brand, ctx, skin: base.skin, copyRegister: x.copyRegister })
    : structuredClone(base);
  let blocks = rebuilt.blocks;
  for (const c of x.changes ?? []) {
    const b = blocks.find((y) => y.id === c.id);
    if (!b) continue;
    if (c.variant) b.variant = c.variant;
    if (c.collapsed !== undefined) b.collapsed = c.collapsed;
    if (c.order) blocks = moveBlock(blocks, c.id, c.order);
  }
  const typeScale = Math.round((rebuilt.theme.typeScale + (x.typeScaleStep ?? 0) * 0.1) * 100) / 100;
  return {
    ...rebuilt, id: `${base.template}-${Math.random().toString(36).slice(2, 10)}`, kind: "explicit", source: "shopper", persona,
    blocks, theme: { ...rebuilt.theme, typeScale }, skin: x.skin ?? base.skin, copyRegister: x.copyRegister ?? rebuilt.copyRegister,
    rationale: "The view you asked for.",
  };
}

function applyPlan(view: View, plan: Plan): View {
  let blocks = structuredClone(view.blocks);
  for (const c of plan.changes.filter((x) => x.template === view.template)) {
    const b = blocks.find((y) => y.id === c.id);
    if (!b) continue;
    if (c.variant) b.variant = c.variant;
    if (c.collapsed !== undefined) b.collapsed = c.collapsed;
  }
  for (const c of plan.changes.filter((x) => x.template === view.template && x.order)) blocks = moveBlock(blocks, c.id, c.order!);
  return { ...view, blocks, source: "director", rationale: plan.rationale, hypothesis: plan.hypothesis };
}

/** The 2 blocks the shopper used most on this page type last visit, exactly as they were. */
function carryOver(visitor: Visitor | undefined, template: Template): ViewBlock[] {
  const last = visitor?.previous;
  const view = last?.views[template];
  if (!view) return [];
  const use = last.blockUse[template] ?? {};
  return (Object.entries(use) as [BlockId, number][])
    .sort((a, b) => b[1] - a[1]).slice(0, CONFIG.carryOverBlocks)
    .flatMap(([id]) => view.blocks.filter((b) => b.id === id && !b.collapsed));
}

type Candidate = { view: View; budgetRef?: View; dialectChange: boolean };

/** What this page type would open with right now (also used to preview a plan before accepting it). */
export function candidateView(v: Visit, cfg: StoreCfg, template: Template, plan?: Plan): Candidate & { carry: ViewBlock[]; kind: View["kind"] } {
  const first = v.pages.length === 0;
  const read = v.shopper;
  const confident = read.persona.confidence > 0;
  const skin = v.skin ?? "alpha";
  const ref = lastViewOf(v, template);
  // Return visit, first page: rebuilt from what was remembered, with the most-used blocks carried over.
  if (first && v.returning && getVisitor(v.visitorId)?.previous) {
    const carry = carryOver(getVisitor(v.visitorId), template);
    let view = buildView({ persona: read.persona, template, registry: cfg.registry, brand: cfg.brand, ctx: v.partner, kind: "return", source: "memory", copyRegister: read.model.copyRegister, skin });
    for (const k of carry) {
      const b = view.blocks.find((x) => x.id === k.id);
      if (b) { b.variant = k.variant; b.collapsed = false; }
    }
    view = { ...view, blocks: pinBlocks(view.blocks, carry) };
    view.keep = carry.map((k) => k.id);
    view.rationale = "Welcome back. This page starts from what you used last time; the parts you used most stay where they were.";
    return { view, carry, kind: "return", dialectChange: false };
  }
  const settled = v.dialect;
  let dialect = plan?.dialect ?? read.persona.dialect;
  const dialectChange = !first && !!settled && dialect !== settled;
  if (dialectChange && v.dialectChanges >= 1) dialect = settled!;
  const need = plan?.need ?? read.persona.need;
  const persona: Persona = { dialect, need, confidence: plan ? Math.max(read.persona.confidence, 0.6) : read.persona.confidence };
  const steps = v.typeStep + (plan?.typeScaleStep ?? 0);
  let view = buildView({
    persona, template, registry: cfg.registry, brand: cfg.brand, ctx: v.partner, kind: first ? "first" : "next",
    source: confident || plan ? "rules" : "none", copyRegister: plan?.copyRegister ?? read.model.copyRegister, skin, typeScaleStep: steps,
  });
  if (plan) view = applyPlan(view, plan);
  if (ref) view.keep = onScreen(ref).keep; // carried-over blocks stay carried over for the whole visit
  return { view, carry: [], kind: view.kind, budgetRef: ref ? onScreen(ref) : undefined, dialectChange: dialect !== (settled ?? dialect) };
}

/** What a page type would open with on the shopper's NEXT navigation (never "first page of the visit"). */
export function nextCandidate(v: Visit, cfg: StoreCfg, template: Template, plan?: Plan) {
  const asLater = v.pages.length ? v : ({ ...v, pages: [{ index: 0, template: "home", confirmed: false, views: [] } as unknown as PageRec] } as Visit);
  return candidateView(asLater, cfg, template, plan);
}

function check(v: Visit, cfg: StoreCfg, c: ReturnType<typeof candidateView>): Checked {
  return validateView(c.view, cfg.registry, cfg.brand, {
    reference: c.budgetRef?.kind === "standard" ? undefined : c.budgetRef,
    // The look may differ from the last view of THIS page type when the visit already settled it on another page.
    dialectChangeAllowed: v.dialectChanges < 1 || !c.dialectChange,
    carryOver: c.carry,
  });
}

export function openPage(a: OpenArgs): Opened {
  const now = a.now ?? Date.now();
  const v = resolveVisit(a, now);
  v.lastActiveAt = now;
  // A render the browser never confirmed (a reload, a dev-server refresh) is replaced, not counted twice.
  const stale = v.pages.at(-1);
  if (stale && !stale.confirmed && stale.path === a.path) {
    v.pages.pop();
    if (stale.dialectChanged) v.dialectChanges -= 1;
    const before = v.pages.at(-1);
    v.dialect = before ? onScreen(before).persona.dialect : undefined;
  }
  let dialectChanged = false;
  const index = v.pages.length;
  const at = clock(v, now);
  let view: View;
  let planId: string | undefined;
  const log: string[] = [];

  if (v.standard) {
    view = standardView(a.template, a.cfg.registry, a.cfg.brand, v.partner);
  } else {
    const withPlan = v.plan && !v.explicit ? candidateView(v, a.cfg, a.template, v.plan.plan) : undefined;
    const rules = candidateView(v, a.cfg, a.template);
    let chosen = withPlan;
    let checked = withPlan && check(v, a.cfg, withPlan);
    if (checked && !checked.ok) { log.push(`plan not applied here: ${checked.errors.join("; ")}`); chosen = undefined; checked = undefined; }
    if (!checked) { chosen = rules; checked = check(v, a.cfg, rules); }
    if (!checked.ok) {
      log.push(`rules view refused: ${checked.errors.join("; ")}`);
      const ref = lastViewOf(v, a.template);
      view = ref ? { ...onScreen(ref), id: `${a.template}-${Math.random().toString(36).slice(2, 10)}`, kind: "next" } : standardView(a.template, a.cfg.registry, a.cfg.brand, v.partner);
    } else {
      view = checked.view;
      if (checked.clamps.length) log.push(`brand clamp: ${checked.clamps.join("; ")}`);
      if (chosen === withPlan) planId = v.plan!.id;
      if (chosen!.dialectChange) { v.dialectChanges += 1; dialectChanged = true; }
    }
    if (v.explicit) view = withExplicitChecked(v, a.cfg, view, v.explicit, log);
    v.dialect = view.persona.dialect;
    // The skin is rolled once per visit, the first time Babel has a confident read (team policy: 25%, weighted).
    if (!v.skin && v.shopper.persona.confidence > 0) {
      v.skin = pickSkin(v.shopper.persona, seeded(`${v.visitorId ?? v.id}:${v.number}`));
      if (!v.explicit?.skin) view = { ...view, skin: v.skin };
    }
  }
  if (!v.partner.consent.personalization) view = { ...view, skin: "none" };

  const prevSame = lastViewOf(v, a.template);
  const page: PageRec = { index, id: crypto.randomUUID(), template: a.template, productId: a.productId, path: a.path, openedAt: at, confirmed: false, views: [view], planId, dialectChanged };
  v.pages.push(page);
  const changes = describeChanges(prevSame ? onScreen(prevSame) : undefined, view, a.cfg.registry);
  v.trace.push({
    at, kind: "page", page: index, text: `page ${index + 1} (${a.template}${a.productId ? ` ${a.productId}` : ""}) opens as ${view.kind}: ${view.persona.dialect} × ${view.persona.need}${planId ? " · from the agent's plan" : ""}`,
    diff: [...changes, ...log], hypothesis: view.hypothesis,
  });
  const visitor = getVisitor(v.visitorId);
  if (visitor?.current) { visitor.current.views[a.template] = view; save(); }
  return {
    visitId: v.id, pageId: page.id, view, changes,
    why: whyLines(v.events, view, { returning: v.returning && index === 0, declaredLargeText: !!v.partner.account?.accessibility?.largeText }),
  };
}

function withExplicitChecked(v: Visit, cfg: StoreCfg, base: View, x: ExplicitChange, log: string[]): View {
  const r = validateView(withExplicit(base, x, cfg, v.partner), cfg.registry, cfg.brand, { dialectChangeAllowed: true });
  if (r.ok) return r.view;
  log.push(`pinned choice not applicable here: ${r.errors.join("; ")}`);
  return base;
}

// ---------------------------------------------------------------- events

const ENGAGE = new Set(["block_open", "block_dwell", "review_open", "policy_open", "compare_add", "add_to_cart", "gallery_swipe", "image_zoom", "filter", "sort", "hover_price"]);
const values = (s: Snapshot) => Object.fromEntries(Object.entries(s.markers).map(([k, m]) => [k, m!.value])) as Partial<Record<MarkerId, number>>;

export function recordEvents(v: Visit, pageId: string, events: InteractionEvent[], now = Date.now()): { look: Trigger[] } {
  const page = v.pages.find((p) => p.id === pageId);
  if (!page || !v.partner.consent.personalization || !v.visitorId && !v.ghost) return { look: [] };
  if (!page.confirmed) {
    page.confirmed = true;
    const h = onScreen(page).hypothesis;
    if (h && page.planId) v.hypotheses.push({ viewId: onScreen(page).id, page: page.index, planId: page.planId, h, from: clock(v, now), scored: false });
  }
  v.lastActiveAt = now;
  const shown = onScreen(page);
  const adapted = shown.kind !== "standard" && shown.source !== "none";
  const placed: VisitEvent[] = events.map((e) => ({ ...e, t: page.openedAt + e.t, page: page.index, adapted }));
  v.events.push(...placed);
  v.events.sort((a, b) => a.t - b.t);
  const visitor = getVisitor(v.visitorId);
  if (visitor?.current) {
    const use = (visitor.current.blockUse[page.template] ??= {});
    for (const e of placed) if (e.blockId && ENGAGE.has(e.type)) use[e.blockId] = (use[e.blockId] ?? 0) + 1;
  }
  if (v.standard) return { look: [] };

  const t = Math.max(clock(v, now), ...v.events.map((e) => e.t));
  const prev = v.snapshot;
  v.snapshot = computeMarkers(v.events, t);
  v.shopper = readShopper(v.partner, v.events, v.prior, v.priorCarry);
  if (visitor && v.shopper.profile) { visitor.groups = v.shopper.profile.groups; visitor.lastSeenAt = now; save(); }
  scoreHypotheses(v, t);

  const crossed: Trigger[] = findTriggers(prev, v.snapshot);
  const fresh = v.events.length - v.eventsAtLastLook;
  const checkin = !crossed.length && CONFIG.checkinMs > 0 && t - (v.lastDirectorAt ?? 0) >= CONFIG.checkinMs && fresh >= CONFIG.checkinMinEvents;
  const want: Trigger[] = crossed.length ? crossed : checkin ? ["checkin"] : [];
  if (!want.length) return { look: [] };
  const gate = canLook(v, t, false);
  if (!gate.ok) {
    if (crossed.length) v.trace.push({ at: t, kind: "skip", text: `${crossed.join(", ")} crossed, but ${gate.why}`, triggers: crossed });
    return { look: [] };
  }
  v.trace.push({ at: t, kind: "trigger", triggers: want, markers: values(v.snapshot), text: checkin ? `check-in: ${fresh} new events` : crossed.map((x) => (x === "stage" ? `stage → ${v.snapshot.stage}` : `${x} crossed 0.6`)).join(", ") });
  return { look: want };
}

export function canLook(v: Visit, t: number, leaving: boolean): { ok: true } | { ok: false; why: string } {
  if (v.standard) return { ok: false, why: "Standard view is on" };
  if (v.explicit?.dialect || v.explicit?.need) return { ok: false, why: "the shopper chose their own view" };
  if (v.directorBusy) return { ok: false, why: "the agent is still thinking" };
  if (v.directorRuns >= CONFIG.maxDirectorRuns) return { ok: false, why: "the agent's limit for this visit is reached" };
  if (!leaving && v.lastDirectorAt !== undefined && t - v.lastDirectorAt < CONFIG.minDirectorGapMs) return { ok: false, why: "the agent looked moments ago" };
  if (leaving && v.events.length === v.eventsAtLastLook) return { ok: false, why: "nothing new since the agent last looked" };
  return { ok: true };
}

function outcomeMet(id: NonNullable<Hypothesis["outcome"]>, events: VisitEvent[], from: number, to: number) {
  const after = events.filter((e) => e.t >= from && e.t < to);
  if (id === "cart") return after.filter((e) => e.type === "add_to_cart" || e.type === "remove_from_cart").at(-1)?.type === "add_to_cart";
  if (id === "checkout") return after.some((e) => e.type === "checkout_start");
  if (id === "stay") return after.some((e) => e.t >= from + (to - from) / 2);
  return !after.some((e) => e.type === "view_undo" || (e.type === "view_switch" && e.value === "standard"));
}

/** A bet is scored on behaviour in the window after the view vs. an equal window before it — never on a decayed value. */
export function scoreHypotheses(v: Visit, now: number) {
  for (const r of v.hypotheses) {
    if (r.scored) continue;
    const w = r.h.withinSeconds * 1000;
    if (now < r.from + w) continue;
    r.scored = true;
    const after = windowWeight(r.h.marker, v.events, r.from, r.from + w);
    const before = windowWeight(r.h.marker, v.events, r.from - w, r.from);
    const active = v.events.some((e) => e.t >= r.from && e.t < r.from + w);
    const met = !active ? null : r.h.expect === "up" ? after > before : after < before;
    const out = r.h.outcome ? { id: r.h.outcome, met: outcomeMet(r.h.outcome, v.events, r.from, r.from + w) } : undefined;
    v.trace.push({
      at: now, kind: "result", page: r.page, met, hypothesis: r.h, outcome: out,
      text: `page ${r.page + 1} bet: ${r.h.marker} ${r.h.expect} → ${met === null ? "no data (no activity in the window)" : met ? "met" : "not met"} (behaviour ${before.toFixed(2)} before vs ${after.toFixed(2)} after)` +
        (out ? ` · outcome "${out.id}": ${out.met ? "met" : "not met"}` : ""),
    });
  }
}

// ---------------------------------------------------------------- the Director's plan

/** Check a plan by building every page type it would shape and validating each. Returns errors for the agent. */
export function previewPlan(v: Visit, cfg: StoreCfg, plan: Plan): { ok: true; previews: Partial<Record<Template, View>> } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (plan.dialect && v.dialect && plan.dialect !== v.dialect && v.dialectChanges >= 1) errors.push("the look (dialect) already changed once this visit; leave `dialect` out");
  const frozen = plan.changes.filter((c) => v.frozen.includes(c.id)).map((c) => c.id);
  if (frozen.length) errors.push(`the shopper undid changes to ${[...new Set(frozen)].join(", ")}; do not touch them again this visit`);
  const previews: Partial<Record<Template, View>> = {};
  for (const template of Object.keys(cfg.registry) as Template[]) {
    for (const c of plan.changes.filter((x) => x.template === template)) {
      const spec = cfg.registry[template]?.[c.id];
      if (!spec) errors.push(`${template}: block "${c.id}" does not exist on this page type`);
      else if (c.variant && !spec.variants.includes(c.variant)) errors.push(`${template}.${c.id}: no variant "${c.variant}" (allowed: ${spec.variants.join(", ")})`);
    }
    const r = check(v, cfg, nextCandidate(v, cfg, template, plan));
    if (r.ok) previews[template] = r.view;
    else errors.push(...r.errors.map((e) => `${template}: ${e}`));
  }
  return errors.length ? { ok: false, errors: [...new Set(errors)] } : { ok: true, previews };
}

export function acceptPlan(v: Visit, plan: Plan, previews: Partial<Record<Template, View>>) {
  v.plan = { id: crypto.randomUUID().slice(0, 8), plan, at: clock(v), previews };
  if (plan.typeScaleStep) v.typeStep = Math.max(-1, Math.min(2, v.typeStep + plan.typeScaleStep));
  return v.plan;
}

// ---------------------------------------------------------------- what the shopper asks for on the open page

export type ViewAction =
  | { action: "explicit"; change: ExplicitChange; via: "chat" | "view_switch" | "style" }
  | { action: "standard"; on: boolean }
  | { action: "undo" };

export function changeOpenPage(v: Visit, pageId: string, cfg: StoreCfg, a: ViewAction): { ok: true; view: View; why: string[]; changes: string[] } | { ok: false; error: string } {
  const page = v.pages.find((p) => p.id === pageId);
  if (!page) return { ok: false, error: "unknown page" };
  const at = clock(v);
  const shown = onScreen(page);
  let next: View;
  if (a.action === "standard") {
    v.standard = a.on;
    v.trace.push({ at, kind: "explicit", page: page.index, text: a.on ? "shopper turned on Standard view: no adaptation for the rest of the visit" : "shopper turned Standard view off" });
    v.events.push({ t: at, page: page.index, type: "view_switch", value: a.on ? "standard" : "babel" });
    if (a.on) next = standardView(page.template, cfg.registry, cfg.brand, v.partner);
    else {
      const c = candidateView(v, cfg, page.template, v.plan?.plan);
      const r = validateView({ ...c.view, kind: "explicit" }, cfg.registry, cfg.brand, { dialectChangeAllowed: true });
      next = r.ok ? { ...r.view, kind: c.view.kind } : standardView(page.template, cfg.registry, cfg.brand, v.partner);
      if (!r.ok) v.standard = true;
    }
  } else if (a.action === "undo") {
    if (page.views.length > 1) next = page.views[page.views.length - 2];
    else if (shown.kind !== "standard") next = standardView(page.template, cfg.registry, cfg.brand, v.partner);
    else return { ok: false, error: "nothing to undo on this page" };
    // Undoing an adaptation is a "no": those blocks are left alone for the rest of the visit, and the agent is told.
    const undone = changedBlocks(next.blocks, shown.blocks);
    v.frozen = [...new Set([...v.frozen, ...undone])];
    if (shown.kind === "explicit") v.explicit = undefined;
    v.events.push({ t: at, page: page.index, type: "view_undo", value: shown.kind });
    v.trace.push({ at, kind: "undo", page: page.index, text: `shopper undid the ${shown.kind} view; frozen for this visit: ${undone.join(", ") || "nothing"}` });
    page.views.push(next);
    v.snapshot = computeMarkers(v.events, at);
    return { ok: true, view: next, why: whyLines(v.events, next), changes: describeChanges(shown, next, cfg.registry) };
  } else {
    if (v.standard) return { ok: false, error: "Standard view is on. Turn it off to change the page." };
    const steps = Math.max(-3, Math.min(3, (v.explicit?.typeScaleStep ?? 0) + (a.change.typeScaleStep ?? 0)));
    const merged: ExplicitChange = { ...v.explicit, ...a.change, typeScaleStep: steps || undefined, changes: a.change.changes };
    const r = validateView(withExplicit(shown, a.change, cfg, v.partner), cfg.registry, cfg.brand, { dialectChangeAllowed: true });
    if (!r.ok) {
      v.trace.push({ at, kind: "guard", page: page.index, text: `explicit change refused (${a.via})`, errors: [r.errors] });
      return { ok: false, error: r.errors.join("; ") };
    }
    next = r.view;
    // Pinned: the shopper's own choice wins over inference on every later page (ADR-003). Block changes stay on this page.
    v.explicit = { ...merged, changes: undefined };
    const visitor = getVisitor(v.visitorId);
    if (visitor) { visitor.explicit = v.explicit; save(); }
    v.events.push({ t: at, page: page.index, type: a.via === "chat" ? "chat_message" : "view_switch", value: a.via });
    v.trace.push({ at, kind: "explicit", page: page.index, text: `shopper asked (${a.via}): ${JSON.stringify(a.change)}`, clamps: r.clamps, diff: describeChanges(shown, next, cfg.registry) });
  }
  page.views.push(next);
  return { ok: true, view: next, why: whyLines(v.events, next), changes: describeChanges(shown, next, cfg.registry) };
}

/** Clear the shopper's pinned choice (the "Let Babel choose again" button). */
export function clearExplicit(v: Visit) {
  v.explicit = undefined;
  const visitor = getVisitor(v.visitorId);
  if (visitor) { visitor.explicit = undefined; save(); }
}

export { NEUTRAL };
