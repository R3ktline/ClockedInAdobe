"use client";
// Bare merchant panel (foundation): live markers and the Director's trace per visit. Track D owns it from Phase 2.
import { useEffect, useState } from "react";
import type { MarkerId, Markers, Persona } from "@/babel/schema";
import type { TraceEntry } from "@/babel/session";

type Feed = {
  llm: { mocked: boolean; model: string; calls: number; errors: number; cacheHitTokens: number; cacheMissTokens: number; outputTokens: number };
  defaults: {
    id: string; store: string; template: string; rationale: string; evidence: string[]; simulated: boolean; mocked: boolean; at: number; active: boolean;
    changes: { id: string; variant?: string; order?: number; collapsed?: boolean }[];
  }[];
  visits: {
    id: string; store: string; template: string; productId?: string; returning: boolean; standardView: boolean;
    ageMs: number; persona: Persona; markers: Markers; events: number; trace: TraceEntry[];
    shopper: Shopper | null;
    slides: { index: number; kind: string; source: string; rationale: string }[];
  }[];
};

type Shopper = {
  suggested: { dialect: string; need: string; confidence: number; dialectWhy: string; needWhy: string; copyRegister: string; giftContext: boolean };
  traits: Record<string, { value: number; confidence: number }>;
  stage: string;
  buyingFor: string;
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

  const [looking, setLooking] = useState(false);
  const [lastRun, setLastRun] = useState<{ store: string; template: string; outcome: string; reason: string }[] | null>(null);
  const analyze = async () => {
    setLooking(true);
    try { setLastRun((await fetch("/api/insights", { method: "POST", body: JSON.stringify({ action: "analyze" }) }).then((r) => r.json())).results); }
    catch { setLastRun([]); }
    setLooking(false);
  };
  const revert = (id: string) => fetch("/api/insights", { method: "POST", body: JSON.stringify({ action: "revert", id }) });

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
      <section className="mx-6 mt-6 rounded-xl border border-black/10 bg-white p-5" aria-labelledby="insights-h">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="insights-h" className="font-bold">What shoppers have in common</h2>
          <button onClick={analyze} disabled={looking} className="rounded-lg bg-[#2346d8] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
            {looking ? "Looking…" : "Look across all shoppers"}
          </button>
          <span className="text-sm text-[#5b6170]">Changes the agent keeps making for many shoppers become the store’s starting view for new visits.</span>
        </div>
        {lastRun && (
          <ul className="mt-3 text-sm text-[#3c4250]">
            {!lastRun.length && <li>No shoppers to look at yet. Replay a few ghost shoppers first.</li>}
            {lastRun.map((r, i) => <li key={i}>{r.store} · {r.template}: {r.outcome === "applied" ? "applied" : r.outcome === "hold" ? "held" : "nothing yet"} — {r.reason}</li>)}
          </ul>
        )}
        <ul className="mt-3 flex flex-col gap-3">
          {feed?.defaults.map((d) => (
            <li key={d.id} className={`rounded-lg border p-3 text-sm ${d.active ? "border-emerald-300 bg-emerald-50" : "border-black/10 bg-slate-50 text-[#5b6170]"}`}>
              <p className="font-semibold">
                {d.store} · {d.template} · {d.changes.map((c) => [c.id + ":", c.variant?.replaceAll("_", " "), c.collapsed !== undefined && (c.collapsed ? "collapsed" : "expanded"), c.order && `(position ${c.order})`].filter(Boolean).join(" ")).join(", ")}
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-900">{d.simulated ? "simulated sessions" : "live sessions"}</span>
                {d.mocked && <span className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-xs font-bold text-slate-700">mock LLM</span>}
                <span className="ml-1 text-xs font-bold">{d.active ? "ACTIVE for new visits" : "reverted"}</span>
              </p>
              <p className="mt-1">{d.rationale}</p>
              <ul className="mt-1 list-disc pl-5 text-xs text-[#5b6170]">{d.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
              {d.active && <button onClick={() => revert(d.id)} className="mt-2 rounded border border-black/20 bg-white px-2 py-1 text-xs font-semibold">Revert</button>}
            </li>
          ))}
          {feed && !feed.defaults.length && <li className="text-sm text-[#5b6170]">No store defaults yet.</li>}
        </ul>
      </section>
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
            {visit.shopper && (
              <section className="rounded-xl border border-black/10 bg-white p-5">
                <h2 className="font-bold">Who is this shopper? <span className="font-normal text-[#5b6170]">· signal model (David), confidence below 0.55 = not known</span></h2>
                <p className="mt-2 text-sm">
                  Suggests <span className="font-semibold">{visit.shopper.suggested.dialect} × {visit.shopper.suggested.need}</span>
                  {" "}(confidence {visit.shopper.suggested.confidence.toFixed(2)}) · dialect: {visit.shopper.suggested.dialectWhy} · need: {visit.shopper.suggested.needWhy}
                  {" "}· stage {visit.shopper.stage} · for {visit.shopper.buyingFor} · wording {visit.shopper.suggested.copyRegister}
                </p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {Object.entries(visit.shopper.traits).map(([name, t]) => {
                    const sure = t.confidence >= 0.55;
                    return (
                      <li key={name} className="grid grid-cols-[10rem_1fr_6.5rem] items-center gap-2 text-sm">
                        <span className={sure ? "font-semibold" : "text-[#5b6170]"}>{name}</span>
                        <div className="relative h-2.5 rounded-full bg-slate-100" role="meter" aria-label={name} aria-valuenow={t.value} aria-valuemin={0} aria-valuemax={1}>
                          <div className="absolute top-0 bottom-0 w-px bg-black/25" style={{ left: "50%" }} />
                          <div className={`h-full rounded-full ${sure ? "bg-[#2346d8]" : "bg-slate-300"}`} style={{ width: `${t.value * 100}%`, opacity: 0.35 + 0.65 * t.confidence }} />
                        </div>
                        <span className="tabular-nums text-[#3c4250]">{t.value.toFixed(2)} · c {t.confidence.toFixed(2)}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

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
                      <p className="mt-1 text-xs text-[#5b6170]">{t.rounds} round{t.rounds === 1 ? "" : "s"} · {t.ms} ms · {t.mocked ? "mock LLM" : t.llm?.model || "live LLM"}</p>
                    )}
                    {t.llm && (
                      <details className="mt-2 rounded-lg bg-slate-50 p-2" open={i === 0 && t.kind !== "trigger"}>
                        <summary className="cursor-pointer text-xs font-semibold text-[#3c4250]">LLM conversation · {t.llm.model}</summary>
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-[#5b6170]">What the agent was shown</summary>
                          <pre className="mt-1 max-h-64 overflow-auto rounded bg-white p-2 text-xs">{t.llm.input}</pre>
                        </details>
                        <ol className="mt-2 flex flex-col gap-2">
                          {t.llm.rounds.map((r, j) => (
                            <li key={j} className="rounded bg-white p-2 text-xs">
                              <p className="font-semibold">round {j + 1} · {(r.ms / 1000).toFixed(1)}s · {r.verdict}</p>
                              {r.said && <p className="mt-1 whitespace-pre-wrap text-[#3c4250]">said: {r.said}</p>}
                              {r.call && <pre className="mt-1 overflow-auto whitespace-pre-wrap">{r.call.name}({JSON.stringify(r.call.args, null, 1)})</pre>}
                            </li>
                          ))}
                        </ol>
                      </details>
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
