"use client";
// The one integration point a store uses (SPEC §7.1). Starts the visit, collects interaction
// signals, asks for a new slide at pauses, and applies slides with the store's brand kit.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import type { LlmTranscript } from "@/babel/agents/director";
import { changedBlocks, describeDiff } from "@/babel/schema/diff";
import { buildSlide, NEUTRAL_PERSONA } from "@/babel/persona";
import type { BlockId, BrandKit, EventType, InteractionEvent, PartnerContext, Registry, Slide, Template } from "@/babel/schema";
import { GhostCursorView, runGhost, type GhostCursor } from "./Ghost";
import { SlideControl } from "./SlideControl";

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
  ghost?: { label: string; note: string };
  agent: AgentStatus;
  lastChange: LastChange | null;
  track: (type: EventType, extra?: TrackExtra) => void;
  go: (delta: -1 | 1) => void;
  setStandard: (on: boolean) => void;
};

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
  ghost?: { label: string; events: InteractionEvent[] };     // demo: replay a synthetic shopper
  children: ReactNode;
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

  const visitId = useRef<string | null>(null);
  const t0 = useRef(0);
  const buffer = useRef<InteractionEvent[]>([]);
  const lastScrollAt = useRef(0);
  const lastActiveAt = useRef(0);
  const idleSent = useRef(false);
  const hoveredBlock = useRef<BlockId | undefined>(undefined);
  const slideWanted = useRef(false);

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
    setChanged(new Set(changedBlocks(prev.blocks, next.blocks)));
    setTimeout(() => setChanged(new Set()), 2500);
    const lines = describeDiff(prev, next, labels);
    if (lines.length) setLastChange({ from: prev.index + 1, to: next.index + 1, lines, rationale: next.rationale, at: Date.now() });
  }, [labels]);

  // 1. Start the visit. Until slide 0 arrives the store renders its neutral page.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; // React dev mode mounts twice; one visit per page
    started.current = true;
    const device = p.partner.device ?? {
      pointer: matchMedia("(pointer: coarse)").matches ? "coarse" as const : "fine" as const,
      viewportWidth: innerWidth,
      zoom: devicePixelRatio,
      prefersReducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      prefersContrast: matchMedia("(prefers-contrast: more)").matches,
    };
    fetch("/api/visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ store: p.store, template: p.template, productId: p.productId, partner: { ...p.partner, device } }),
    })
      .then((r) => r.json())
      .then((r: { visitId?: string; slide?: Slide }) => {
        if (!r.visitId || !r.slide) return;
        visitId.current = r.visitId;
        t0.current = performance.now();
        show([r.slide], 0);
        showSlide(r.slide, neutral);
        if (p.ghost) {
          runGhost(p.ghost.events, { push, note: setGhostNote, cursor: setGhostCursor });
        } else {
          push({ t: 0, type: "page_view", productId: p.productId });
        }
      })
      .catch(() => { /* Babel unreachable: the store keeps its neutral page */ });
  }, []); // once per page: the props describe the page, not live state

  // 2. Ask for a slide once the shopper pauses.
  const requestSlide = useCallback(async () => {
    if (!visitId.current) return;
    if (performance.now() - lastScrollAt.current < PAUSE_MS) {
      setTimeout(requestSlide, 300);
      return;
    }
    slideWanted.current = false;
    setAgent({ state: "thinking", text: "reading the signals and deciding…" });
    const asked = performance.now();
    const r = await fetch("/api/slide", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ visitId: visitId.current }),
    }).then((x) => x.json()).catch(() => null) as { decision?: string; slide?: Slide; reason?: string; llm?: LlmTranscript } | null;
    const secs = ((performance.now() - asked) / 1000).toFixed(1);
    if (r?.decision === "slide" && r.slide) setAgent({ state: "changed", text: `made view ${r.slide.index + 1} in ${secs}s`, llm: r.llm });
    else if (r?.decision === "hold") setAgent({ state: "held", text: `kept this view (${r.reason}) after ${secs}s`, llm: r.llm });
    else setAgent({ state: "idle", text: "watching" });
    if (r?.decision === "slide" && r.slide) {
      const list = slidesRef.current;
      showSlide(r.slide, list[cursorRef.current]);
      show([...list, r.slide], list.length);
      track("slide_shown", { value: r.slide.index });
    }
  }, [show, showSlide, track]);

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
      }).then((x) => x.json()).catch(() => null) as { trigger?: boolean } | null;
      if (r?.trigger && !slideWanted.current) { slideWanted.current = true; requestSlide(); }
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
    "--font-heading": fonts.heading,
    fontFamily: fonts.body,
    background: colors.surface,
    color: "var(--c-text)",
  } as CSSProperties;

  const ctx: BabelContext = {
    store: p.store, template: p.template, registry: p.registry, brand: p.brand,
    slide, slides, cursor, standard, changed, track, go, setStandard, agent, lastChange,
    ghost: p.ghost ? { label: p.ghost.label, note: ghostNote } : undefined,
  };

  return (
    <Ctx.Provider value={ctx}>
      <MotionConfig reducedMotion={slide.theme.motion === "reduced" ? "always" : "never"}>
        <div style={style} data-contrast={slide.theme.contrast} className="min-h-screen">
          {p.children}
          <SlideControl />
          {p.ghost && <GhostCursorView c={ghostCursor} name={p.ghost.label} />}
        </div>
      </MotionConfig>
    </Ctx.Provider>
  );
}
