"use client";
// Bare merchant panel (foundation): live markers and the Director's trace per visit. Track D owns it from Phase 2.
import { useEffect, useState } from "react";
import type { MarkerId, Markers, Persona } from "@/babel/schema";
import type { TraceEntry } from "@/babel/session";

type Feed = {
  llm: { mocked: boolean; model: string; calls: number; errors: number; cacheHitTokens: number; cacheMissTokens: number; outputTokens: number };
  visits: {
    id: string; store: string; template: string; productId?: string; returning: boolean; standardView: boolean;
    ageMs: number; persona: Persona; markers: Markers; events: number; trace: TraceEntry[];
    slides: { index: number; kind: string; source: string; rationale: string }[];
  }[];
};

const KIND_STYLE: Record<TraceEntry["kind"], string> = {
  visit: "bg-slate-100 text-slate-700",
  trigger: "bg-amber-100 text-amber-900",
  slide: "bg-blue-100 text-blue-900",
  hold: "bg-slate-200 text-slate-700",
  result: "bg-emerald-100 text-emerald-900",
  skip: "bg-slate-100 text-slate-500",
};
const ARROW = { up: "↑", down: "↓", flat: "→" } as const;

export default function Merchant() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const load = () => fetch("/api/merchant").then((r) => r.json()).then(setFeed).catch(() => {});
    load();
    const id = setInterval(load, 1000);
    return () => clearInterval(id);
  }, []);

  const visit = feed?.visits.find((v) => v.id === selected) ?? feed?.visits[0];

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-[#14171f]">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-black/10 bg-white px-6 py-4">
        <h1 className="text-xl font-extrabold">Babel · merchant panel</h1>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">simulated shoppers</span>
        {feed && (
          <span className="text-sm text-[#5b6170]">
            LLM: {feed.llm.mocked ? "mock (no API key)" : feed.llm.model} · {feed.llm.calls} calls
            {feed.llm.errors ? ` · ${feed.llm.errors} errors` : ""} · tokens: {feed.llm.cacheHitTokens} cached in,{" "}
            {feed.llm.cacheMissTokens} uncached in, {feed.llm.outputTokens} out
          </span>
        )}
      </header>
      <div className="grid gap-6 p-6 md:grid-cols-[18rem_1fr]">
        <nav aria-label="Visits" className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase text-[#5b6170]">Live visits</h2>
          {!feed?.visits.length && <p className="text-sm text-[#5b6170]">No visits yet. Open a store page.</p>}
          {feed?.visits.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelected(v.id)}
              aria-current={v.id === visit?.id}
              className={`rounded-lg border p-3 text-left text-sm ${v.id === visit?.id ? "border-[#2346d8] bg-white" : "border-black/10 bg-white/60"}`}
            >
              <p className="font-semibold">{v.store} · {v.template}{v.productId ? ` · ${v.productId}` : ""}</p>
              <p className="text-[#5b6170]">
                {v.persona.dialect} × {v.persona.need} · {v.slides.length} slide{v.slides.length === 1 ? "" : "s"} · {Math.round(v.ageMs / 1000)}s
                {v.standardView ? " · standard view" : ""}
              </p>
            </button>
          ))}
        </nav>

        {visit && (
          <main className="flex flex-col gap-6">
            <section className="rounded-xl border border-black/10 bg-white p-5">
              <h2 className="font-bold">Markers <span className="font-normal text-[#5b6170]">· {visit.events} events</span></h2>
              <ul className="mt-3 flex flex-col gap-3">
                {(Object.entries(visit.markers) as [MarkerId, NonNullable<Markers[MarkerId]>][]).map(([id, m]) => (
                  <li key={id} className="grid grid-cols-[9rem_1fr_4rem] items-center gap-3 text-sm">
                    <span className="font-semibold">{id}</span>
                    <div className="h-2.5 rounded-full bg-slate-100" role="meter" aria-label={id} aria-valuenow={m.value} aria-valuemin={0} aria-valuemax={1}>
                      <div className={`h-full rounded-full ${m.value >= 0.6 ? "bg-amber-500" : "bg-[#2346d8]"}`} style={{ width: `${m.value * 100}%` }} />
                    </div>
                    <span className="tabular-nums">{m.value.toFixed(2)} {ARROW[m.trend]}</span>
                    {m.evidence.length > 0 && (
                      <p className="col-span-3 -mt-2 text-xs text-[#5b6170]">
                        evidence: {m.evidence.map((e) => `${e.type}${e.note ? ` (${e.note})` : ""} @${(e.t / 1000).toFixed(1)}s`).join(" · ")}
                      </p>
                    )}
                  </li>
                ))}
                {!Object.keys(visit.markers).length && <li className="text-sm text-[#5b6170]">No signals yet.</li>}
              </ul>
            </section>

            <section className="rounded-xl border border-black/10 bg-white p-5">
              <h2 className="font-bold">Director trace</h2>
              <ol className="mt-3 flex flex-col gap-3">
                {[...visit.trace].reverse().map((t, i) => (
                  <li key={i} className="border-l-2 border-black/10 pl-3 text-sm">
                    <p>
                      <span className={`mr-2 rounded px-1.5 py-0.5 text-xs font-bold ${KIND_STYLE[t.kind]}`}>{t.kind}</span>
                      <span className="tabular-nums text-[#5b6170]">{(t.at / 1000).toFixed(1)}s</span>{" "}
                      {t.text}
                    </p>
                    {t.hypothesis && t.kind === "slide" && (
                      <p className="mt-1 text-[#3c4250]">bet: {t.hypothesis.marker} goes {t.hypothesis.expect} within {t.hypothesis.withinSeconds}s</p>
                    )}
                    {t.diff && t.diff.length > 0 && <p className="mt-1 text-[#3c4250]">{t.kind === "visit" ? "rules: " : "changed: "}{t.diff.join(" · ")}</p>}
                    {t.errors?.map((e, j) => <p key={j} className="mt-1 text-red-700">rejected, repaired: {e.join("; ")}</p>)}
                    {t.clamps && t.clamps.length > 0 && <p className="mt-1 text-amber-800">brand clamp: {t.clamps.join("; ")}</p>}
                    {t.ms !== undefined && (
                      <p className="mt-1 text-xs text-[#5b6170]">{t.rounds} round{t.rounds === 1 ? "" : "s"} · {t.ms} ms · {t.mocked ? "mock LLM" : "DeepSeek"}</p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          </main>
        )}
      </div>
    </div>
  );
}
