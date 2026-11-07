"use client";
import { useEffect, useState } from "react";
import { memoryKey, type SavedMemory } from "@/babel/sdk/LabPanel";
import { modelInputs } from "@/babel/persona/modelInputs";
import { buildProfile, personaOf, type Groups } from "@/babel/persona/signalModel";
import type { PartnerContext } from "@/babel/schema";

// Formats to compare on the return visit, until the team settles on one. "auto" = the model decides.
const VARIANTS = [
  { id: "auto", title: "Model's choice", text: "Whatever the signal model reads from her memory and today's clicks." },
  { id: "visual.reassurance", title: "Photos + reassurance", text: "Big photos and short copy, with returns, warranty and reviews near the top." },
  { id: "standard.reassurance", title: "Normal layout + reassurance", text: "The store's usual layout, returns and warranty moved up." },
  { id: "visual.inspiration", title: "Photos only", text: "Big photos and short copy; nothing moved up." },
  { id: "standard.balanced", title: "Control: no personalization", text: "The store's normal page, to compare against." },
] as const;

const LABEL: Record<string, string> = {
  infoAppetite: "Wants detail", jargonComfort: "Comfortable with technical words", priceSensitivity: "Price matters",
  trustNeed: "Needs reassurance", inspirationAppetite: "Browses by photos", interactionFluency: "At ease with the site", confusion: "Seems lost",
};

export function LabHome({ id, label, start, revisitStart, partner }: { id: string; label: string; start: string; revisitStart: string; partner: PartnerContext }) {
  const [mem, setMem] = useState<SavedMemory | null>(null);
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    setClosed(new URLSearchParams(location.search).get("closed") === "1");
    try { const raw = localStorage.getItem(memoryKey(id)); setMem(raw ? JSON.parse(raw) : null); } catch { setMem(null); }
  }, [id]);

  // What the first page of visit 2 would open as, from memory alone (same code path as the server).
  const predicted = (() => {
    if (!mem) return null;
    const back = { ...partner, visitor: { returning: true, visits: partner.visitor.visits + 1 } };
    const { signals, context, declared } = modelInputs([], back);
    return personaOf(buildProfile(signals, declared, context, mem.groups as Groups, 0.6));
  })();

  const startVisit1 = () => {
    try { localStorage.removeItem(memoryKey(id)); } catch { /* ignore */ }
    location.assign(`${start}?ghost=${id}&step=0&lab=1`);
  };
  const forgetAll = () => { try { localStorage.removeItem(memoryKey(id)); } catch { /* ignore */ } setMem(null); };
  const openVisit2 = (variant: string) =>
    location.assign(`${revisitStart}?ghost=${id}&step=0&lab=1&visit=2${variant === "auto" ? "" : `&variant=${variant}`}`);

  const step = "rounded-xl border border-black/10 bg-white p-5 shadow-sm";
  return (
    <div className="min-h-screen bg-[#f3f5fb]">
    <main className="mx-auto max-w-3xl px-4 py-10 text-[#14171f]">
      <p className="text-sm font-bold tracking-wider text-[#5b6170] uppercase">Babel lab · Taraba, configured for one shopper</p>
      <h1 className="mt-1 text-4xl font-extrabold tracking-tight">{id[0].toUpperCase() + id.slice(1)}</h1>
      <p className="mt-2 text-lg text-[#3c4250]">{label}</p>
      <p className="mt-1 text-sm text-[#5b6170]">Synthetic shopper and data. The panel on the left of the store shows every indicator live. The format changes; the theme does not (later).</p>

      <section className={`${step} mt-6`}>
        <h2 className="text-xl font-bold">1 · First visit</h2>
        <p className="mt-1 text-[#3c4250]">She arrives from Pinterest, looks at the sofa&apos;s photos and dimensions, checks delivery and returns, browses the category, comes back to the sofa and leaves without buying.</p>
        <button onClick={startVisit1} className="mt-3 rounded-lg bg-[#2346d8] px-5 py-3 font-bold text-white">Start visit 1 (clears her memory)</button>
      </section>

      <section className={`${step} mt-4 ${closed ? "ring-2 ring-[#f5b301]" : ""}`}>
        <h2 className="text-xl font-bold">2 · She closed the site. What is remembered</h2>
        {closed && <p className="mt-1 font-semibold text-[#9a6b00]">The site is closed. The server has forgotten her; only her browser kept this.</p>}
        {mem ? (
          <>
            <p className="mt-1 text-[#3c4250]">Saved {new Date(mem.savedAt).toLocaleTimeString()} in this browser (consented storage). Only the model&apos;s group totals are kept, never the clicks themselves.</p>
            <ul className="mt-3 grid gap-1 sm:grid-cols-2">
              {mem.traits.map((t) => (
                <li key={t.name} className={t.used ? "font-semibold" : "text-[#5b6170]"}>
                  {LABEL[t.name] ?? t.name}: {t.value.toFixed(2)} · conf {t.conf.toFixed(2)} {t.used ? "✓ used" : "· neutral"}
                </li>
              ))}
            </ul>
            <p className="mt-3">At the end of visit 1 the model read her as <b>{mem.persona.dialect} × {mem.persona.need}</b>.</p>
            {predicted && (
              <p className="mt-1">If she comes back now, her first page opens as <b>{predicted.dialect} × {predicted.need}</b> before she clicks anything
                <span className="text-[#5b6170]"> (memory counts 60%, plus &quot;came back without buying&quot;)</span>.</p>
            )}
            <button onClick={forgetAll} className="mt-3 text-sm font-semibold text-[#2346d8] underline">Forget her (delete the memory)</button>
          </>
        ) : <p className="mt-1 text-[#5b6170]">Nothing remembered yet. Run visit 1 first.</p>}
      </section>

      <section className={`${step} mt-4`}>
        <h2 className="text-xl font-bold">3 · She comes back, days later</h2>
        <p className="mt-1 text-[#3c4250]">The page is built from her memory before she clicks. Then she checks returns and reviews again, and buys. Pick a format to compare:</p>
        <ul className="mt-3 flex flex-col gap-2">
          {VARIANTS.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 rounded-lg border border-black/10 p-3">
              <div>
                <p className="font-bold">{v.title} {v.id !== "auto" && <span className="font-normal text-[#5b6170]">· {v.id.replace(".", " × ")}</span>}</p>
                <p className="text-sm text-[#5b6170]">{v.text}</p>
              </div>
              <button disabled={!mem} onClick={() => openVisit2(v.id)} className="shrink-0 rounded-lg bg-[#14171f] px-4 py-2 font-bold text-white disabled:opacity-30">
                Open visit 2
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
    </div>
  );
}
