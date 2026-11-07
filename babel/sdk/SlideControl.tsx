"use client";
import { useEffect, useState } from "react";
import { useBabel } from "./BabelProvider";

const CHANGE_CARD_MS = 15_000;

// The shopper's control over Babel: page through views, see why, or switch personalization off.
// In ghost (testing) mode it also shows what the agent is doing and what the model answered.
export function SlideControl() {
  const { slides, cursor, go, standard, setStandard, slide, ghost, track, agent, lastChange, apply, calm } = useBabel();
  const [whyOpen, setWhyOpen] = useState(false);
  const [changeVisible, setChangeVisible] = useState(false);
  useEffect(() => {
    if (!lastChange || (apply !== "live" && !ghost)) return; // a popup is itself a noticeable change; "Why?" still has it
    setChangeVisible(true);
    const id = setTimeout(() => setChangeVisible(false), CHANGE_CARD_MS);
    return () => clearTimeout(id);
  }, [lastChange, apply, ghost]);
  const rerun = (mode: string) => { const u = new URL(location.href); u.searchParams.set("apply", mode); location.assign(u); };
  const noticed = calm.filter((c) => c.status === "seen").length;
  const WORD = { unseen: "unnoticed", seen: "noticeable", waiting: "waiting", requested: "asked for" } as const;

  const btn = "rounded-full px-3 py-1.5 text-sm font-medium hover:bg-black/5 disabled:opacity-35 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-primary)]";
  const box = "w-96 max-w-full rounded-xl border border-black/10 p-4 shadow-xl";
  const card = `${box} bg-white text-[#14171f]`;
  const changes = lastChange && (
    <>
      <p className="font-semibold">What changed · view {lastChange.from} → {lastChange.to}</p>
      <ul className="mt-1 list-disc pl-5 text-[#3c4250]">
        {lastChange.lines.map((l) => <li key={l}>{l}</li>)}
      </ul>
    </>
  );

  return (
    <div className="fixed right-4 bottom-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2" style={{ fontSize: 15 }}>
      {ghost && (
        <div className={`${box} bg-[#14171f] text-white`} role="status" aria-live="polite">
          <p><span className="font-semibold">Synthetic shopper · {ghost.label}</span> <span className="text-white/75">{ghost.note}</span></p>
          <p className="mt-1">
            <span className="font-semibold">Babel agent:</span>{" "}
            <span className={agent.state === "thinking" ? "animate-pulse text-amber-300" : "text-white/75"}>{agent.text}</span>
          </p>
          <div className="mt-2 border-t border-white/15 pt-2 text-sm">
            <p className="font-semibold">
              Unnoticed check{ghost.step > 0 && ` · page ${ghost.step + 1}`}{ghost.step < 0 && " · browsing freely, memory kept"}
              {apply !== "next" && calm.length > 0 && <span className="font-normal text-white/75"> · {noticed} of {calm.length} could be noticed</span>}
            </p>
            {apply === "next"
              ? <p className="mt-1 text-white/75">Nothing changes on this page. The next page opens with what this one learned.</p>
              : calm.length === 0
                ? <p className="mt-1 text-white/75">No change yet. {apply === "quiet" ? "Changes wait until they are off screen." : "Changes land at once."}</p>
                : <ul className="mt-1 list-disc pl-5 text-white/75">
                    {calm.map((c) => <li key={c.view}><span className="font-semibold text-white">view {c.view} · {WORD[c.status]}</span> {c.text}</li>)}
                  </ul>}
            <div className="mt-2 flex gap-1" role="group" aria-label="When changes appear on this page">
              {(["live", "quiet", "next"] as const).map((m) => (
                <button key={m} aria-pressed={apply === m} onClick={() => rerun(m)}
                  className="rounded-full border border-white/30 px-2.5 py-0.5 hover:bg-white/15 aria-pressed:bg-white aria-pressed:text-[#14171f]">
                  {m === "live" ? "Change live" : m === "quiet" ? "Change quietly" : "Next page only"}
                </button>
              ))}
            </div>
          </div>
          {agent.llm && (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-white/75">Model&apos;s answer · {agent.llm.model}</summary>
              <ol className="mt-2 flex max-h-72 flex-col gap-2 overflow-auto">
                {agent.llm.rounds.map((r, i) => (
                  <li key={i} className="rounded-lg bg-white/10 p-2">
                    <p className="text-white/60">round {i + 1} · {(r.ms / 1000).toFixed(1)}s · {r.verdict}</p>
                    {r.said && <p className="mt-1 whitespace-pre-wrap">{r.said}</p>}
                    {r.call && <pre className="mt-1 overflow-auto text-xs whitespace-pre-wrap">{r.call.name}({JSON.stringify(r.call.args, null, 1)})</pre>}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      )}
      {changeVisible && !whyOpen && lastChange && <div className={card} role="status">{changes}</div>}
      {whyOpen && (
        <div className={card} role="dialog" aria-label="Why this view">
          <p className="font-semibold">{standard ? "Standard view" : "Why this view?"}</p>
          <p className="mt-1 text-[#3c4250]">
            {standard ? "Personalization is off. Everyone sees this page." : slide.rationale}
          </p>
          {!standard && (
            <p className="mt-2 text-xs text-[#5b6170]">
              View {slide.persona.dialect} · focus {slide.persona.need} · chosen by {slide.source === "director" ? "the Babel agent" : "starting rules"}. Prices and product facts are the same for everyone.
            </p>
          )}
          {!standard && lastChange && <div className="mt-3 border-t border-black/10 pt-3">{changes}</div>}
        </div>
      )}
      <nav aria-label="Page views" className="flex items-center gap-1 rounded-full border border-black/10 bg-white p-1 text-[#14171f] shadow-lg">
        <button className={btn} onClick={() => go(-1)} disabled={standard || cursor === 0} aria-label="Previous view">◀</button>
        <span className="px-1 tabular-nums" aria-live="polite">{standard ? "–" : `${cursor + 1} / ${Math.max(1, slides.length)}`}</span>
        <button className={btn} onClick={() => go(1)} disabled={standard || cursor >= slides.length - 1} aria-label="Next view">▶</button>
        <button className={btn} aria-expanded={whyOpen} onClick={() => { if (!whyOpen) track("why_open"); setWhyOpen(!whyOpen); }}>Why?</button>
        <button className={btn} aria-pressed={standard} onClick={() => setStandard(!standard)}>
          {standard ? "Personalized view" : "Standard view"}
        </button>
      </nav>
    </div>
  );
}
