import Link from "next/link";
import { shoppers } from "@/data/shoppers";

const link = "font-semibold text-[#2346d8] hover:underline";

// Testing hub: every route one needs while working on Babel. The cinematic intro lives at /intro.
export default function Index() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 text-[#14171f]">
      <h1 className="text-4xl font-extrabold tracking-tight">Babel</h1>
      <p className="mt-2 text-lg text-[#3c4250]">Every shopper speaks a different web dialect. Babel translates the store.</p>
      <p className="mt-1 text-[#3c4250]">
        <Link className={link} href="/intro">Watch the intro</Link> · <Link className="text-[#5b6170] hover:underline" href="/taraba">skip straight to Taraba</Link>
      </p>

      <h2 className="mt-8 text-xl font-bold">Stores</h2>
      <ul className="mt-3 flex flex-col gap-3 text-lg">
        <li><Link className={link} href="/taraba">Taraba</Link> · the demo store</li>
        <li><Link className={link} href="/taraba/c/electronics">Category page</Link> (electronics)</li>
        <li><Link className={link} href="/taraba/search">Search</Link> · <Link className={link} href="/taraba/cart">Cart</Link> · <Link className={link} href="/taraba/checkout">Checkout</Link></li>
      </ul>

      <h2 className="mt-8 text-xl font-bold">Ghost replays (synthetic shoppers)</h2>
      <ul className="mt-3 flex flex-col gap-3 text-lg">
        {Object.values(shoppers).map((s) => (
          <li key={s.id}>
            <Link className={link} href={`${s.startPath}?ghost=${s.id}`}>Replay {s.id}</Link> · {s.label}
            {s.revisit ? <> · <Link className={link} href={`/lab/${s.id}`}>revisit lab</Link></> : null}
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-xl font-bold">Testing tools</h2>
      <ul className="mt-3 flex flex-col gap-3 text-lg">
        <li><Link className={link} href="/sim">Simulation lab</Link> · build any shopper and see the page Babel makes</li>
        <li><Link className={link} href="/merchant">Merchant panel</Link> · markers, the agent&apos;s trace, the LLM conversation, gaps</li>
        <li><Link className={link} href="/.well-known/agent-card.json">A2A Agent Card</Link> · what shopping agents see (read-only catalog)</li>
      </ul>

      <p className="mt-8 text-sm text-[#5b6170]">All shoppers and data are synthetic.</p>
    </main>
  );
}
