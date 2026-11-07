"use client";
// Testing overlay: what Babel measured, what it sent the AI, what the AI answered, and why the page looks as it does.
// Shown as a small pill in development (always with ?debug=1; hide with ?debug=0; Ctrl+Shift+D toggles).
import { useEffect, useState, type ReactNode } from "react";
import type { LlmTranscript } from "@/babel/agents/director";
import type { Markers } from "@/babel/schema";
import { useBabel } from "./BabelProvider";

type Snapshot = {
  id: string; store: string; template: string; productId?: string; ageMs: number; returning: boolean; standardView: boolean; consent: boolean;
  busy: boolean; pendingTriggers: string[]; minorCount: number; zoom: number;
  llm: { mocked: boolean; model: string };
  markers: Markers;
  shopper: null | {
    suggested: { dialect: string; need: string; confidence: number; dialectWhy: string; needWhy: string; copyRegister: string };
    traits: Record<string, { value: number; confidence: number }>;
    stage: string; buyingFor: string;
  };
  memory?: { visits: number; lastSeenAt: number; hasProfile: boolean; remembered: string[] };
  eventCounts: Record<string, number>;
  slide: { index: number; source: string; persona: { dialect: string; need: string }; copyRegister: string; rationale: string; blocks: { id: string; variant: string; order: number; collapsed?: boolean }[] };
  trace: { at: number; kind: string; text: string }[];
  calls: { at: number; kind: string; text: string; triggers?: string[]; ms?: number; rounds?: number; errors?: string[][]; clamps?: string[]; llm: LlmTranscript }[];
  context: string[];
};

type Mode = "open" | "pill" | "off";
const KEY = "babel.debug";
const THRESHOLD = 0.6; // markers cross this upward to call the agent (TRIGGER_THRESHOLD)

const secs = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
const pre = "mt-1 max-h-56 overflow-auto rounded bg-black/40 p-2 text-[11px] leading-snug whitespace-pre-wrap break-words";

function Section({ title, open, children }: { title: ReactNode; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="border-t border-white/15 py-2">
      <summary className="cursor-pointer font-semibold">{title}</summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

export function DebugPanel() {
  const { visitId, askNow, agent, demo } = useBabel();
  const [mode, setMode] = useState<Mode>("off");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");

  const change = (m: Mode) => { setMode(m); try { localStorage.setItem(KEY, m); } catch { /* private mode */ } };

  useEffect(() => {
    const q = new URLSearchParams(location.search).get("debug");
    let stored: string | null = null;
    try { stored = localStorage.getItem(KEY); } catch { /* private mode */ }
    const start: Mode = q === "1" ? "open" : q === "0" || demo ? "off" : stored === "open" || stored === "pill" || stored === "off" ? stored : process.env.NODE_ENV !== "production" ? "pill" : "off";
    change(start);
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d")) return;
      e.preventDefault();
      setMode((m) => { const n: Mode = m === "open" ? "pill" : "open"; try { localStorage.setItem(KEY, n); } catch { /* private mode */ } return n; });
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [demo]);

  // Poll while open. The agent's own status changes (thinking → changed/held) fetch once more straight away.
  useEffect(() => {
    if (mode !== "open" || !visitId) return;
    let live = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/debug?visitId=${visitId}`, { cache: "no-store" });
        if (!live) return;
        if (!r.ok) { setError(r.status === 404 ? "Debug is off on this server (set BABEL_DEBUG=1)." : `debug feed: ${r.status}`); return; }
        setSnap(await r.json()); setError("");
      } catch { if (live) setError("debug feed unreachable"); }
    };
    load();
    const id = setInterval(load, 1500);
    return () => { live = false; clearInterval(id); };
  }, [mode, visitId, agent.state]);

  if (mode === "off") return null;
  const box = "fixed left-4 bottom-14 z-50 w-[27rem] max-w-[calc(100vw-2rem)] rounded-xl border border-white/20 bg-[#14171f] text-white shadow-2xl";
  if (mode === "pill") {
    return (
      <button onClick={() => change("open")} className="fixed left-4 bottom-14 z-50 rounded-full border border-white/20 bg-[#14171f] px-3 py-1.5 text-sm font-medium text-white shadow-lg hover:bg-[#232838]">
        Babel debug
      </button>
    );
  }

  const markers = Object.entries(snap?.markers ?? {});
  return (
    <aside className={box} style={{ fontSize: 13, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }} aria-label="Babel debug">
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <p className="font-semibold">Babel debug <span className="font-normal text-white/60">{snap ? `· ${snap.llm.mocked ? "mock" : snap.llm.model} · ${snap.template}${snap.productId ? ` ${snap.productId}` : ""}` : ""}</span></p>
        <div className="flex gap-1">
          <button onClick={() => change("pill")} className="rounded px-2 hover:bg-white/15" aria-label="Minimise debug panel">–</button>
          <button onClick={() => change("off")} className="rounded px-2 hover:bg-white/15" aria-label="Close debug panel">×</button>
        </div>
      </div>
      <div className="max-h-[75vh] overflow-auto px-3 pb-3">
        {error && <p className="mt-2 text-amber-300">{error}</p>}
        {!snap && !error && <p className="mt-2 text-white/60">Waiting for the visit to start…</p>}
        {snap && (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button onClick={askNow} disabled={snap.busy || snap.standardView || !snap.consent}
                className="rounded-full bg-white px-3 py-1 font-semibold text-[#14171f] disabled:opacity-40">Ask the AI now</button>
              <span className={snap.busy || agent.state === "thinking" ? "animate-pulse text-amber-300" : "text-white/70"}>
                {snap.busy ? "AI is thinking…" : agent.text}
              </span>
            </div>
            <p className="mt-1 text-white/60">
              {secs(snap.ageMs)} on page · {snap.minorCount} minor view{snap.minorCount === 1 ? "" : "s"} · zoom {snap.zoom}×
              {snap.returning && " · return visit"}{snap.standardView && " · standard view (agent off)"}{!snap.consent && " · no consent (nothing measured)"}
              {snap.pendingTriggers.length > 0 && ` · queued: ${snap.pendingTriggers.join(", ")}`}
            </p>

            <Section title="Markers" open>
              {markers.length === 0 ? <p className="text-white/60">Nothing measured yet. Scroll, open specs or policies, hover the price.</p> : (
                <ul className="flex flex-col gap-2">
                  {markers.map(([id, m]) => m && (
                    <li key={id}>
                      <div className="flex justify-between"><span>{id}</span><span>{m.value.toFixed(2)} {m.trend === "up" ? "▲" : m.trend === "down" ? "▼" : "–"}</span></div>
                      <div className="relative mt-0.5 h-2 rounded bg-white/15" role="img" aria-label={`${id} ${m.value}`}>
                        <div className={`h-2 rounded ${m.value >= THRESHOLD ? "bg-amber-300" : "bg-sky-300"}`} style={{ width: `${Math.round(m.value * 100)}%` }} />
                        <div className="absolute top-0 h-2 w-px bg-white" style={{ left: `${THRESHOLD * 100}%` }} title="trigger threshold 0.6" />
                      </div>
                      {m.evidence.length > 0 && <p className="mt-0.5 text-[11px] text-white/55">{m.evidence.map((e) => `${e.type}${e.note ? ` ${e.note}` : ""} @${Math.round(e.t / 1000)}s`).join(" · ")}</p>}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[11px] text-white/55">Line = 0.6, the level that calls the agent. Events so far: {Object.entries(snap.eventCounts).map(([k, n]) => `${k} ${n}`).join(", ") || "none"}</p>
            </Section>

            <Section title="Who the model thinks this is">
              {!snap.shopper ? <p className="text-white/60">No read yet.</p> : (
                <>
                  <p>suggests <b>{snap.shopper.suggested.dialect}</b> × <b>{snap.shopper.suggested.need}</b> · copy {snap.shopper.suggested.copyRegister} · conf {snap.shopper.suggested.confidence}</p>
                  <p className="text-[11px] text-white/55">dialect: {snap.shopper.suggested.dialectWhy} · need: {snap.shopper.suggested.needWhy} · stage {snap.shopper.stage} · buying for {snap.shopper.buyingFor}</p>
                  <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5">
                    {Object.entries(snap.shopper.traits).map(([t, v]) => (
                      <li key={t} className={v.confidence >= 0.55 ? "" : "text-white/40"}>{t} {v.value.toFixed(2)} <span className="text-[11px]">({v.confidence >= 0.55 ? `conf ${v.confidence}` : "unknown"})</span></li>
                    ))}
                  </ul>
                </>
              )}
            </Section>

            <Section title={`AI calls (${snap.calls.length})`} open>
              {snap.calls.length === 0 && <p className="text-white/60">The AI has not been asked yet. It is called when a marker crosses 0.6, after a zoom, or at a check-in with enough new activity. Or press “Ask the AI now”.</p>}
              {[...snap.calls].reverse().map((c, i) => (
                <details key={`${c.at}-${i}`} open={i === 0} className="mb-2 rounded bg-white/5 p-2">
                  <summary className="cursor-pointer">
                    <b>{c.kind === "slide" ? "changed the page" : "held"}</b> @{Math.round(c.at / 1000)}s · {c.triggers?.join(", ") || "?"} · {c.ms !== undefined ? secs(c.ms) : ""} · {c.rounds} round{c.rounds === 1 ? "" : "s"}
                  </summary>
                  <p className="mt-1 text-[11px] text-white/60">{c.text}</p>
                  <p className="mt-2 font-semibold">Sent to the AI <span className="font-normal text-white/55">(as &lt;data&gt;)</span></p>
                  <pre className={pre}>{c.llm.input}</pre>
                  <p className="mt-2 font-semibold">AI replied</p>
                  {c.llm.rounds.map((r, n) => (
                    <div key={n} className="mt-1 rounded bg-black/30 p-2">
                      <p className="text-[11px] text-white/60">round {n + 1} · {secs(r.ms)} · {r.verdict}</p>
                      {r.said && <pre className={pre}>{r.said}</pre>}
                      {r.call && <pre className={pre}>{r.call.name}({JSON.stringify(r.call.args, null, 1)})</pre>}
                    </div>
                  ))}
                  {c.clamps && c.clamps.length > 0 && <p className="mt-1 text-[11px] text-amber-200">brand clamp: {c.clamps.join("; ")}</p>}
                </details>
              ))}
              <details>
                <summary className="cursor-pointer text-white/70">Fixed context sent before every call (system prompt, this page&apos;s registry, brand ranges)</summary>
                <pre className={pre}>{snap.context.join("\n\n———\n\n")}</pre>
              </details>
            </Section>

            <Section title={`Page now · view ${snap.slide.index + 1} (${snap.slide.source})`}>
              <p>{snap.slide.persona.dialect} × {snap.slide.persona.need} · copy {snap.slide.copyRegister}</p>
              <ol className="mt-1 list-decimal pl-5">
                {[...snap.slide.blocks].sort((a, b) => a.order - b.order).map((b) => <li key={b.id}>{b.id}: {b.variant}{b.collapsed ? " (collapsed)" : ""}</li>)}
              </ol>
              <p className="mt-1 text-[11px] text-white/55">“{snap.slide.rationale}”</p>
            </Section>

            <Section title="Memory">
              {snap.memory
                ? <p>{snap.memory.visits} visit{snap.memory.visits === 1 ? "" : "s"} · profile {snap.memory.hasProfile ? "kept" : "empty"} · remembered views: {snap.memory.remembered.join(", ") || "none"}</p>
                : <p className="text-white/60">Nothing kept for this visitor (no consent or a ghost run).</p>}
            </Section>

            <Section title="Timeline">
              <ol className="flex flex-col gap-0.5 text-[11px]">
                {[...snap.trace].reverse().map((t, i) => <li key={i}><span className="text-white/50">{Math.round(t.at / 1000)}s {t.kind}</span> {t.text}</li>)}
              </ol>
            </Section>
          </>
        )}
      </div>
    </aside>
  );
}
