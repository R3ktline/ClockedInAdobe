"use client";
import { useState } from "react";
import { useBabel } from "./BabelProvider";

// The shopper's control over Babel: page through slides, see why, or switch personalization off.
export function SlideControl() {
  const { slides, cursor, go, standard, setStandard, slide, ghost, track } = useBabel();
  const [whyOpen, setWhyOpen] = useState(false);
  const btn = "rounded-full px-3 py-1.5 text-sm font-medium hover:bg-black/5 disabled:opacity-35 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-primary)]";

  return (
    <div className="fixed right-4 bottom-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2 text-[15px]" style={{ fontSize: 15 }}>
      {ghost && (
        <div className="rounded-xl bg-[#14171f] px-3 py-2 text-white shadow-lg" role="status" aria-live="polite">
          <span className="font-semibold">Synthetic shopper · {ghost.label}</span>
          {ghost.note && <span className="text-white/75"> {ghost.note}</span>}
        </div>
      )}
      {whyOpen && (
        <div className="w-80 max-w-full rounded-xl border border-black/10 bg-white p-4 text-[#14171f] shadow-xl" role="dialog" aria-label="Why this view">
          <p className="font-semibold">{standard ? "Standard view" : "Why this view?"}</p>
          <p className="mt-1 text-[#3c4250]">
            {standard ? "Personalization is off. Everyone sees this page." : slide.rationale}
          </p>
          {!standard && (
            <p className="mt-2 text-xs text-[#5b6170]">
              View {slide.persona.dialect} · focus {slide.persona.need} · chosen by {slide.source === "director" ? "the Babel agent" : "starting rules"}. Prices and product facts are the same for everyone.
            </p>
          )}
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
