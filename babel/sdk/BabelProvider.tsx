"use client";
// The one integration point a store uses (SPEC §7.1). Starts the visit, collects interaction
// signals, asks for a new slide at pauses, and applies slides with the store's brand kit.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import type { LlmTranscript } from "@/babel/agents/director";
import { changedBlocks, describeDiff } from "@/babel/schema/diff";
import { buildSlide, NEUTRAL_PERSONA } from "@/babel/persona";
import type { BlockId, BrandKit, EventType, InteractionEvent, PartnerContext, Registry, Slide, Template } from "@/babel/schema";
import { DebugPanel } from "./DebugPanel";
import { GhostCursorView, runGhost, type GhostControl, type GhostCursor, type GhostPlayback } from "./Ghost";
import { LabPanel, memoryKey, type SavedMemory } from "./LabPanel";
import { SlideControl } from "./SlideControl";
import { ChatBox } from "./ChatBox";
import { Curtain, CURTAIN_OFF, type CurtainState } from "./Curtain";
import { flushSync } from "react-dom";
import { Invite, TransitionLab, ViewNotice, type Transition } from "./Adapt";

type TrackExtra = Omit<InteractionEvent, "t" | "type">;

type BabelContext = {
  store: string;
  template: Template;
  registry: Registry;
  brand: BrandKit;
  slide: Slide;          // what is on screen now
  slides: Slide[];
  cursor: number;
  standard: boolean;
  changed: ReadonlySet<BlockId>;
  ghost?: { label: string; note: string; step: number } & LabInfo;
  visitId: string | null;
  // Lab: the ghost's playback, and controls to pause it or go one step at a time.
  player?: { state: GhostPlayback | null; pause: () => void; play: () => void; step: () => void; setStepMode: (on: boolean) => void };
  apply: Apply;
  calm: CalmEntry[];
  agent: AgentStatus;
  lastChange: LastChange | null;
  track: (type: EventType, extra?: TrackExtra) => void;
  go: (delta: -1 | 1) => void;
  setStandard: (on: boolean) => void;
  forgetMe: () => Promise<void>;
  askNow: () => Promise<void>; // debug: ask the agent to look right now, whatever the pacing says
  chat: (message: string) => Promise<string>; // the shopper's typed request; resolves to the agent's answer in words
};

// How a new slide reaches a page the shopper is looking at (?apply=…):
//   quiet (default) waits until the changed blocks are off screen, and keeps page-wide changes for the next page;
//   live applies at once (the old behaviour); next never changes the page, only what the next page opens with.
export type Apply = "live" | "quiet" | "next";
// One line per slide for the ghost's "unnoticed" check. seen = the shopper could have noticed it happen.
export type CalmEntry = { view: number; status: "unseen" | "seen" | "waiting" | "requested"; text: string };

// What the Babel agent is doing right now, for the testing overlay.
export type AgentStatus = { state: "idle" | "thinking" | "changed" | "held"; text: string; llm?: LlmTranscript };
// The literal changes between the previous and the current view, in the store's own block names.
export type LastChange = { from: number; to: number; lines: string[]; rationale: string; at: number };

const Ctx = createContext<BabelContext | null>(null);

export function useBabel(): BabelContext {
  const c = useContext(Ctx);
  if (!c) throw new Error("useBabel must be used inside <BabelProvider>");
  return c;
}

const PAUSE_MS = 2000;   // a slide lands only after the shopper has stopped scrolling this long
const IDLE_MS = 5000;
const FLUSH_MS = 800;
const NOISY = new Set<EventType>(["hover_price", "image_zoom", "gallery_swipe"]);
const NOISY_GAP_MS = 10_000;
const GAP: Record<Slide["theme"]["density"], string> = { airy: "2rem", comfortable: "1.25rem", compact: "0.75rem" };

export type BabelProviderProps = {
  store: string;
  template: Template;
  productId?: string;
  registry: Registry;
  brand: BrandKit;
  partner: PartnerContext;                                    // what the store chooses to share, with consent
  // demo: replay a synthetic shopper; `next` is the page it walks on to (step 0 starts from a clean memory)
  ghost?: { label: string; events: InteractionEvent[]; step?: number; next?: string } & LabInfo;
  children: ReactNode;
};

// Lab: "pause after each step" is kept for the browser tab, so it carries over from page to page.
const STEP_KEY = "babel.lab.stepMode";
const readStepMode = () => { try { return sessionStorage.getItem(STEP_KEY) === "1"; } catch { return false; } };
const writeStepMode = (on: boolean) => { try { sessionStorage.setItem(STEP_KEY, on ? "1" : "0"); } catch { /* ignore */ } };

// Lab (testing) extras on a ghost run: the indicators panel, the return visit, a forced format.
export type LabInfo = {
  lab?: boolean;
  visit?: number;                                   // 2 = return visit, starts from the browser's memory
  variant?: { dialect: Slide["persona"]["dialect"]; need: Slide["persona"]["need"] };
  last?: boolean;                                   // last scripted page of this visit
};

export function BabelProvider(p: BabelProviderProps) {
  const neutral = useMemo(
    () => buildSlide({ persona: NEUTRAL_PERSONA, template: p.template, registry: p.registry, brand: p.brand }),
    [p.template, p.registry, p.brand],
  );
  const [slides, setSlides] = useState<Slide[]>([]);
  const [cursor, setCursor] = useState(0);
  const [standard, setStandardState] = useState(false);
  const [changed, setChanged] = useState<ReadonlySet<BlockId>>(new Set());
  const [ghostNote, setGhostNote] = useState("");
  const [ghostCursor, setGhostCursor] = useState<GhostCursor>({ x: 0, y: 0, label: "", clicks: 0, visible: false });
  const [agent, setAgent] = useState<AgentStatus>({ state: "idle", text: "watching" });
  const [lastChange, setLastChange] = useState<LastChange | null>(null);
  const [apply, setApply] = useState<Apply>("quiet");
  const [calm, setCalm] = useState<CalmEntry[]>([]);
  const [curtain, setCurtain] = useState<CurtainState>(CURTAIN_OFF); // curtain mode: the glass over the page
  const [popping, setPopping] = useState(false);                     // the new page settles in after the glass lifts
  const [visitIdState, setVisitIdState] = useState<string | null>(null); // for the lab panel
  const lab = !!p.ghost?.lab;
  const [playback, setPlayback] = useState<GhostPlayback | null>(null);  // lab: pause / step through
  const playerRef = useRef<GhostControl | null>(null);

  const applyRef = useRef<Apply>("quiet");
  const pending = useRef<Slide | null>(null);  // arrived, not yet on screen (quiet mode)
  const visitId = useRef<string | null>(null);
  const visitorIdRef = useRef<string | undefined>(undefined);
  const t0 = useRef(0);
  const buffer = useRef<InteractionEvent[]>([]);
  const lastScrollAt = useRef(0);
  const lastActiveAt = useRef(0);
  const idleSent = useRef(false);
  const hoveredBlock = useRef<BlockId | undefined>(undefined);
  const slideWanted = useRef(false);
  // Curtain mode (?curtain=1, sticky for the tab): no live reorders while the profile forms; one big change behind a
  // glass curtain when it is clear, or when the shopper asks in chat. Off by default.
  const curtainMode = useRef(false);
  const restyleWanted = useRef(false); // the server said the profile is clear; waiting for a safe moment
  const curtainBusy = useRef(false);
  // Transition style for a big change (?tx=glass|fade|morph, sticky for the tab) and the first-visit opt-in.
  const txMode = useRef<Transition>("glass");
  const optinRef = useRef<string | null>(null); // "yes" | "no" | null (not asked)
  const [ready, setReady] = useState(false);     // the visit starts once the opt-in is settled
  const [ask, setAsk] = useState(false);
  const [txlab, setTxlab] = useState(false);
  const [notice, setNotice] = useState<{ id: string; dialect: Slide["persona"]["dialect"] } | null>(null);
  const profiledKey = `babel.profiled.${p.store}`;
  const markProfiled = useCallback(() => { try { localStorage.setItem(profiledKey, "1"); } catch { /* ignore */ } }, [profiledKey]);
  // Lifts the quiet first-paint glass of a remembered shopper.
  const liftBoot = useCallback(() => {
    setTimeout(() => {
      setCurtain((c) => (c.phase === "hold" && c.quiet ? { ...c, phase: "out" } : c));
      setTimeout(() => setCurtain((c) => (c.phase === "out" ? CURTAIN_OFF : c)), 650);
    }, 250);
  }, []);

  // Refs mirror state so callbacks never run side effects inside state updaters.
  const slidesRef = useRef<Slide[]>([]);
  const cursorRef = useRef(0);
  const show = useCallback((list: Slide[], at: number) => {
    slidesRef.current = list;
    cursorRef.current = at;
    setSlides(list);
    setCursor(at);
  }, []);

  const slide = standard ? neutral : slides[cursor] ?? neutral;

  const push = useCallback((e: InteractionEvent) => { buffer.current.push(e); }, []);
  const lastNoisy = useRef(new Map<string, number>());
  const track = useCallback((type: EventType, extra: TrackExtra = {}) => {
    if (!visitId.current) return;
    const t = Math.round(performance.now() - t0.current);
    if (NOISY.has(type)) {
      // Pointer-driven events would otherwise fire on every mouse pass and swamp the markers.
      const key = `${type}:${extra.blockId ?? ""}`;
      if (t - (lastNoisy.current.get(key) ?? -Infinity) < NOISY_GAP_MS) return;
      lastNoisy.current.set(key, t);
    }
    push({ t, type, ...extra });
  }, [push]);

  // Highlight the blocks a transition changed, briefly, and spell the changes out.
  const labels = useMemo(
    () => Object.fromEntries(Object.entries(p.registry[p.template] ?? {}).map(([id, b]) => [id, b!.label])),
    [p.registry, p.template],
  );
  const showSlide = useCallback((next: Slide, prev: Slide | undefined) => {
    if (!prev || prev.id === next.id) return;
    if (applyRef.current === "live") { // a flash on the changed blocks is the opposite of unnoticed
      setChanged(new Set(changedBlocks(prev.blocks, next.blocks)));
      setTimeout(() => setChanged(new Set()), lab ? 7000 : 2500); // lab: long enough to watch
    }
    const lines = describeDiff(prev, next, labels);
    if (lines.length) setLastChange({ from: prev.index + 1, to: next.index + 1, lines, rationale: next.rationale, at: Date.now() });
  }, [labels, lab]);

  // Would the shopper see this slide arrive? Yes if a changed block is on screen or the whole look changes.
  const log = useCallback((e: CalmEntry) => setCalm((l) => {
    const old = l.find((x) => x.view === e.view);
    if (old && old.status === e.status && old.text === e.text) return l;
    return [...l.filter((x) => x.view !== e.view), e].sort((a, b) => a.view - b.view);
  }), []);
  const noticeable = (prev: Slide, next: Slide) => {
    const theme = JSON.stringify(prev.theme) !== JSON.stringify(next.theme);
    const seen = changedBlocks(prev.blocks, next.blocks).filter((id) => {
      const r = document.querySelector(`[data-babel-block="${id}"]`)?.getBoundingClientRect();
      return !!r && r.bottom > 0 && r.top < innerHeight;
    });
    return { theme, seen };
  };
  const land = useCallback((next: Slide, prev: Slide, requested = false) => {
    const { theme, seen } = noticeable(prev, next);
    const view = next.index + 1;
    if (requested) log({ view, status: "requested", text: "applied now: the shopper zoomed in, so this is the change they asked for" });
    else if (theme || seen.length) log({ view, status: "seen", text: theme ? "the whole look changed while it was on screen" : `${seen.map((id) => labels[id]).join(", ")} changed while on screen` });
    else log({ view, status: "unseen", text: "applied while every changed block was off screen" });
    showSlide(next, prev);
    show(slidesRef.current, slidesRef.current.indexOf(next));
    track("slide_shown", { value: next.index });
  }, [log, labels, show, showSlide, track]);
  const tryLand = useCallback(() => {
    const next = pending.current;
    if (!next) return;
    const at = slidesRef.current.indexOf(next);
    const prev = slidesRef.current[cursorRef.current];
    if (at <= cursorRef.current) { pending.current = null; return; } // the shopper already paged to it
    const { theme, seen } = noticeable(prev, next);
    const view = next.index + 1;
    if (theme) log({ view, status: "waiting", text: "changes the whole look, so it is kept for the next page" });
    else if (seen.length) log({ view, status: "waiting", text: `waiting: ${seen.map((id) => labels[id]).join(", ")} on screen` });
    else { pending.current = null; land(next, prev); }
  }, [land, labels, log]);
  useEffect(() => { const id = setInterval(tryLand, 400); return () => clearInterval(id); }, [tryLand]);

  // 1. Start the visit. Until slide 0 arrives the store renders its neutral page.
  const started = useRef(false);
  // Before the visit starts: curtain mode, transition style, and on a first visit the opt-in question.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const cq = q.get("curtain");
    const stored = (() => { try { return sessionStorage.getItem("babel.curtain") === "1"; } catch { return false; } })();
    curtainMode.current = !lab && (cq === "1" || (cq !== "0" && stored));
    try { if (cq === "1") sessionStorage.setItem("babel.curtain", "1"); else if (cq === "0") sessionStorage.removeItem("babel.curtain"); } catch { /* ignore */ }
    const tq = q.get("tx");
    let tx: string | null = null;
    try { tx = sessionStorage.getItem("babel.tx"); if (tq) { sessionStorage.setItem("babel.tx", tq); tx = tq; } } catch { /* ignore */ }
    txMode.current = tx === "fade" || tx === "morph" ? tx : "glass";
    setTxlab(q.get("txlab") === "1");
    let answered: string | null = null;
    try { if (q.get("optin") === "reset") localStorage.removeItem("babel.optin"); answered = localStorage.getItem("babel.optin"); } catch { /* ignore */ } // ?optin=reset asks again
    if (curtainMode.current && !p.ghost && answered === null) setAsk(true); // asked once, at the start
    else { optinRef.current = answered; setReady(true); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready || started.current) return; // React dev mode mounts twice; one visit per page
    started.current = true;
    // Declined: nothing is profiled and the standard page stays.
    const partner = optinRef.current === "no" ? { ...p.partner, consent: { personalization: false, partnerData: false } } : p.partner;
    const mode = new URLSearchParams(location.search).get("apply");
    // The lab is for watching, so changes land at once unless asked otherwise.
    applyRef.current = mode === "live" || mode === "next" || mode === "quiet" ? mode : lab ? "live" : "quiet";
    setApply(applyRef.current);
    if (curtainMode.current) { applyRef.current = "next"; setApply("next"); } // nothing moves live
    const profiled = (() => { try { return localStorage.getItem(profiledKey) === "1"; } catch { return false; } })();
    if (curtainMode.current && profiled) { // a remembered shopper: keep the glass up until their own page is ready
      setCurtain({ phase: "hold", text: "", sub: "", quiet: true });
      setTimeout(liftBoot, 2500); // never leave the glass up if Babel is slow
    }
    const visitorId = (() => {
      if (p.ghost) return `ghost:${p.ghost.label.toLowerCase()}`;
      if (!partner.consent.personalization) return undefined;
      try { // consented, per-browser random id; no personal data
        const k = "babel.visitor";
        return localStorage.getItem(k) ?? (localStorage.setItem(k, crypto.randomUUID()), localStorage.getItem(k) ?? undefined);
      } catch { return undefined; }
    })();
    visitorIdRef.current = visitorId;
    const device = partner.device ?? {
      pointer: matchMedia("(pointer: coarse)").matches ? "coarse" as const : "fine" as const,
      viewportWidth: innerWidth,
      zoom: devicePixelRatio,
      prefersReducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      prefersContrast: matchMedia("(prefers-contrast: more)").matches,
    };
    // Lab return visit: the server forgot everything when the site closed; the browser kept the
    // shopper's capped group sums (consented localStorage) and hands them back on the first page.
    const memory = (() => {
      if (!p.ghost?.lab || p.ghost.visit !== 2 || p.ghost.step !== 0) return undefined;
      try {
        const raw = localStorage.getItem(memoryKey(p.ghost.label.toLowerCase()));
        return raw ? (JSON.parse(raw) as SavedMemory).groups : undefined;
      } catch { return undefined; }
    })();
    fetch("/api/visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        store: p.store, template: p.template, productId: p.productId, partner: { ...partner, device },
        visitorId, fresh: p.ghost ? p.ghost.step === 0 : undefined, // step 0 = a new run; later pages and click-throughs keep the memory
        memory, variant: p.ghost?.variant, curtain: curtainMode.current || undefined,
      }),
    })
      .then((r) => r.json())
      .then((r: { visitId?: string; slide?: Slide; fromMemory?: boolean }) => {
        if (!r.visitId || !r.slide) { liftBoot(); return; }
        visitId.current = r.visitId;
        setVisitIdState(r.visitId);
        t0.current = performance.now();
        show([r.slide], 0);
        showSlide(r.slide, neutral);
        if (r.fromMemory) markProfiled();
        liftBoot();
        if (p.ghost) {
          const next = p.ghost.next;
          // Walk on only once the agent has answered, so the page's last change is not cut off.
          const walk = (until: number) => (slideWanted.current && Date.now() < until ? setTimeout(() => walk(until), 500) : location.assign(next!));
          const run = runGhost(p.ghost.events, {
            push, note: setGhostNote, cursor: setGhostCursor, done: next ? () => walk(Date.now() + 20_000) : undefined,
            stepMode: lab && readStepMode(), state: lab ? setPlayback : undefined,
          });
          playerRef.current = run.control;
        } else {
          push({ t: 0, type: "page_view", productId: p.productId });
        }
      })
      .catch(() => { liftBoot(); /* Babel unreachable: the store keeps its neutral page */ });
  }, [ready]); // once per page: the props describe the page, not live state

  // 2. Ask for a slide once the shopper pauses.
  // `message` = something the shopper typed: skips the scroll pause and returns the agent's answer in words.
  const requestSlide = useCallback(async (message?: string): Promise<string | undefined> => {
    if (!visitId.current) return;
    if (!message && performance.now() - lastScrollAt.current < PAUSE_MS) {
      setTimeout(() => requestSlide(), 300);
      return;
    }
    setAgent({ state: "thinking", text: message ? "reading your request…" : "reading the signals and deciding…" });
    const asked = performance.now();
    const r = await fetch("/api/slide", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ visitId: visitId.current, message }),
    }).then((x) => x.json()).catch(() => null) as { decision?: string; slide?: Slide; reason?: string; reply?: string; llm?: LlmTranscript; urgent?: boolean } | null;
    slideWanted.current = false; // held until the answer is in, so the ghost can wait for it
    const secs = ((performance.now() - asked) / 1000).toFixed(1);
    if (r?.decision === "slide" && r.slide) setAgent({ state: "changed", text: `made view ${r.slide.index + 1} in ${secs}s`, llm: r.llm });
    else if (r?.decision === "hold") setAgent({ state: "held", text: `kept this view (${r.reason}) after ${secs}s`, llm: r.llm });
    else setAgent({ state: "idle", text: "watching" });
    if (r?.decision === "slide" && r.slide) {
      const next = r.slide;
      const list = slidesRef.current;
      slidesRef.current = [...list, next];
      setSlides(slidesRef.current); // in the history now, on screen when it is safe
      if (applyRef.current === "live" || r.urgent) land(next, list[cursorRef.current], r.urgent);
      else { pending.current = next; tryLand(); }
    }
    if (!message) return;
    if (r?.decision === "slide" && r.slide) return r.reply ?? r.slide.rationale;
    if (r?.decision === "hold") return r.reply ?? `I kept the page as it is: ${r.reason}`;
    return r?.reason ?? "Babel could not be reached.";
  }, [land, tryLand]);

  // ---- Curtain mode ----
  // The glass comes down, the work runs (at least `minMs`, so it never flickers), the page is swapped while it is
  // blurred, a short "done" line says what happened, then the glass lifts.
  const behindCurtain = useCallback(async <T,>(text: string, work: () => Promise<T>, apply: (result: T) => boolean, minMs = 1700) => {
    if (curtainBusy.current) return;
    curtainBusy.current = true;
    setCurtain({ phase: "in", text, sub: "One moment.", quiet: false });
    let changed = false;
    try {
      const [result] = await Promise.all([work(), new Promise<void>((done) => setTimeout(done, minMs))]);
      changed = apply(result);
      if (changed) { setPopping(true); setTimeout(() => setPopping(false), 900); }
      setCurtain({ phase: "done", text: changed ? "Done." : "Nothing to change.", sub: changed ? "Standard view puts the page back." : "", quiet: false });
      await new Promise<void>((done) => setTimeout(done, changed ? 1200 : 500));
    } finally {
      setCurtain((c) => ({ ...c, phase: "out" }));
      setTimeout(() => { setCurtain((c) => (c.phase === "out" ? CURTAIN_OFF : c)); curtainBusy.current = false; }, 650);
    }
  }, []);

  // One entry for every big change, in the chosen transition style:
  //   glass  the curtain (blur, message, swap behind it, lift)
  //   fade   do the work quietly, then crossfade the whole page from the old look to the new (View Transitions)
  //   morph  swap at once and let CSS animate what it can (colours, spacing, corners); fonts and layouts jump
  const changeWith = useCallback(async <T,>(text: string, work: () => Promise<T>, apply: (result: T) => boolean, minMs = 1700) => {
    if (txMode.current === "glass") return behindCurtain(text, work, apply, minMs);
    if (curtainBusy.current) return;
    curtainBusy.current = true;
    try {
      const result = await work();
      let changed = false;
      const doApply = () => { changed = apply(result); };
      const vt = (document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } }).startViewTransition?.bind(document);
      if (txMode.current === "fade" && vt && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        document.documentElement.classList.add("babel-vt");
        await vt(() => { flushSync(doApply); }).finished.catch(() => undefined);
        document.documentElement.classList.remove("babel-vt");
      } else doApply();
      if (changed) { setPopping(true); setTimeout(() => setPopping(false), 900); }
    } finally { curtainBusy.current = false; }
  }, [behindCurtain]);

  // Puts a slide on screen while the glass is up. No highlight and no "unnoticed" bookkeeping: the shopper is told.
  const applyBehind = useCallback((next: Slide) => {
    const list = slidesRef.current;
    const prev = list[cursorRef.current];
    slidesRef.current = [...list, next];
    setSlides(slidesRef.current);
    showSlide(next, prev);
    show(slidesRef.current, slidesRef.current.length - 1);
    track("slide_shown", { value: next.index });
    log({ view: next.index + 1, status: "requested", text: "applied behind the curtain" });
    setNotice({ id: next.id, dialect: next.persona.dialect });
  }, [log, show, showSlide, track]);

  // Is it a good moment to take the page away? Not while typing, scrolling, or on the buy box.
  const safeMoment = () => {
    if (document.visibilityState !== "visible") return false;
    const a = document.activeElement as HTMLElement | null;
    if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return false;
    if (performance.now() - lastScrollAt.current < 1500) return false;
    return hoveredBlock.current !== "buyBox";
  };

  const tryRestyle = useCallback(async () => {
    if (!curtainMode.current || !restyleWanted.current || curtainBusy.current || !visitId.current || !safeMoment()) return;
    restyleWanted.current = false;
    setAgent({ state: "thinking", text: "your profile is clear: setting the page up…" });
    await changeWith(
      "Setting the page up for how you browse…",
      () => fetch("/api/restyle", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ visitId: visitId.current }) })
        .then((x) => x.json()).catch(() => null) as Promise<{ decision?: string; slide?: Slide; reason?: string } | null>,
      (r) => {
        if (r?.decision === "slide" && r.slide) { applyBehind(r.slide); markProfiled(); setAgent({ state: "changed", text: `set up view ${r.slide.index + 1} from the profile` }); return true; }
        setAgent({ state: "held", text: `kept this view (${r?.reason ?? "no answer"})` });
        return false;
      },
    );
  }, [applyBehind, changeWith, markProfiled]);
  useEffect(() => { const id = setInterval(() => { void tryRestyle(); }, 500); return () => clearInterval(id); }, [tryRestyle]);

  // A typed request in curtain mode: glass down at once (it covers the model's thinking time), whole page rebuilt.
  const chatBehindCurtain = useCallback(async (message: string) => {
    if (curtainBusy.current) return "One moment, I am still changing the page.";
    let reply = "Babel could not be reached.";
    setAgent({ state: "thinking", text: "reading your request…" });
    await changeWith(
      "Rebuilding the page the way you asked…",
      () => fetch("/api/slide", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ visitId: visitId.current, message }) })
        .then((x) => x.json()).catch(() => null) as Promise<{ decision?: string; slide?: Slide; reason?: string; reply?: string; llm?: LlmTranscript } | null>,
      (r) => {
        if (r?.decision === "slide" && r.slide) { applyBehind(r.slide); reply = r.reply ?? r.slide.rationale; setAgent({ state: "changed", text: `rebuilt the page as you asked (view ${r.slide.index + 1})`, llm: r.llm }); return true; }
        reply = r?.decision === "hold" ? r.reply ?? `I kept the page as it is: ${r.reason}` : r?.reason ?? reply;
        setAgent({ state: "held", text: `kept this view (${r?.reason ?? "no answer"})`, llm: r?.llm });
        return false;
      },
      1300,
    );
    return reply;
  }, [applyBehind, changeWith]);

  // The opt-in answer: yes starts a profiled visit, no starts a standard one with nothing collected.
  const answerInvite = useCallback((yes: boolean) => {
    try { localStorage.setItem("babel.optin", yes ? "yes" : "no"); } catch { /* ignore */ }
    optinRef.current = yes ? "yes" : "no";
    setAsk(false);
    setReady(true);
  }, []);

  // Local comparison: switch to a look from the switcher panel, in the chosen transition, with no server involved.
  const previewLook = useCallback((dialect: Slide["persona"]["dialect"], tx: Transition) => {
    const prevTx = txMode.current;
    txMode.current = tx;
    setStandardState(false);
    const next = buildSlide({
      persona: { dialect, need: "balanced", confidence: 1 }, template: p.template, registry: p.registry, brand: p.brand, ctx: p.partner,
      index: slidesRef.current.length, kind: "explicit", trigger: "view_switch", source: "explicit", parentId: slidesRef.current.at(-1)?.id,
    });
    void changeWith("Setting the page up in the new look…", async () => next, (s) => { applyBehind(s); return true; }, 1100)
      .finally(() => { txMode.current = prevTx; });
  }, [applyBehind, changeWith, p.brand, p.partner, p.registry, p.template]);

  const chat = useCallback(async (message: string) => {
    track("chat_message", { value: message.length }); // the text itself is not kept as a signal
    if (curtainMode.current) return chatBehindCurtain(message);
    return (await requestSlide(message)) ?? "Babel could not be reached.";
  }, [chatBehindCurtain, requestSlide, track]);

  const askNow = useCallback(async () => {
    if (!visitId.current || slideWanted.current) return;
    const ok = await fetch("/api/debug", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ visitId: visitId.current, action: "look" }),
    }).then((x) => x.ok).catch(() => false);
    if (!ok) return;
    slideWanted.current = true;
    requestSlide();
  }, [requestSlide]);

  // 3. Flush signals; idle detection; scroll and hover tracking.
  useEffect(() => {
    const flush = setInterval(async () => {
      const now = performance.now();
      if (visitId.current && !p.ghost && now - lastActiveAt.current > IDLE_MS && !idleSent.current) {
        idleSent.current = true;
        track("idle", { blockId: hoveredBlock.current, value: Math.round(now - lastActiveAt.current) });
      }
      if (!visitId.current || !buffer.current.length) return;
      const events = buffer.current.splice(0);
      const r = await fetch("/api/events", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ visitId: visitId.current, events }),
      }).then((x) => x.json()).catch(() => null) as { trigger?: boolean; restyle?: boolean } | null;
      if (r?.restyle) restyleWanted.current = true; // curtain mode: the profile is clear, change when it is safe
      if (r?.trigger && !slideWanted.current && applyRef.current !== "next") { slideWanted.current = true; requestSlide(); }
    }, FLUSH_MS);
    const active = () => { lastActiveAt.current = performance.now(); idleSent.current = false; };
    const onScroll = () => { lastScrollAt.current = performance.now(); active(); };
    const onMove = (e: PointerEvent) => {
      active();
      const el = (e.target as Element | null)?.closest?.("[data-babel-block]");
      hoveredBlock.current = (el?.getAttribute("data-babel-block") as BlockId) ?? undefined;
    };
    lastActiveAt.current = performance.now();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("pointermove", onMove, { passive: true });
    addEventListener("keydown", active);
    return () => {
      clearInterval(flush);
      removeEventListener("scroll", onScroll);
      removeEventListener("pointermove", onMove);
      removeEventListener("keydown", active);
    };
  }, [p.ghost, requestSlide, track]);

  // A ghost stays on when you click through the store: internal links carry it along, without replaying
  // its script (step=free), so you can browse as that shopper and see the adaptation is persistent.
  useEffect(() => {
    if (!p.ghost) return;
    const id = p.ghost.label.toLowerCase();
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank") return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin || u.searchParams.has("ghost")) return;
      e.preventDefault();
      e.stopPropagation(); // ahead of next/link's client navigation, which would drop the query
      u.searchParams.set("ghost", id);
      u.searchParams.set("step", "free");
      u.searchParams.set("apply", applyRef.current);
      location.assign(u);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [p.ghost]);

  // Page zoom: browser zoom changes devicePixelRatio; pinch zoom shows up as visualViewport.scale.
  // Reported relative to page load, in steps of at least 10%, so the agent can react to zooming in.
  useEffect(() => {
    const base = devicePixelRatio;
    let last = 1;
    const check = () => {
      const zoom = Math.round((devicePixelRatio / base) * (visualViewport?.scale ?? 1) * 100) / 100;
      if (Math.abs(zoom - last) < 0.1) return;
      last = zoom;
      track("page_zoom", { value: zoom });
    };
    // A DPR change doesn't always come with a resize; a resolution media query always fires.
    let mq: MediaQueryList;
    const watchDpr = () => {
      mq = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
      mq.addEventListener("change", onDpr, { once: true });
    };
    const onDpr = () => { check(); watchDpr(); };
    watchDpr();
    addEventListener("resize", check);
    visualViewport?.addEventListener("resize", check);
    return () => {
      mq.removeEventListener("change", onDpr);
      removeEventListener("resize", check);
      visualViewport?.removeEventListener("resize", check);
    };
  }, [track]);

  // 4. Type scale applies to the whole page, so rem-based sizes follow it.
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * slide.theme.typeScale}px`;
    return () => { document.documentElement.style.fontSize = ""; };
  }, [slide.theme.typeScale]);

  const go = useCallback((delta: -1 | 1) => {
    const list = slidesRef.current;
    const c = cursorRef.current;
    const n = Math.min(list.length - 1, Math.max(0, c + delta));
    if (n === c) return;
    showSlide(list[n], list[c]);
    show(list, n);
    track(delta < 0 ? "slide_prev" : "slide_next", { value: n });
  }, [show, showSlide, track]);

  // The shopper's off switch for memory: the server drops everything it kept, then the page starts over.
  const forgetMe = useCallback(async () => {
    if (visitorIdRef.current) {
      await fetch("/api/forget", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ visitorId: visitorIdRef.current }) }).catch(() => null);
    }
    location.reload();
  }, []);

  const setStandard = useCallback((on: boolean) => {
    setStandardState(on);
    track("view_switch", { value: on ? "standard" : "babel" });
  }, [track]);

  const { colors, fonts } = p.brand;
  const style = {
    "--c-primary": colors.primary, "--c-accent": colors.accent, "--c-surface": colors.surface,
    "--c-text": slide.theme.contrast === "high" ? "#000000" : colors.text,
    "--c-muted": slide.theme.contrast === "high" ? colors.text : colors.muted,
    "--babel-gap": GAP[slide.theme.density],
    "--babel-radius": `${slide.theme.radius}px`,
    // --look-* come from the dialect's look in globals.css; the brand fonts/surface are the fallback.
    "--font-heading": `var(--look-heading, ${fonts.heading})`,
    fontFamily: `var(--look-body, ${fonts.body})`,
    background: `var(--look-canvas, ${colors.surface})`,
    color: "var(--c-text)",
  } as CSSProperties;

  const ctx: BabelContext = {
    store: p.store, template: p.template, registry: p.registry, brand: p.brand,
    slide, slides, cursor, standard, changed, track, go, setStandard, forgetMe, visitId: visitIdState, askNow, chat, agent, lastChange, apply, calm,
    player: lab ? {
      state: playback,
      pause: () => playerRef.current?.pause(),
      // Play means play on: it also switches "pause after each step" off (Next step is for one action).
      play: () => { writeStepMode(false); playerRef.current?.setStepMode(false); playerRef.current?.play(); },
      step: () => playerRef.current?.step(),
      setStepMode: (on: boolean) => { writeStepMode(on); playerRef.current?.setStepMode(on); },
    } : undefined,
    ghost: p.ghost
      ? { label: p.ghost.label, note: ghostNote, step: p.ghost.step ?? 0, lab: p.ghost.lab, visit: p.ghost.visit, variant: p.ghost.variant, last: p.ghost.last }
      : undefined,
  };

  return (
    <Ctx.Provider value={ctx}>
      <MotionConfig reducedMotion={slide.theme.motion === "reduced" ? "always" : "never"}>
        <div style={style} data-contrast={slide.theme.contrast} data-dialect={standard ? undefined : slide.persona.dialect} data-popping={popping || undefined} className={`min-h-screen ${lab ? "babel-lab pl-[370px]" : ""}`}>
          <div className="babel-stage" inert={curtain.phase === "in" || curtain.phase === "hold" || curtain.phase === "done"}>{p.children}</div>
          <SlideControl />
          <ChatBox />
          <DebugPanel />
          {lab && <LabPanel />}
          {p.ghost && <GhostCursorView c={ghostCursor} name={p.ghost.label} />}
          <Curtain state={curtain} />
          <Invite open={ask} onAnswer={answerInvite} />
          <ViewNotice
            notice={notice} dialect={slide.persona.dialect} standard={standard} optedIn={optinRef.current !== "no"}
            onKeep={() => track("view_switch", { value: "keep" })} onBack={() => go(-1)}
          />
          {txlab && <TransitionLab current={standard ? "standard" : slide.persona.dialect} onPreview={previewLook} />}
        </div>
      </MotionConfig>
    </Ctx.Provider>
  );
}
