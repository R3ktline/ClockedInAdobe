"use client";
// The visible side of "adapting the page to the shopper" (prototype):
//   Invite         asked once, at the start: may this store adapt how its pages are laid out?
//   ViewNotice     after a change: what happened, Keep or Back; then a small "Your view" chip so it is never unexplained
//   TransitionLab  local comparison panel (?txlab=1): switch the look and watch how each transition feels
// Wording describes the view, never the shopper, and says the store itself does not change.
import { useEffect, useState } from "react";
import type { Dialect } from "@/babel/schema";

export const LOOK_LABEL: Record<Dialect, string> = { standard: "Standard", guided: "Guided", dense: "Detailed", visual: "Visual" };
export type Transition = "glass" | "fade" | "morph";
// A skin is a visual identity for the store frame (palette, type, texture, shape), taken from the five design pages.
// It is separate from the look above (layout and detail level) and is chosen by the shopper, never inferred.
export type Skin = "none" | "genx" | "alpha" | "alphadark" | "millennial" | "xp" | "print";
export const SKIN_LABEL: Record<Skin, string> = {
  none: "Store default", genx: "Glossy", alpha: "Bento", alphadark: "Bento dark", millennial: "Pastel", xp: "Y2K desktop", print: "Print",
};

const card = "pointer-events-auto rounded-2xl border border-white/70 bg-white/80 p-4 text-[#14171f] shadow-[0_18px_50px_rgba(20,23,31,.22)] backdrop-blur-md";
const btn = "rounded-full px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14171f]";

export function Invite({ open, onAnswer }: { open: boolean; onAnswer: (yes: boolean) => void }) {
  if (!open) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[8800] flex justify-center px-4" role="dialog" aria-label="Adapt this store to you">
      <div className={`${card} max-w-md`}>
        <p className="text-base font-semibold">Make this store fit the way you browse?</p>
        <p className="mt-1 text-sm text-[#4a5160]">
          We can adapt how pages are laid out as you go: text size, which sections come first, how products are listed.
          It is the same store with the same prices. You can switch back at any time.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className={`${btn} bg-[#14171f] text-white`} onClick={() => onAnswer(true)}>Yes, adapt it</button>
          <button className={`${btn} border border-[#14171f]/30`} onClick={() => onAnswer(false)}>No, keep it standard</button>
        </div>
      </div>
    </div>
  );
}

export function ViewNotice({ notice, dialect, standard, optedIn, onKeep, onBack }: {
  notice: { id: string; dialect: Dialect } | null;
  dialect: Dialect;
  standard: boolean;
  optedIn: boolean;
  onKeep: () => void;
  onBack: () => void;
}) {
  const [banner, setBanner] = useState(false);
  useEffect(() => {
    if (!notice) return;
    setBanner(true);
    const t = setTimeout(() => setBanner(false), 12_000);
    return () => clearTimeout(t);
  }, [notice]);

  if (notice && banner) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[8700] flex justify-center px-4" role="status">
        <div className={`${card} flex max-w-xl flex-wrap items-center gap-3`}>
          <p className="text-sm"><b>Laid out for you: {LOOK_LABEL[notice.dialect]}.</b> Same store, same prices.</p>
          <div className="flex gap-2">
            <button className={`${btn} bg-[#14171f] text-white`} onClick={() => { onKeep(); setBanner(false); }}>Keep</button>
            <button className={`${btn} border border-[#14171f]/30`} onClick={() => { onBack(); setBanner(false); }}>Back</button>
          </div>
        </div>
      </div>
    );
  }
  if (optedIn && !standard && dialect !== "standard") {
    return (
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[8600] -translate-x-1/2" aria-label="Current view">
        <span className="pointer-events-auto rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold text-[#14171f] shadow-md backdrop-blur-md">
          Your view: {LOOK_LABEL[dialect]}
        </span>
      </div>
    );
  }
  return null;
}

export function TransitionLab({ current, onPreview, skin, onSkin }: { current: Dialect; onPreview: (look: Dialect, tx: Transition) => void; skin: Skin; onSkin: (s: Skin, tx: Transition) => void }) {
  const [tx, setTx] = useState<Transition>("glass");
  const looks: Dialect[] = ["standard", "guided", "dense", "visual"];
  const txs: { id: Transition; hint: string }[] = [
    { id: "glass", hint: "glass curtain" }, { id: "fade", hint: "crossfade" }, { id: "morph", hint: "morph only" },
  ];
  const on = "bg-[#14171f] text-white";
  const off = "border border-[#14171f]/25 text-[#14171f]";
  return (
    <div className="pointer-events-none fixed right-3 top-16 z-[8500]" aria-label="Look switcher">
      <div className={`${card} w-64`}>
        <p className="text-xs font-bold uppercase tracking-wide text-[#4a5160]">Look switcher · prototype</p>
        <p className="mt-2 text-xs font-semibold">Look</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {looks.map((l) => (
            <button key={l} className={`${btn} !px-3 !py-1 ${current === l ? on : off}`} onClick={() => onPreview(l, tx)}>{LOOK_LABEL[l]}</button>
          ))}
        </div>
        <p className="mt-3 text-xs font-semibold">Skin</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {(Object.keys(SKIN_LABEL) as Skin[]).map((s) => (
            <button key={s} className={`${btn} !px-3 !py-1 ${skin === s ? on : off}`} onClick={() => onSkin(s, tx)}>{SKIN_LABEL[s]}</button>
          ))}
        </div>
        <p className="mt-3 text-xs font-semibold">Transition</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {txs.map((t) => (
            <button key={t.id} className={`${btn} !px-3 !py-1 ${tx === t.id ? on : off}`} onClick={() => setTx(t.id)}>{t.hint}</button>
          ))}
        </div>
        <p className="mt-3 text-xs text-[#4a5160]">Pick a transition, then a look. Morph shows what animates on its own; the font and layout swaps jump.</p>
      </div>
    </div>
  );
}
