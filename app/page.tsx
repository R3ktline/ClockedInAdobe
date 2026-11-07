import Link from "next/link";
import { shoppers } from "@/data/shoppers";

export default function Index() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 text-[#14171f]">
      <h1 className="text-4xl font-extrabold tracking-tight">Babel</h1>
      <p className="mt-2 text-lg text-[#3c4250]">Every shopper speaks a different web dialect. Babel translates the store.</p>
      <ul className="mt-8 flex flex-col gap-3 text-lg">
        <li><Link className="font-semibold text-[#2346d8] hover:underline" href="/taraba">Taraba</Link> · the demo store</li>
        {Object.values(shoppers).map((s) => (
          <li key={s.id}>
            <Link className="font-semibold text-[#2346d8] hover:underline" href={`${s.startPath}?ghost=${s.id}`}>Replay {s.id}</Link> · {s.label}
          </li>
        ))}
        <li><Link className="font-semibold text-[#2346d8] hover:underline" href="/merchant">Merchant panel</Link> · markers and the agent&apos;s trace</li>
      </ul>
      <p className="mt-8 text-sm text-[#5b6170]">All shoppers and data are synthetic.</p>
    </main>
  );
}
