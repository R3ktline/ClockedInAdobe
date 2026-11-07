// DSA Art. 27-style explanation of the main parameters, in plain words. Linked from every "Why?" panel.
import Link from "next/link";

export default function HowBabelAdapts() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-8 text-[16px] leading-relaxed text-slate-900">
      <Link href="/taraba" className="text-sm underline">← Back to the store</Link>
      <h1 className="mt-3 text-3xl font-extrabold">How Babel adapts this store</h1>
      <p className="mt-3">Taraba uses Babel to lay out its pages for how you browse. You decide whether it does.</p>
      <h2 className="mt-5 text-xl font-bold">What it changes</h2>
      <p>Only the shape of the page: which of the store&apos;s own sections come first, how much detail they show, text size, and the visual style.
        It never changes prices, stock, promotions or product descriptions. Every shopper and every shopping agent pays the same price.</p>
      <h2 className="mt-5 text-xl font-bold">When it changes</h2>
      <p>When you open your next page. The page you are reading does not move on its own. It changes at once only when you ask: in the chat,
        with <b>Standard view</b>, <b>Previous view</b> or <b>Style</b>.</p>
      <h2 className="mt-5 text-xl font-bold">What it uses</h2>
      <p>What you do on this site: for example opening the returns policy, reading the specifications, sorting by price, or taps that land next to
        a button. Plus settings you chose in your account, such as larger text. It does <b>not</b> use your age, gender, location, health, or anything
        from other sites. Your chat messages are not stored as a profile.</p>
      <h2 className="mt-5 text-xl font-bold">The AI</h2>
      <p>An AI agent chooses among layouts the store built in advance. It cannot write the page, invent product facts, or change prices. Its choices are
        checked by code before you see them. The chat assistant is an AI and says so.</p>
      <h2 className="mt-5 text-xl font-bold">Your controls</h2>
      <ul className="list-disc pl-5">
        <li><b>Why?</b> shows what the current page is based on.</li>
        <li><b>Standard view</b> switches adaptation off for the rest of your visit. This is the option that is not based on profiling.</li>
        <li><b>Forget me</b> deletes what Babel remembers about you.</li>
      </ul>
      <p className="mt-5 text-sm text-slate-600">Demo store with synthetic data, built for a hackathon. Not legal advice; the legal reading behind this page is the team&apos;s, marked [VERIFY] where unchecked.</p>
    </main>
  );
}
