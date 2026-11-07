"use client";
// The one integration point a store uses (SPEC §7.1). It receives the view the server computed for this page
// (already adapted at first paint), collects interaction signals, and asks the agent to plan the NEXT pages.
// The open page changes only when the shopper asks: chat, Standard view, undo, style.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { BlockId, BrandKit, EventType, ExplicitChange, InteractionEvent, Registry, Skin, View } from "@/babel/schema";
import { changedBlocks } from "@/babel/guardrails/validate";
import { GhostCursorView, runGhost, type GhostCursor } from "./Ghost";
import type { Consent, Initial } from "./types";
import { ViewBar } from "./ViewBar";
import { ChatPanel } from "./ChatPanel";
import { ConsentBanner } from "./ConsentBanner";

type Extra = Omit<InteractionEvent, "t" | "type">;
export type AgentStatus = { state: "idle" | "thinking" | "planned" | "held"; text: string };
export type ChatTurn = { from: "you" | "ai"; text: string; note?: string };

type Ctx = {
  store: string; template: Initial["template"]; productId?: string; registry: Registry; brand: BrandKit;
  view: View; why: string[]; changes: string[]; consent: Consent; visitId: string; pageId: string;
  changed: ReadonlySet<BlockId>; agent: AgentStatus; llm: Initial["llm"]; ghost?: Initial["ghost"]; ghostNote: string;
  chatOpen: boolean; setChatOpen: (open: boolean) => void; chatLog: ChatTurn[];
  track: (type: EventType, extra?: Extra) => void;
  ask: (message: string) => Promise<void>;
  explicit: (change: ExplicitChange, via: "view_switch" | "style") => Promise<void>;
  setStandard: (on: boolean) => Promise<void>;
  undo: () => Promise<void>;
  forgetMe: () => Promise<void>;
  answerConsent: (yes: boolean) => void;
};

const BabelCtx = createContext<Ctx | null>(null);
export function useBabel(): Ctx {
  const c = useContext(BabelCtx);
  if (!c) throw new Error("useBabel must be used inside <BabelProvider>");
  return c;
}

const FLUSH_MS = 1000, IDLE_MS = 5000, DWELL_MS = 1500;
const NOISY = new Set<EventType>(["hover_price", "image_zoom", "gallery_swipe"]);
const NOISY_GAP_MS = 8000;
const GAP: Record<View["theme"]["density"], string> = { airy: "2rem", comfortable: "1.25rem", compact: "0.75rem" };
const post = <T,>(url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json() as Promise<T>).catch(() => null);

export type BabelProviderProps = { initial: Initial; registry: Registry; brand: BrandKit; children: ReactNode };

export function BabelProvider({ initial, registry, brand, children }: BabelProviderProps) {
  const [view, setView] = useState(initial.view);
  const [why, setWhy] = useState(initial.why);
  const [changes, setChanges] = useState(initial.changes);
  const [changed, setChanged] = useState<ReadonlySet<BlockId>>(new Set());
  const [agent, setAgent] = useState<AgentStatus>({ state: "idle", text: "watching" });
  const [ghostNote, setGhostNote] = useState("");
  const [cursor, setCursor] = useState<GhostCursor>({ x: 0, y: 0, label: "", clicks: 0, visible: false });
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLog, setChatLog] = useState<ChatTurn[]>([]);
  const collecting = initial.consent === "yes" || initial.consent === "ghost";
  const t0 = useRef(0);
  const buffer = useRef<InteractionEvent[]>([]);
  const lastNoisy = useRef(new Map<string, number>());
  const planning = useRef<Promise<unknown> | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const push = useCallback((e: InteractionEvent) => { if (collecting) buffer.current.push(e); }, [collecting]);
  const track = useCallback((type: EventType, extra: Extra = {}) => {
    if (!collecting) return; // a ghost's clicks land here too: the store's own handlers report them
    const t = Math.round(performance.now() - t0.current);
    if (NOISY.has(type)) {
      const key = `${type}:${extra.blockId ?? ""}`;
      if (t - (lastNoisy.current.get(key) ?? -Infinity) < NOISY_GAP_MS) return;
      lastNoisy.current.set(key, t);
    }
    push({ t, type, ...extra });
  }, [collecting, push]);

  // Ask the agent to plan the next pages. Nobody waits for it, except a ghost that is about to walk on.
  const plan = useCallback((leaving: boolean) => {
    if (planning.current) return planning.current;
    setAgent({ state: "thinking", text: leaving ? "planning your next page…" : "reading what you did…" });
    planning.current = post<{ decision?: string; reason?: string; rationale?: string; ms?: number }>("/api/plan", { visitId: initial.visitId, leaving })
      .then((r) => {
        if (r?.decision === "plan") setAgent({ state: "planned", text: `next pages planned in ${((r.ms ?? 0) / 1000).toFixed(1)} s: ${r.rationale ?? ""}` });
        else setAgent({ state: "held", text: r?.reason ? `kept the plan (${r.reason})` : "watching" });
      })
      .finally(() => { planning.current = null; });
    return planning.current;
  }, [initial.visitId]);

  const flush = useCallback(async () => {
    if (!buffer.current.length) return;
    const events = buffer.current.splice(0);
    const r = await post<{ look?: string[] }>("/api/events", { visitId: initial.visitId, pageId: initial.pageId, events });
    if (r?.look?.length) void plan(false);
  }, [initial.visitId, initial.pageId, plan]);

  // 1. Signals the store does not have to report itself: page view, back navigation, scroll pace, idle, dwell,
  //    dead clicks, rage clicks, keyboard use. Interaction signals only; nothing identifies a person.
  useEffect(() => {
    t0.current = performance.now();
    if (!collecting) return;
    if (initial.ghost) {
      const next = initial.ghost.next;
      const run = runGhost(initial.ghost.events, {
        push, note: setGhostNote, cursor: setCursor,
        done: next ? async () => {
          await flush();
          setGhostNote("lets Babel plan the next page");
          await Promise.race([plan(true), new Promise((ok) => setTimeout(ok, 30_000))]);
          location.assign(next);
        } : undefined,
      });
      return () => run.stop();
    }
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    push({ t: 0, type: "page_view", productId: initial.productId });
    if (nav?.type === "back_forward") push({ t: 0, type: "back_nav" });
    let lastActive = performance.now(), idleSent = false, lastScrollY = scrollY, lastScrollAt = performance.now(), tabs = 0;
    let hover: { target: string; block?: BlockId; since: number } | undefined;
    const clicks: { x: number; y: number; at: number }[] = [];
    const now = () => Math.round(performance.now() - t0.current);
    const blockOf = (el: Element | null) => (el?.closest("[data-babel-block]")?.getAttribute("data-babel-block") as BlockId | null) ?? undefined;
    const active = () => { lastActive = performance.now(); idleSent = false; };
    const endLook = () => {
      if (hover && performance.now() - hover.since >= DWELL_MS) push({ t: now(), type: "block_dwell", blockId: hover.block, productId: initial.productId, target: hover.target, value: Math.round(performance.now() - hover.since) });
      hover = undefined;
    };
    const onScroll = () => {
      active();
      const dt = performance.now() - lastScrollAt;
      if (dt < 700) return;
      const speed = Math.abs(scrollY - lastScrollY) / dt; // px per ms
      push({ t: now(), type: "scroll", value: speed > 2.5 ? "fast" : speed < 0.4 ? "slow" : "normal" });
      lastScrollY = scrollY; lastScrollAt = performance.now();
    };
    const onMove = (e: PointerEvent) => {
      active();
      const el = (e.target as Element | null)?.closest?.("[data-babel-focus]");
      const target = el?.getAttribute("data-babel-focus")?.toLowerCase().replace(/[^a-z0-9_:.-]/g, "-").slice(0, 60);
      if (target === hover?.target) return;
      endLook();
      if (target) hover = { target, block: blockOf(el ?? null), since: performance.now() };
    };
    const onClick = (e: MouseEvent) => {
      active();
      const el = e.target as Element | null;
      const interactive = el?.closest("a,button,summary,input,select,label,textarea,[role=button]");
      const t = performance.now();
      clicks.push({ x: e.clientX, y: e.clientY, at: t });
      while (clicks.length && t - clicks[0].at > 1000) clicks.shift();
      if (clicks.length >= 3 && clicks.every((c) => Math.hypot(c.x - e.clientX, c.y - e.clientY) < 30)) { push({ t: now(), type: "rage_click", blockId: blockOf(el) }); clicks.length = 0; }
      else if (!interactive && el?.closest("[data-babel-block]")) push({ t: now(), type: "dead_click", blockId: blockOf(el) });
    };
    const onKey = (e: KeyboardEvent) => { active(); if (e.key === "Tab" && ++tabs === 4) push({ t: now(), type: "keyboard_nav" }); };
    const tick = setInterval(() => {
      if (!idleSent && performance.now() - lastActive > IDLE_MS) {
        idleSent = true;
        push({ t: now(), type: "idle", blockId: hover?.block, value: Math.round(performance.now() - lastActive) });
      }
      void flush();
    }, FLUSH_MS);
    const onHide = () => { endLook(); void flush(); };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("pointermove", onMove, { passive: true });
    addEventListener("click", onClick, true);
    addEventListener("keydown", onKey);
    addEventListener("pagehide", onHide);
    return () => {
      onHide();
      clearInterval(tick);
      removeEventListener("scroll", onScroll);
      removeEventListener("pointermove", onMove);
      removeEventListener("click", onClick, true);
      removeEventListener("keydown", onKey);
      removeEventListener("pagehide", onHide);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once per page

  // The ghost's buffer flushes on the same clock.
  useEffect(() => {
    if (!initial.ghost) return;
    const id = setInterval(() => void flush(), FLUSH_MS);
    return () => clearInterval(id);
  }, [initial.ghost, flush]);

  // 2. Text size applies to the whole page so rem-based sizes follow it.
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * view.theme.typeScale}px`;
    return () => { document.documentElement.style.fontSize = ""; };
  }, [view.theme.typeScale]);

  // 3. Changes the shopper asked for, applied to the open page at once, with the changed blocks marked briefly.
  const show = useCallback((next: View, nextWhy?: string[], nextChanges?: string[]) => {
    setChanged(new Set(changedBlocks(viewRef.current.blocks, next.blocks)));
    setTimeout(() => setChanged(new Set()), 2600);
    setView(next);
    if (nextWhy) setWhy(nextWhy);
    if (nextChanges) setChanges(nextChanges);
  }, []);
  type ViewReply = { ok?: boolean; view?: View; why?: string[]; changes?: string[]; error?: string };
  const act = useCallback(async (body: Record<string, unknown>) => {
    await flush();
    const r = await post<ViewReply>("/api/view", { visitId: initial.visitId, pageId: initial.pageId, ...body });
    if (r?.view) show(r.view, r.why, r.changes);
    return r;
  }, [flush, initial.visitId, initial.pageId, show]);

  const ask = useCallback(async (message: string) => {
    setChatLog((l) => [...l, { from: "you", text: message }]);
    await flush();
    const r = await post<{ reply?: string; view?: View; why?: string[]; changes?: string[]; refused?: string; replaced?: string[] }>(
      "/api/chat", { visitId: initial.visitId, pageId: initial.pageId, message });
    if (r?.view) show(r.view, r.why, r.changes);
    const note = r?.refused ? "answered by a fixed rule" : r?.replaced ? "the model's answer failed a check; this one is built from the catalog" : r?.view ? "the page changed as you asked" : undefined;
    setChatLog((l) => [...l, { from: "ai", text: r?.reply ?? "Babel could not be reached.", note }]);
  }, [flush, initial.visitId, initial.pageId, show]);

  const explicit = useCallback(async (change: ExplicitChange, via: "view_switch" | "style") => { await act({ action: "explicit", change, via }); }, [act]);
  const setStandard = useCallback(async (on: boolean) => { await act({ action: "standard", on }); }, [act]);
  const undo = useCallback(async () => { await act({ action: "undo" }); }, [act]);
  const forgetMe = useCallback(async () => {
    await post("/api/forget", { visitId: initial.visitId });
    for (const c of ["babel_vid", "babel_consent"]) document.cookie = `${c}=; path=/; max-age=0; samesite=lax`;
    location.reload();
  }, [initial.visitId]);
  const answerConsent = useCallback((yes: boolean) => {
    const year = 60 * 60 * 24 * 365;
    document.cookie = `babel_consent=${yes ? "yes" : "no"}; path=/; max-age=${year}; samesite=lax`;
    if (yes) document.cookie = `babel_vid=${crypto.randomUUID()}; path=/; max-age=${year}; samesite=lax`;
    location.reload(); // the server builds the page again, now with (or without) Babel
  }, []);

  const { colors, fonts } = brand;
  const skin: Skin = view.skin;
  const style = {
    "--c-primary": `var(--skin-primary, ${colors.primary})`, "--c-accent": `var(--skin-accent, ${colors.accent})`, "--c-surface": colors.surface,
    "--c-text": view.theme.contrast === "high" ? "#000000" : `var(--skin-text, ${colors.text})`,
    "--c-muted": view.theme.contrast === "high" ? `var(--skin-text, ${colors.text})` : `var(--skin-muted, ${colors.muted})`,
    "--babel-gap": GAP[view.theme.density],
    "--babel-radius": `var(--skin-radius, ${view.theme.radius}px)`,
    "--font-heading": `var(--skin-heading, var(--look-heading, ${fonts.heading}))`,
    fontFamily: `var(--skin-body, var(--look-body, ${fonts.body}))`,
    background: `var(--skin-canvas, var(--look-canvas, ${colors.surface}))`,
    color: "var(--c-text)",
  } as CSSProperties;

  const ctx: Ctx = useMemo(() => ({
    store: initial.store, template: initial.template, productId: initial.productId, registry, brand,
    view, why, changes, consent: initial.consent, visitId: initial.visitId, pageId: initial.pageId,
    changed, agent, llm: initial.llm, ghost: initial.ghost, ghostNote, chatOpen, setChatOpen, chatLog,
    track, ask, explicit, setStandard, undo, forgetMe, answerConsent,
  }), [initial, registry, brand, view, why, changes, changed, agent, ghostNote, chatOpen, chatLog, track, ask, explicit, setStandard, undo, forgetMe, answerConsent]);

  return (
    <BabelCtx.Provider value={ctx}>
      <div
        style={style}
        className="min-h-screen"
        data-contrast={view.theme.contrast}
        data-motion={view.theme.motion}
        data-dialect={view.kind === "standard" ? undefined : view.persona.dialect}
        data-skin={skin === "none" ? undefined : skin}
      >
        <div className="babel-stage">{children}</div>
        <ViewBar />
        <ChatPanel />
        {initial.consent === "unset" && <ConsentBanner />}
        {initial.ghost && <GhostCursorView c={cursor} name={initial.ghost.label} />}
      </div>
    </BabelCtx.Provider>
  );
}
