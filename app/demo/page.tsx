"use client";
// Live demo stage: starts the headless run (/api/demo) on load and draws each step as it happens —
// the shopper's behaviour, the markers it moves, what the agent changed and why, then the store-wide suggestion.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Marker = { value: number; trend: string };
type Card = {
  id: string; label: string; story: string; events: string[];
  persona?: { dialect: string; need: string }; markers?: Record<string, Marker>;
  agent?: { decision: string; reason?: string; rationale?: string; changes: string[]; persona?: { dialect: string; need: string } };
};
type Result = { store: string; template: string; outcome: string; reason: string; suggested?: { id: string; changes: { id: string; variant?: string; order?: number }[]; rationale: string; evidence: string[] } };

const chip = (c: { id: string; variant?: string; order?: number }) =>
  [c.id, c.variant && `→ ${c.variant.replaceAll("_", " ")}`, c.order && `#${c.order}`].filter(Boolean).join(" ");

export default function Demo() {
  const [cards, setCards] = useState<Card[]>([]);
  const [phase, setPhase] = useState<"running" | "insights" | "done" | "error">("running");
  const [results, setResults] = useState<Result[]>([]);
  const [verdict, setVerdict] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // React strict mode runs effects twice in dev
    started.current = true;
    (async () => {
      try {
        const res = await fetch("/api/demo", { method: "POST" });
        const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += value;
          const lines = buf.split("\n");
          buf = lines.pop()!;
          for (const l of lines.filter(Boolean)) {
            const m = JSON.parse(l);
            const patch = (f: (c: Card) => Card) => setCards((cs) => cs.map((c, i) => (i === m.i ? f(c) : c)));
            if (m.kind === "plan") setCards(m.cast);
            else if (m.kind === "visit") patch((c) => ({ ...c, persona: m.persona }));
            else if (m.kind === "markers") patch((c) => ({ ...c, markers: m.markers }));
            else if (m.kind === "agent") patch((c) => ({ ...c, agent: m }));
            else if (m.kind === "insights") setPhase("insights");
            else if (m.kind === "done") { setResults(m.results); setPhase("done"); }
            else if (m.kind === "error") { setErr(m.text); setPhase("error"); }
          }
        }
      } catch {
        setErr("The run could not start. The store itself still works.");
        setPhase("error");
      }
    })();
  }, []);

  const act = async (id: string, action: "approve" | "revert") => {
    await fetch("/api/insights", { method: "POST", body: JSON.stringify({ action, id }) });
    setVerdict((v) => ({ ...v, [id]: action === "approve" ? "Approved: new visitors now start here." : "Dismissed." }));
  };

  const steps = ["Shoppers browse", "Markers move", "Agent re-composes", "Look across shoppers"];
  const at = phase === "running" ? (cards.some((c) => c.agent) ? 2 : cards.some((c) => c.markers) ? 1 : 0) : phase === "insights" ? 3 : 4;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 bg-[#f8f7f3] px-4 py-8 text-[#161c1a]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Babel at work <span className="ml-2 rounded bg-[#fdf3df] px-2 py-0.5 text-xs font-semibold text-[#8a5a0a]">simulated shoppers</span></h1>
          <p className="mt-1 text-sm text-[#5c645f]">Same store, same prices. Each shopper&apos;s behaviour moves the markers; the agent re-composes only their page.</p>
        </div>
        <Link href="/merchant" className="rounded-xl border border-[#dad8cf] bg-white px-3.5 py-2 text-sm font-semibold hover:bg-[#f2f0e8]">Merchant panel</Link>
      </header>

      <ol className="flex flex-wrap gap-2" aria-label="Progress">
        {steps.map((s, i) => (
          <li key={s} className={`rounded-full px-3 py-1 text-xs font-semibold ${i < at ? "bg-[#116b5f] text-white" : i === at ? "bg-[#fdf3df] text-[#8a5a0a]" : "bg-[#e6e4dc] text-[#68706b]"}`}>
            {i + 1}. {s}{i === at && phase !== "done" && phase !== "error" ? "…" : ""}
          </li>
        ))}
      </ol>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Shoppers">
        {cards.map((c, i) => {
          const top = Object.entries(c.markers ?? {}).sort((a, b) => b[1].value - a[1].value).slice(0, 4);
          return (
            <article key={i} className="flex flex-col gap-3 rounded-2xl border border-[#dad8cf] bg-white p-4">
              <div>
                <h2 className="font-bold">{c.label}</h2>
                <p className="text-xs text-[#68706b]">{c.story}</p>
              </div>
              {c.persona && <p className="text-xs"><span className="font-semibold">Starts as</span> {c.persona.dialect} × {c.persona.need}</p>}
              <div>
                <p className="text-[11px] font-semibold uppercase text-[#68706b]">Does</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.events.map((e, j) => <span key={j} className="rounded bg-[#f2f0e8] px-1.5 py-0.5 text-[11px]">{e.replaceAll("_", " ")}</span>)}
                </div>
              </div>
              {top.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase text-[#68706b]">Markers (simulated)</p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {top.map(([k, m]) => (
                      <li key={k} className="flex items-center gap-2 text-xs">
                        <span className="w-32 shrink-0">{k}</span>
                        <span className="h-2 flex-1 rounded bg-[#ecefe9]"><span className="block h-2 rounded bg-[#116b5f] transition-all" style={{ width: `${Math.round(m.value * 100)}%` }} /></span>
                        <span aria-label={m.trend}>{m.trend === "up" ? "↑" : m.trend === "down" ? "↓" : "→"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {c.markers && !c.agent && <p className="text-xs text-[#8a5a0a]">Agent is deciding…</p>}
              {c.agent && (
                <div className="rounded-xl bg-[#f4fbf9] p-3 text-xs">
                  {c.agent.decision === "slide" ? (
                    <>
                      <p className="font-semibold text-[#0f5c51]">Agent changed this shopper&apos;s page</p>
                      <ul className="mt-1 list-disc pl-4">{c.agent.changes.map((x, j) => <li key={j}>{x}</li>)}</ul>
                      <p className="mt-1 italic text-[#2d3430]">&ldquo;{c.agent.rationale}&rdquo;</p>
                    </>
                  ) : (
                    <p>Agent held: {c.agent.reason ?? "nothing worth changing yet"}. The page stays as it was.</p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </section>

      {phase === "error" && <p role="alert" className="rounded-xl border border-[#e3b5ab] bg-[#fbeeea] p-3 text-sm">{err}</p>}

      {(phase === "insights" || phase === "done") && (
        <section className="rounded-2xl border border-[#bce0d9] bg-[#ecf7f5] p-4" aria-label="Store-wide suggestion">
          <h2 className="font-bold">Across all shoppers</h2>
          {phase === "insights" && <p className="mt-1 text-sm">Looking for changes the agent keeps making that work…</p>}
          {results.map((r, i) => (
            <div key={i} className="mt-3 text-sm">
              <p className="font-semibold">{r.store} · {r.template}</p>
              {r.suggested ? (
                <div className="mt-1 rounded-xl border border-[#ecd49a] bg-[#fffaf0] p-3">
                  <p className="text-[11px] font-bold uppercase text-[#8a5a0a]">Suggested permanent change</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">{r.suggested.changes.map((c, j) => <span key={j} className="rounded-md border border-[#d6e6e2] bg-white px-2 py-0.5 text-xs font-medium">{chip(c)}</span>)}</div>
                  <p className="mt-2 text-xs">{r.suggested.rationale}</p>
                  <ul className="mt-1 list-disc pl-4 text-xs text-[#5c645f]">{r.suggested.evidence.map((e, j) => <li key={j}>{e}</li>)}</ul>
                  {verdict[r.suggested.id] ? <p className="mt-2 text-xs font-semibold">{verdict[r.suggested.id]}</p> : (
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => act(r.suggested!.id, "approve")} className="rounded-lg bg-[#116b5f] px-3 py-1 text-xs font-semibold text-white hover:bg-[#0d564c]">Approve</button>
                      <button type="button" onClick={() => act(r.suggested!.id, "revert")} className="rounded-lg border border-[#d4d2c9] bg-white px-3 py-1 text-xs font-semibold hover:bg-[#f2f0e8]">Dismiss</button>
                    </div>
                  )}
                </div>
              ) : <p className="text-xs text-[#5c645f]">{r.reason}</p>}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
