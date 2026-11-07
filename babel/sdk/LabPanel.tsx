"use client";
// Lab panel (testing only, ?lab=1): shows, live, what the shopper does, which indicators move,
// what the agent is watching, and when the page changes. It also writes the shopper's memory to
// the browser as they go, so closing the site and coming back works like it would for a real
// consented visitor (signal-model spec §3: capped group sums only, never raw events).
// Everything sits in the left column, so nothing covers the store; changes get only a small notice.
import { useEffect, useRef, useState } from "react";
import { useBabel } from "./BabelProvider";
import { describeEvent } from "./Ghost";

type Effect = { signal: string; trait: string; dir: string };
type Feed = {
  ageMs: number; returning: boolean; usedMemory: boolean; threshold: number;
  llm: { mocked: boolean; model: string };
  slide: { index: number; kind: string; source: string; persona: { dialect: string; need: string; confidence: number }; rationale: string; copyRegister: string };
  slides: number;
  events: { t: number; type: string; value?: string | number; blockId?: string; effects: Effect[] }[];
  pageSignals: string[]; contextSignals: string[];
  traits: { id: string; name: string; value: number; conf: number; used: boolean; groups: { group: string; sum: number }[] }[];
  stage?: string; buyingFor?: string;
  suggested: { dialect: string; need: string; confidence: number; dialectWhy: string; needWhy: string } | null;
  markers: Record<string, number>;
  trace: { at: number; kind: string; text: string }[];
  memory: Record<string, Record<string, number>> | null;
};

export const memoryKey = (shopper: string) => `babel.lab.memory.${shopper}`;
export type SavedMemory = {
  groups: Record<string, Record<string, number>>;
  savedAt: string;
  persona: { dialect: string; need: string };
  traits: { name: string; value: number; conf: number; used: boolean }[];
  pages: number;
};

const LABEL: Record<string, string> = {
  infoAppetite: "Wants detail", jargonComfort: "Comfortable with technical words", priceSensitivity: "Price matters",
  trustNeed: "Needs reassurance", inspirationAppetite: "Browses by photos", interactionFluency: "At ease with the site",
  confusion: "Seems lost",
};
const KIND: Record<string, string> = { visit: "page opened", trigger: "agent alerted", slide: "page changed", hold: "agent kept the page", result: "agent checked its bet", skip: "agent skipped" };

export function LabPanel() {
  const { visitId, ghost, lastChange, agent, slide, player } = useBabel();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [flash, setFlash] = useState<string[]>([]);
  const prevUsed = useRef<Record<string, boolean>>({});
  const [toast, setToast] = useState(false);
  const [freshChange, setFreshChange] = useState(false);
  const id = ghost?.label.toLowerCase() ?? "";

  useEffect(() => {
    if (!visitId) return;
    let stop = false;
    const tick = async () => {
      const f = await fetch(`/api/lab?visitId=${visitId}`).then((r) => r.json()).catch(() => null) as Feed | null;
      if (stop || !f || !("traits" in f)) return;
      setFeed(f);
      // A trait crossing the confidence line is the moment it starts to shape the page: flash it.
      const crossed = f.traits.filter((t) => prevUsed.current[t.id] !== undefined && prevUsed.current[t.id] !== t.used).map((t) => t.id);
      prevUsed.current = Object.fromEntries(f.traits.map((t) => [t.id, t.used]));
      if (crossed.length) { setFlash(crossed); setTimeout(() => setFlash([]), 3000); }
      // Remember as she goes (visit 1 only, so visit 2 can be replayed against the same memory).
      if (ghost?.visit !== 2 && f.memory && f.suggested) {
        const saved: SavedMemory = {
          groups: f.memory, savedAt: new Date().toISOString(),
          persona: { dialect: f.suggested.dialect, need: f.suggested.need },
          traits: f.traits.map(({ name, value, conf, used }) => ({ name, value, conf, used })),
          pages: Math.max(1, (ghost?.step ?? 0) + 1),
        };
        try { localStorage.setItem(memoryKey(id), JSON.stringify(saved)); } catch { /* storage blocked: no memory */ }
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => { stop = true; clearInterval(t); };
  }, [visitId, ghost?.visit, ghost?.step, id]);

  // A small notice over the store, and the details highlighted in the panel.
  useEffect(() => {
    if (!lastChange) return;
    setToast(true); setFreshChange(true);
    const a = setTimeout(() => setToast(false), 5000);
    const b = setTimeout(() => setFreshChange(false), 8000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [lastChange]);

  if (!ghost) return null;
  const s = feed?.slide;
  const pb = player?.state;
  const box = "rounded-lg bg-white/[0.06] p-3";
  const h = "mb-1.5 text-[11px] font-bold tracking-wider text-white/50 uppercase";
  const pill = "rounded-md border border-white/25 px-2.5 py-1 font-semibold hover:bg-white/10 disabled:opacity-30";
  const openedAdapted = lastChange && lastChange.from === lastChange.to;

  return (
    <>
      {toast && lastChange && (
        <div role="status" className="pointer-events-none fixed top-3 left-[390px] z-[70] rounded-full bg-[#f5b301] px-3 py-1 text-sm font-bold text-[#14171f] shadow-lg">
          ⚡ {openedAdapted ? "Page opened already adapted" : `Page changed · view ${lastChange.from} → ${lastChange.to}`} · details in the panel
        </div>
      )}
      <aside aria-label="Lab indicators" className="fixed top-0 left-0 z-[55] flex h-screen w-[370px] flex-col gap-2 overflow-y-auto bg-[#0e1117] p-3 text-[13px] text-white shadow-2xl" style={{ fontSize: 13 }}>
        <div>
          <p className="text-base font-extrabold">LAB · {ghost.label} · visit {ghost.visit ?? 1}{ghost.step >= 0 && ` · page ${ghost.step + 1}`}</p>
          <p className="text-white/60">
            {feed?.returning ? "Return visit. " : "First visit. "}
            {feed?.usedMemory ? (feed.returning ? "Memory: rebuilt from her last visit (old behaviour counts 60%)." : "Memory: carried from her earlier pages.") : "Memory: none yet, everything starts neutral."}
          </p>
          {feed && (
            <p className={`mt-1 font-semibold ${feed.llm.mocked ? "text-white/60" : "text-[#4ade80]"}`}>
              Agent brain: {feed.llm.mocked ? "stand-in rules (no DeepSeek key)" : `DeepSeek · ${feed.llm.model || "model from .env.local"}`}
            </p>
          )}
        </div>

        {pb && (
          <div className={`${box} ${pb.paused ? "ring-2 ring-[#60a5fa]" : ""}`}>
            <p className={h}>Playback · step {pb.done} of {pb.total}{pb.paused && " · PAUSED"}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {pb.paused
                ? <button className={pill} onClick={player!.play} title="Plays on without stopping">▶ Play</button>
                : <button className={pill} onClick={player!.pause}>⏸ Pause</button>}
              <button className={pill} onClick={player!.step} disabled={!pb.next}>⏭ Next step</button>
              <label className="ml-1 flex items-center gap-1.5 text-white/80">
                <input type="checkbox" checked={pb.stepMode} onChange={(e) => player!.setStepMode(e.target.checked)} />
                pause after each step
              </label>
            </div>
            <p className="mt-1.5 text-white/60">{pb.next ? <>Next: <b className="text-white">{pb.next}</b></> : "Script finished for this page."}</p>
            {pb.paused && <p className="text-[11px] text-white/45">She stops acting; the page, the indicators and the agent keep reacting to what she already did.</p>}
          </div>
        )}

        <div className={`${box} transition-shadow ${freshChange ? "ring-2 ring-[#f5b301]" : ""}`}>
          <p className={h}>Last change to the page</p>
          {lastChange ? (
            <>
              <p className="font-bold text-[#f5b301]">
                {openedAdapted
                  ? `Opened already adapted${feed?.usedMemory ? (feed.returning ? " · from her last visit" : " · from her earlier pages") : ""}`
                  : `Changed while she was on it · view ${lastChange.from} → ${lastChange.to}`}
              </p>
              <ul className="mt-1 list-disc pl-4 text-white/85">{lastChange.lines.map((l) => <li key={l}>{l}</li>)}</ul>
              <p className="mt-1 text-white/60">Why: {lastChange.rationale}</p>
            </>
          ) : <p className="text-white/60">The store&apos;s normal page, nothing changed yet.</p>}
        </div>

        <div className={`${box} ${s?.kind === "major" ? "ring-1 ring-[#f5b301]/60" : ""}`}>
          <p className={h}>On screen now</p>
          {s ? (
            <>
              <p className="text-base font-bold">View {s.index + 1}: {s.persona.dialect} × {s.persona.need}</p>
              <p className="text-white/70">
                {s.kind === "major" ? "Rebuilt from memory on return · " : s.kind === "initial" ? "First view of this page · " : ""}
                chosen by {s.source === "director" ? "the agent" : s.source === "explicit" ? "the lab (forced variant)" : "the rules"} · copy {s.copyRegister}
              </p>
            </>
          ) : <p className="text-white/60">waiting for the page…</p>}
          {ghost.variant && <p className="mt-1 font-semibold text-[#f5b301]">Forced variant: {ghost.variant.dialect} × {ghost.variant.need} (locked)</p>}
        </div>

        <div className={box}>
          <p className={h}>What she just did → which signal it became</p>
          {feed?.events.length ? (
            <ul className="flex flex-col gap-1">
              {feed.events.map((e, i) => (
                <li key={`${e.t}-${i}`} className={i === 0 ? "font-semibold" : "text-white/70"}>
                  <span className="text-white/40 tabular-nums">{(e.t / 1000).toFixed(1)}s</span> {describeEvent(e as never)}
                  {e.effects.length > 0 && (
                    <span className="ml-1">
                      {e.effects.map((x) => (
                        <span key={x.signal + x.trait} className="mr-1 inline-block rounded bg-[#2346d8]/60 px-1.5 text-[11px]">
                          {x.trait === "intent stage" ? `${x.signal} → stage` : `${LABEL[x.trait] ?? x.trait} ${x.dir}`}
                        </span>
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="text-white/60">nothing yet</p>}
          {!!feed?.contextSignals.length && <p className="mt-1 text-white/50">From what the store shared: {feed.contextSignals.join(", ")}</p>}
          {!!feed?.pageSignals.length && <p className="text-white/50">Over the whole page: {feed.pageSignals.join(", ")}</p>}
        </div>

        <div className={box}>
          <p className={h}>Indicators (signal model) · bar = value · line = {feed?.threshold ?? 0.55} confidence needed</p>
          <ul className="flex flex-col gap-2">
            {(feed?.traits ?? []).map((t) => (
              <li key={t.id} className={`rounded p-1 transition-colors ${flash.includes(t.id) ? "bg-[#f5b301]/30" : ""}`}>
                <div className="flex justify-between">
                  <span className={t.used ? "font-bold" : "text-white/60"}>{LABEL[t.name] ?? t.name}</span>
                  <span className="tabular-nums text-white/70">
                    {t.value.toFixed(2)} · conf {t.conf.toFixed(2)} {t.used ? <b className="text-[#4ade80]">USED</b> : <span className="text-white/40">neutral</span>}
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 rounded bg-white/10"><div className="h-1.5 rounded bg-[#60a5fa]" style={{ width: `${t.value * 100}%` }} /></div>
                <div className="relative mt-0.5 h-1 rounded bg-white/10">
                  <div className={`h-1 rounded ${t.used ? "bg-[#4ade80]" : "bg-white/40"}`} style={{ width: `${t.conf * 100}%` }} />
                  <div className="absolute top-[-2px] h-2 w-px bg-[#f5b301]" style={{ left: `${(feed?.threshold ?? 0.55) * 100}%` }} />
                </div>
                {t.groups.length > 0 && <p className="mt-0.5 text-[11px] text-white/45">{t.groups.map((g) => `${g.group} ${g.sum > 0 ? "+" : ""}${g.sum}`).join(" · ")}</p>}
              </li>
            ))}
          </ul>
          {feed && <p className="mt-2 text-white/60">Buying stage: <b className="text-white">{feed.stage}</b></p>}
        </div>

        {feed?.suggested && (
          <div className={box}>
            <p className={h}>The model reads her as</p>
            <p className="text-base font-bold">{feed.suggested.dialect} × {feed.suggested.need}</p>
            <p className="text-white/70">layout: {feed.suggested.dialectWhy} · focus: {feed.suggested.needWhy}</p>
          </div>
        )}

        <div className={box}>
          <p className={h}>The agent is watching</p>
          <p className={agent.state === "thinking" ? "animate-pulse font-semibold text-[#f5b301]" : ""}>{agent.text}</p>
          <ul className="mt-1 grid grid-cols-2 gap-x-2 text-white/70">
            {Object.entries(feed?.markers ?? {}).map(([k, v]) => (
              <li key={k} className={v >= 0.6 ? "font-bold text-[#f5b301]" : ""}>{k} {v.toFixed(2)}{v >= 0.6 ? " ⚑" : ""}</li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-white/45">⚑ = crossed 0.6, the agent is called at the next pause</p>
          <ul className="mt-2 flex flex-col gap-1 border-t border-white/10 pt-2">
            {(feed?.trace ?? []).map((t, i) => (
              <li key={i} className="text-white/75"><span className="text-white/40 tabular-nums">{(t.at / 1000).toFixed(1)}s</span> <b>{KIND[t.kind] ?? t.kind}:</b> {t.text}</li>
            ))}
          </ul>
          {agent.llm && agent.llm.rounds.length > 0 && (
            <details className="mt-2 border-t border-white/10 pt-2">
              <summary className="cursor-pointer font-semibold">The agent&apos;s own answer · {agent.llm.model}</summary>
              <ol className="mt-1 flex flex-col gap-1.5">
                {agent.llm.rounds.map((r, i) => (
                  <li key={i} className="rounded bg-white/5 p-2">
                    <p className="text-white/50">round {i + 1} · {(r.ms / 1000).toFixed(1)}s · {r.verdict}</p>
                    {r.said && <p className="mt-1 whitespace-pre-wrap">{r.said}</p>}
                    {r.call && <pre className="mt-1 overflow-auto text-[11px] whitespace-pre-wrap">{r.call.name}({JSON.stringify(r.call.args, null, 1)})</pre>}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-2">
          {ghost.last && (ghost.visit ?? 1) === 1 && (
            // Buttons, not links: the ghost carries itself along internal links, and closing must not.
            <button onClick={() => location.assign(`/lab/${id}?closed=1`)} className="rounded-lg bg-[#f5b301] px-3 py-2 text-center font-bold text-[#14171f]">
              Close the site (end visit 1) — her behaviour is remembered
            </button>
          )}
          <button onClick={() => location.assign(`/lab/${id}`)} className="rounded-lg border border-white/25 px-3 py-2 text-center">Back to the lab</button>
          <p className="text-[11px] text-white/40">Synthetic shopper. All numbers are simulated. View {slide.index + 1} is on screen.</p>
        </div>
      </aside>
    </>
  );
}
