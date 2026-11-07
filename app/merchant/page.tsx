"use client";
// The merchant panel (/merchant): live visits, the 13 markers, the signal model's read, the Director's trace
// (observed → bet → plan → result), the guardrail log, and the LLM cost meter. Every number is from synthetic
// sessions and labelled simulated.
import Link from "next/link";
import { useEffect, useState } from "react";

type Marker = { value: number; trend: "up" | "flat" | "down"; evidence?: { t: number; page: number; type: string; note?: string }[]; top?: { key: string; value: number }[] };
type Brief = { id: string; who: string; consent: boolean; returning: boolean; number: number; pages: number; persona: string; kind?: string; stage: string; markers: Record<string, Marker>; directorRuns: number; standard: boolean; lastActiveAt: number };
type Trace = { at: number; kind: string; text: string; page?: number; diff?: string[]; errors?: string[][]; clamps?: string[]; rounds?: number; ms?: number; mocked?: boolean; met?: boolean | null; llm?: { model: string; input: string; rounds: { said: string; call?: { name: string; args: unknown }; verdict: string; ms: number }[] } };
type Detail = Brief & {
  traits: Record<string, { value: number; conf: number; source: string }> | null;
  model: { dialect: string; need: string; confidence: number; dialectWhy: string; needWhy: string; copyRegister: string };
  pages: { index: number; template: string; path: string; confirmed: boolean; planId?: string; views: { kind: string; source: string; persona: { dialect: string; need: string }; skin: string; rationale: string }[] }[];
  plan?: { id: string; plan: { need?: string; dialect?: string; rationale: string; hypothesis: { marker: string; expect: string; withinSeconds: number; outcome?: string }; changes: unknown[] }; previews: Record<string, { persona: { dialect: string; need: string } }> };
  frozen: string[]; explicit: unknown; dialectChanges: number; skin: string | null; trace: Trace[]; events: number;
};
type Agent = { calls: number; hit: number; miss: number; out: number; ms: number; errors: number; cost: number | null };
type Data = {
  llm: { mocked: boolean; model: string; prices: { hit: number; miss: number; out: number; source: string } | null };
  cost: { total: number | null; perDirectorCall: number | null; per1000Visits: number | null; visits: number; agents: Record<string, Agent> };
  visits: Brief[]; detail: Detail | null; gaps: { block: string; wanted: string; why: string; count: number; mocked: boolean }[];
};

const MARKERS = ["purchaseIntent", "priceSensitivity", "infoAppetite", "jargonComfort", "trustNeed", "hesitation", "confusion", "inspirationAppetite", "categoryAffinity", "featureInterest", "interactionFluency", "abandonmentRisk", "adaptationAcceptance"];
const Sim = () => <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">simulated</span>;
const usd = (n: number | null) => (n === null ? "price not set [VERIFY]" : `$${n < 0.01 ? n.toFixed(5) : n.toFixed(3)}`);
const KIND_STYLE: Record<string, string> = { plan: "bg-emerald-100 text-emerald-900", hold: "bg-slate-100 text-slate-700", result: "bg-sky-100 text-sky-900", trigger: "bg-amber-100 text-amber-900", guard: "bg-rose-100 text-rose-900", undo: "bg-rose-100 text-rose-900", explicit: "bg-violet-100 text-violet-900", page: "bg-white text-slate-700 ring-1 ring-slate-200", skip: "bg-slate-50 text-slate-500", visit: "bg-slate-800 text-white" };

export default function Merchant() {
  const [data, setData] = useState<Data | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [openLlm, setOpenLlm] = useState<number | null>(null);
  useEffect(() => {
    let on = true;
    const load = () => fetch(`/api/merchant${sel ? `?visit=${sel}` : ""}`).then((r) => r.json()).then((d: Data) => on && setData(d)).catch(() => {});
    load();
    const id = setInterval(load, 1500);
    return () => { on = false; clearInterval(id); };
  }, [sel]);
  const d = data?.detail;
  return (
    <div className="min-h-screen bg-slate-50 text-[14px] text-slate-900">
      <header className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-white px-5 py-3">
        <Link href="/" className="text-lg font-extrabold">Babel · merchant panel</Link>
        <span className="text-slate-500">Taraba (fictional store) · synthetic sessions <Sim /></span>
        <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${data?.llm.mocked ? "bg-slate-200" : "bg-emerald-100 text-emerald-900"}`}>LLM: {data ? (data.llm.mocked ? "offline stand-in (mock)" : data.llm.model) : "…"}</span>
        <button className="ml-auto rounded border border-slate-300 px-2 py-1 text-[12px]" onClick={() => void fetch("/api/merchant", { method: "POST", body: JSON.stringify({ action: "reset" }) }).then(() => setSel(null))}>Reset demo data</button>
      </header>

      <section className="grid gap-3 border-b border-slate-200 bg-white px-5 py-3 md:grid-cols-4" aria-label="Cost meter">
        <div><p className="text-[12px] text-slate-500">LLM cost so far</p><p className="text-xl font-bold">{data ? usd(data.cost.total) : "…"}</p></div>
        <div><p className="text-[12px] text-slate-500">Per Director decision</p><p className="text-xl font-bold">{data ? usd(data.cost.perDirectorCall) : "…"}</p></div>
        <div><p className="text-[12px] text-slate-500">Projected per 1,000 visits <Sim /></p><p className="text-xl font-bold">{data ? usd(data.cost.per1000Visits) : "…"}</p><p className="text-[11px] text-slate-500">from {data?.cost.visits ?? 0} consented visits in this session</p></div>
        <div className="text-[12px] text-slate-600">
          {Object.entries(data?.cost.agents ?? {}).map(([k, a]) => <p key={k}><b>{k}</b>: {a.calls} calls · in {a.hit + a.miss} tok ({a.hit} cached) · out {a.out} · avg {Math.round(a.ms / Math.max(1, a.calls))} ms{a.errors ? ` · ${a.errors} errors` : ""}</p>)}
          <p className="mt-1 text-slate-500">Prices: {data?.llm.prices ? `$${data.llm.prices.hit}/$${data.llm.prices.miss}/$${data.llm.prices.out} per 1M (hit/miss/out), ${data.llm.prices.source}` : "set BABEL_PRICE_*_PER_M from the provider's pricing page [VERIFY]"}</p>
        </div>
      </section>

      <div className="grid gap-4 p-5 lg:grid-cols-[320px_1fr]">
        <aside aria-label="Live visits">
          <h2 className="mb-2 font-bold">Live visits</h2>
          {!data?.visits.length && <p className="text-slate-500">No visits yet. Start a ghost shopper from the <Link className="underline" href="/">demo hub</Link>.</p>}
          <ul className="flex flex-col gap-2">
            {data?.visits.map((v) => (
              <li key={v.id}>
                <button onClick={() => setSel(v.id)} className={`w-full rounded-lg bg-white p-3 text-left ring-1 ${d?.id === v.id ? "ring-2 ring-slate-900" : "ring-slate-200"}`}>
                  <p className="font-semibold">{v.who}{v.returning ? " · return visit" : ""}</p>
                  <p className="text-slate-600">{v.persona} · {v.stage} · {v.pages} page{v.pages === 1 ? "" : "s"} · agent ran {v.directorRuns}×{v.standard ? " · Standard view" : ""}</p>
                  <div className="mt-1 flex gap-0.5">{MARKERS.map((m) => <span key={m} title={`${m} ${v.markers[m]?.value ?? 0}`} className="h-3 flex-1 rounded-sm" style={{ background: `rgb(15 23 42 / ${0.08 + (v.markers[m]?.value ?? 0) * 0.85})` }} />)}</div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {d ? (
          <main className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
              <h2 className="font-bold">Markers <Sim /></h2>
              <p className="text-slate-500">Deterministic, from interaction signals. They trigger the agent; they never pick prices or pressure.</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {MARKERS.map((m) => {
                  const x = (d.markers as Record<string, Marker>)[m];
                  return (
                    <li key={m} className="grid grid-cols-[150px_1fr_70px] items-center gap-2">
                      <span>{m}</span>
                      <span className="h-2.5 rounded bg-slate-100"><span className="block h-full rounded bg-slate-800" style={{ width: `${Math.round((x?.value ?? 0) * 100)}%` }} /></span>
                      <span className="text-right tabular-nums">{(x?.value ?? 0).toFixed(2)} {x?.trend === "up" ? "↑" : x?.trend === "down" ? "↓" : "→"}</span>
                      {x?.top && <span className="col-span-3 -mt-1 text-[12px] text-slate-500">{x.top.map((t) => `${t.key} ${Math.round(t.value * 100)}%`).join(" · ")}</span>}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-slate-600">Stage: <b>{d.stage}</b></p>
            </section>

            <section className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
              <h2 className="font-bold">Signal model (the shopper read)</h2>
              <p className="text-slate-500">David&apos;s model: evidence → capped groups → value + confidence. Below 0.55 a trait is treated as unknown.</p>
              <p className="mt-2">Reads as <b>{d.model.dialect} × {d.model.need}</b> (confidence {d.model.confidence.toFixed(2)}) · wording {d.model.copyRegister}</p>
              <p className="text-slate-600">look: {d.model.dialectWhy} · leads with: {d.model.needWhy}</p>
              {d.traits && (
                <ul className="mt-2 grid grid-cols-2 gap-1">
                  {Object.entries(d.traits).map(([k, t]) => <li key={k} className={t.conf >= 0.55 ? "font-semibold" : "text-slate-500"}>{k}: {t.value.toFixed(2)} <span className="text-[12px]">(conf {t.conf.toFixed(2)}{t.source === "declared" ? ", declared" : ""})</span></li>)}
                </ul>
              )}
              <h3 className="mt-3 font-bold">Pages in this visit</h3>
              <ol className="mt-1 flex flex-col gap-1">
                {d.pages.map((p) => { const v = p.views.at(-1)!; return (
                  <li key={p.index} className="rounded bg-slate-50 px-2 py-1"><b>{p.index + 1}. {p.template}</b> <span className="text-slate-500">{p.path}</span><br />opened as <b>{p.views[0].kind}</b> ({p.views[0].source}) {p.views[0].persona.dialect} × {p.views[0].persona.need}{p.planId ? " · from the agent's plan" : ""}{p.views.length > 1 ? ` → now ${v.kind} ${v.persona.dialect} × ${v.persona.need}` : ""} · style {v.skin}</li>
                ); })}
              </ol>
              {d.plan && (
                <div className="mt-3 rounded bg-emerald-50 p-2">
                  <p className="font-bold">The agent&apos;s plan for the next pages</p>
                  <p>{d.plan.plan.rationale}</p>
                  <p className="text-slate-600">bet: {d.plan.plan.hypothesis.marker} {d.plan.plan.hypothesis.expect} within {d.plan.plan.hypothesis.withinSeconds} s{d.plan.plan.hypothesis.outcome ? ` · outcome ${d.plan.plan.hypothesis.outcome}` : ""}</p>
                  <p className="text-slate-600">next pages open as: {Object.entries(d.plan.previews).map(([t, x]) => `${t} ${x.persona.dialect} × ${x.persona.need}`).join(" · ")}</p>
                </div>
              )}
              {(d.frozen.length > 0 || !!d.explicit) && <p className="mt-2 text-slate-600">{d.frozen.length ? `Undone by the shopper (frozen): ${d.frozen.join(", ")}. ` : ""}{d.explicit ? `Shopper's own choice pinned: ${JSON.stringify(d.explicit)}` : ""}</p>}
            </section>

            <section className="rounded-lg bg-white p-4 ring-1 ring-slate-200 xl:col-span-2">
              <h2 className="font-bold">Agent trace and guardrail log</h2>
              <p className="text-slate-500">Observed → bet → plan → result. Rejections and clamps are the guardrails at work.</p>
              <ol className="mt-2 flex flex-col gap-1.5">
                {[...d.trace].reverse().map((t, i) => (
                  <li key={i} className="rounded px-2 py-1.5 ring-1 ring-slate-100">
                    <span className={`mr-2 rounded px-1.5 py-0.5 text-[11px] font-bold uppercase ${KIND_STYLE[t.kind] ?? "bg-slate-100"}`}>{t.kind}</span>
                    <span className="text-slate-500 tabular-nums">{(t.at / 1000).toFixed(1)} s</span> · {t.text}
                    {t.ms !== undefined && <span className="text-slate-500"> · {t.rounds} round{t.rounds === 1 ? "" : "s"}, {(t.ms / 1000).toFixed(1)} s{t.mocked ? ", mock" : ""}</span>}
                    {!!t.diff?.length && <ul className="ml-4 list-disc text-slate-600">{t.diff.map((x) => <li key={x}>{x}</li>)}</ul>}
                    {!!t.errors?.length && <ul className="ml-4 list-disc text-rose-700">{t.errors.flat().map((x) => <li key={x}>validator: {x}</li>)}</ul>}
                    {!!t.clamps?.length && <p className="ml-4 text-amber-800">brand clamp: {t.clamps.join("; ")}</p>}
                    {t.llm && (
                      <div className="ml-4">
                        <button className="text-[12px] underline" onClick={() => setOpenLlm(openLlm === i ? null : i)}>{openLlm === i ? "Hide" : "Show"} what the model saw and said ({t.llm.model})</button>
                        {openLlm === i && (
                          <div className="mt-1 grid gap-2 md:grid-cols-2">
                            <pre className="max-h-72 overflow-auto rounded bg-slate-900 p-2 text-[11px] text-slate-100">{t.llm.input}</pre>
                            <div className="flex flex-col gap-1">{t.llm.rounds.map((r, j) => <div key={j} className="rounded bg-slate-100 p-2 text-[12px]"><p><b>round {j + 1}</b> · {r.verdict} · {r.ms} ms</p>{r.said && <p>{r.said}</p>}{r.call && <pre className="overflow-auto whitespace-pre-wrap">{r.call.name} {JSON.stringify(r.call.args, null, 1)}</pre>}</div>)}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </section>

            {!!data?.gaps.length && (
              <section className="rounded-lg bg-white p-4 ring-1 ring-slate-200 xl:col-span-2">
                <h2 className="font-bold">What the agent wanted but the store does not have</h2>
                <p className="text-slate-500">Never rendered. A developer decides whether to build a new variant.</p>
                <ul className="mt-1 list-disc pl-5">{data.gaps.map((g) => <li key={g.block + g.wanted}><b>{g.block}</b>: {g.wanted} <span className="text-slate-500">({g.why}; asked {g.count}×{g.mocked ? ", mock" : ""})</span></li>)}</ul>
              </section>
            )}
          </main>
        ) : <main className="text-slate-500">Select a visit.</main>}
      </div>
    </div>
  );
}
