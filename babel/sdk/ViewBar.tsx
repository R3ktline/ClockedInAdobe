"use client";
// The shopper's controls, always visible (GDPR Art. 21, DSA Art. 27/38): why this view, undo, Standard view,
// style, ask the assistant, forget me. The ghost overlay (demo) shows what the shopper and the agent are doing.
import { useState } from "react";
import Link from "next/link";
import type { Skin } from "@/babel/schema";
import { SKIN_NAMES } from "@/babel/persona/skin";
import { useBabel } from "./BabelProvider";

const SKINS: Skin[] = ["none", "alpha", "alphadark", "genx", "millennial", "xp", "print"];
const btn = "rounded-full px-3 py-1.5 text-[13px] font-semibold leading-none transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white";

export function ViewBar() {
  const b = useBabel();
  const [open, setOpen] = useState<"why" | "style" | null>(null);
  if (b.consent === "no" || b.consent === "unset") {
    return b.consent === "no" ? (
      <div className="babel-ui fixed right-3 bottom-3 z-[70] rounded-full bg-[#14171f] px-3 py-1.5 text-[13px] text-white shadow-lg">
        Standard store · Babel is off · <button className="underline" onClick={() => b.answerConsent(true)}>Turn on</button>
      </div>
    ) : null;
  }
  const standard = b.view.kind === "standard";
  return (
    <>
      {b.ghost && (
        <div className="babel-ui fixed top-3 right-3 z-[70] w-[min(340px,calc(100vw-24px))] rounded-xl bg-[#14171f]/95 p-3 text-[13px] leading-snug text-white shadow-xl" role="status">
          <p className="font-bold">Ghost shopper: {b.ghost.label} <span className="font-normal text-white/60">· page {b.ghost.step + 1}{b.ghost.visit === 2 ? " · return visit" : ""} · simulated</span></p>
          <p className="mt-1 text-white/85">▸ {b.ghostNote || "arrives"}</p>
          <p className="mt-1"><span className="text-white/60">Babel agent ({b.llm.mocked ? "offline stand-in" : b.llm.model}):</span> {b.agent.text}</p>
          <p className="mt-1 text-white/60">This page opened as <b className="text-white">{b.view.kind}</b> · {b.view.persona.dialect} × {b.view.persona.need} · source {b.view.source}</p>
          {b.changes.length > 0 && <ul className="mt-1 list-disc pl-4 text-white/80">{b.changes.slice(0, 5).map((c) => <li key={c}>{c}</li>)}</ul>}
          <p className="mt-1 text-white/60"><Link className="underline" href="/merchant" target="_blank">Open the merchant panel</Link></p>
        </div>
      )}
      {open === "why" && (
        <div className="babel-ui fixed right-3 bottom-16 z-[70] w-[min(360px,calc(100vw-24px))] rounded-xl bg-white p-4 text-[14px] leading-snug text-[#14171f] shadow-2xl ring-1 ring-black/10" role="dialog" aria-label="Why this view">
          <p className="font-bold">Why this view?</p>
          <p className="mt-1">{b.view.rationale}</p>
          <ul className="mt-2 list-disc pl-5 text-[#3d4352]">{b.why.map((w) => <li key={w}>{w}</li>)}</ul>
          <p className="mt-2 text-[12px] text-[#5b6170]">Same products and same prices for everyone. Babel only changes how this store's pages are laid out. <Link className="underline" href="/how-babel-adapts">How Babel adapts this store</Link></p>
        </div>
      )}
      {open === "style" && (
        <div className="babel-ui fixed right-3 bottom-16 z-[70] w-[240px] rounded-xl bg-white p-2 text-[14px] text-[#14171f] shadow-2xl ring-1 ring-black/10" role="menu" aria-label="Style">
          {SKINS.map((s) => (
            <button key={s} role="menuitemradio" aria-checked={b.view.skin === s} disabled={standard}
              onClick={() => { void b.explicit({ skin: s }, "style"); setOpen(null); }}
              className={`block w-full rounded-lg px-3 py-2 text-left hover:bg-black/5 disabled:opacity-40 ${b.view.skin === s ? "font-bold" : ""}`}>
              {b.view.skin === s ? "● " : "○ "}{SKIN_NAMES[s]}
            </button>
          ))}
        </div>
      )}
      <nav aria-label="Babel view controls" className="babel-ui fixed right-3 bottom-3 z-[70] flex flex-wrap items-center gap-1 rounded-full bg-[#14171f] p-1 text-white shadow-lg">
        <span className="hidden px-2 text-[12px] text-white/70 sm:inline">{standard ? "Standard view" : b.view.source === "none" ? "Babel is watching, nothing adapted yet" : "Adapted by Babel"}</span>
        <button className={btn} aria-expanded={open === "why"} onClick={() => { setOpen(open === "why" ? null : "why"); if (open !== "why") b.track("why_open"); }}>Why?</button>
        {!standard && b.view.source !== "none" && <button className={btn} onClick={() => void b.undo()} title="Show this page without the last change">◀ Previous view</button>}
        <button className={btn} aria-pressed={standard} onClick={() => void b.setStandard(!standard)}>{standard ? "Turn Babel on" : "Standard view"}</button>
        <button className={btn} aria-expanded={open === "style"} onClick={() => setOpen(open === "style" ? null : "style")}>Style</button>
        <button className={btn} aria-expanded={b.chatOpen} onClick={() => b.setChatOpen(!b.chatOpen)}>Ask AI</button>
        <button className={`${btn} text-white/70`} onClick={() => void b.forgetMe()} title="Delete what Babel remembers about you">Forget me</button>
      </nav>
    </>
  );
}
