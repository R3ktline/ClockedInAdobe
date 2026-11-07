// Demo hub: the 10 synthetic shoppers, the store, the merchant panel and the side-by-side view.
import Link from "next/link";
import { isMocked, modelName } from "@/babel/llm";
import { shoppers } from "@/data/shoppers";

export const dynamic = "force-dynamic";

export default function Home() {
  const list = Object.values(shoppers);
  const mocked = isMocked();
  return (
    <main className="mx-auto max-w-5xl px-5 py-8 text-[15px] text-slate-900">
      <h1 className="text-3xl font-extrabold">Babel</h1>
      <p className="mt-1 max-w-3xl text-slate-600">
        An AI layer a store plugs into. It works out how each shopper reads the web from what they do, and lays out their <b>next</b> pages
        for it, inside the store&apos;s brand. Same products, same prices. The page a shopper is reading never changes under them, unless they ask.
      </p>
      <p className="mt-2 text-sm"><span className={`rounded-full px-2.5 py-1 font-bold ${mocked ? "bg-slate-200" : "bg-emerald-100 text-emerald-900"}`}>LLM: {mocked ? "offline stand-in (no API key or BABEL_LLM=mock)" : modelName()}</span></p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/taraba" className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">Open the store as yourself</Link>
        <Link href="/merchant" className="rounded-lg border border-slate-900 px-4 py-2 font-semibold">Merchant panel</Link>
        <Link href="/demo" className="rounded-lg border border-slate-900 px-4 py-2 font-semibold">Three shoppers side by side</Link>
        <Link href="/how-babel-adapts" className="rounded-lg border border-slate-300 px-4 py-2">How Babel adapts this store</Link>
      </div>

      <h2 className="mt-8 text-xl font-bold">Ghost shoppers <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">synthetic</span></h2>
      <p className="text-slate-600">A ghost replays a scripted shopper through the real store: a visible cursor clicks real elements, the agent plans each next page, and the ghost walks on. Ages are labels for people; the engine never sees them.</p>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {list.map((s) => (
          <li key={s.id} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <p className="font-semibold">{s.label}</p>
            <p className="text-sm text-slate-600">Should read as <b>{s.expectedPersona.dialect} × {s.expectedPersona.need}</b> · {1 + s.pages.length} pages</p>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              <Link className="rounded bg-slate-900 px-3 py-1.5 font-semibold text-white" href={`${s.startPath}${s.startPath.includes("?") ? "&" : "?"}ghost=${s.id}&step=0&visit=1`}>Run visit</Link>
              <Link className="rounded border border-slate-900 px-3 py-1.5 font-semibold" href={`${(s.revisit ?? s).startPath}${(s.revisit ?? s).startPath.includes("?") ? "&" : "?"}ghost=${s.id}&step=0&visit=2`} title="Run the visit first: the return visit starts from what Babel remembered">Return visit, days later</Link>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-xl font-bold">For agents</h2>
      <p className="text-slate-600">The same catalog over A2A (<code>/.well-known/agent-card.json</code>, <code>/api/a2a</code>) and MCP (<code>/api/mcp</code>). Same prices; Babel never negotiates. Try: <code>npm run buyer-agent -- &quot;quiet washing machine under 2500 lei&quot;</code></p>
    </main>
  );
}
