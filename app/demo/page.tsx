// Three shoppers side by side, each a ghost walking through the real store in its own frame. Same store, same
// prices; by their second or third page each one sees a differently shaped page.
import Link from "next/link";
import { shoppers } from "@/data/shoppers";

export default async function Demo({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const ids = (q.who ?? "gheorghe,mihai,tudor").split(",").filter((id) => shoppers[id]).slice(0, 3);
  return (
    <div className="flex h-screen flex-col bg-slate-900 text-white">
      <header className="flex items-center gap-4 px-4 py-2 text-sm">
        <Link href="/" className="font-bold">Babel</Link>
        <span className="text-white/70">Same store, same prices, three shoppers. Each pane is a ghost walking through Taraba (synthetic).</span>
        <Link href="/merchant" target="_blank" className="ml-auto underline">Merchant panel</Link>
      </header>
      <div className="grid flex-1 grid-cols-1 gap-1 md:grid-cols-3">
        {ids.map((id) => {
          const s = shoppers[id];
          return (
            <section key={id} className="flex flex-col">
              <p className="px-2 py-1 text-sm"><b>{s.label.split(":")[0]}</b> · should read as {s.expectedPersona.dialect} × {s.expectedPersona.need}</p>
              <iframe title={`${s.id} ghost`} className="flex-1 bg-white" src={`${s.startPath}${s.startPath.includes("?") ? "&" : "?"}ghost=${s.id}&step=0&visit=1`} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
