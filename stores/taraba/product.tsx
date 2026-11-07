"use client";
// Taraba's product page. Every section is a <BabelBlock> with the variants Taraba declares in its registry.
// Prices, stock, ratings, policies and copy come from the catalog; Babel only picks variant, order and folding.
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BabelBlock, BabelProvider, BabelStack, useBabel, type BrandKit, type Initial, type Product } from "@/babel/sdk";
import brandKit from "./brand-kit.json";
import { ProductArt } from "./art";
import { canAdd, useCart } from "./cart";
import { registry } from "./registry";
import { CATEGORY_LABEL, Header, Picture, Simulated, Stars, card, lei, primaryBtn, useRecent, useRememberViewed } from "./ui";

const brand = brandKit as BrandKit;
const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
const months = (n: number) => `${n} month${n === 1 ? "" : "s"}`;

function Gallery({ p, layout }: { p: Product; layout: "thumbs" | "single" | "strip" }) {
  const { track } = useBabel();
  const [view, setView] = useState<0 | 1 | 2>(0);
  const frame = "overflow-hidden rounded-[var(--babel-radius)]";
  if (layout === "single") return <div data-babel-focus="photo:1" className={`${frame} aspect-[4/3] w-full sm:aspect-[16/10]`}><ProductArt p={p} /></div>;
  if (layout === "strip") {
    return (
      <div className="flex snap-x gap-3 overflow-x-auto pb-2" onScroll={() => track("gallery_swipe", { blockId: "gallery", productId: p.id })}>
        {([0, 1, 2] as const).map((i) => (
          <button key={i} type="button" data-ghost={i === 0 ? "image_zoom" : undefined} aria-label={`Picture ${i + 1} of ${p.name}`}
            onClick={() => track("image_zoom", { blockId: "gallery", productId: p.id, target: `photo:${i + 1}` })}
            className={`${frame} aspect-[4/5] w-[78%] shrink-0 snap-center sm:w-[44%]`}>
            <ProductArt p={p} view={i} decorative />
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="flex flex-col gap-2" role="group" aria-label="Pictures">
        {([0, 1, 2] as const).map((i) => (
          <button key={i} type="button" data-ghost={i === 1 ? "gallery_swipe" : undefined} aria-label={`Picture ${i + 1}`} aria-pressed={view === i}
            onClick={() => { setView(i); track("gallery_swipe", { blockId: "gallery", productId: p.id }); }}
            className={`${frame} h-16 w-16 border-2 ${view === i ? "border-[var(--c-primary)]" : "border-transparent"}`}>
            <ProductArt p={p} view={i} decorative />
          </button>
        ))}
      </div>
      <button type="button" data-ghost="image_zoom" data-babel-focus={`photo:${view + 1}`} aria-label="Zoom the picture"
        onClick={() => track("image_zoom", { blockId: "gallery", productId: p.id, target: `photo:${view + 1}` })}
        className={`${frame} aspect-square flex-1 sm:aspect-[4/3]`}><ProductArt p={p} view={view} /></button>
    </div>
  );
}

function Summary({ p, kind }: { p: Product; kind: "standard" | "benefits" | "facts" }) {
  const { view } = useBabel();
  if (kind === "benefits") {
    return (
      <div>
        <p className="text-lg leading-relaxed">{p.copy.plain}</p>
        <ul className="mt-3 flex flex-col gap-2 text-lg">{p.benefits.map((b) => <li key={b} className="flex gap-2"><span aria-hidden className="font-bold text-[var(--c-primary)]">✓</span>{b}</li>)}</ul>
      </div>
    );
  }
  if (kind === "facts") {
    return (
      <div>
        <p className="leading-relaxed">{p.copy.technical}</p>
        <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">{p.specs.slice(0, 5).map((s) => <li key={s.key}><span className="text-[var(--c-muted)]">{s.label}:</span> {s.value}</li>)}</ul>
      </div>
    );
  }
  return <p className="text-lg leading-relaxed">{p.copy[view.copyRegister]}</p>;
}

function BuyBox({ p, variant }: { p: Product; variant: "standard" | "calm" | "prominent_simple" }) {
  const { track } = useBabel();
  const cart = useCart();
  const inCart = cart.qty(p.id);
  const promo = variant === "standard" && p.promotion;
  const big = variant === "prominent_simple";
  return (
    <div className={`${card} p-5`} onMouseEnter={() => track("hover_price", { blockId: "buyBox", productId: p.id })}>
      <div className="flex flex-wrap items-baseline gap-3">
        <span data-babel-focus="price" className={`${big ? "text-5xl" : "text-3xl"} font-extrabold`}>{lei.format(p.price)}</span>
        {promo && (
          <>
            <span className="text-[var(--c-muted)] line-through">{lei.format(p.promotion!.oldPrice)}</span>
            <span className="rounded-full bg-[var(--c-accent)] px-2.5 py-0.5 text-sm font-bold text-[#14171f]">{p.promotion!.label}</span>
          </>
        )}
      </div>
      <p className="mt-2 text-[var(--c-muted)]">
        {variant === "calm" ? `Free returns within ${days(p.policies.returnDays)} · ${months(p.policies.warrantyMonths)} warranty · delivery in ${days(p.policies.deliveryDays)}`
          : big ? `Arrives in ${days(p.policies.deliveryDays)}` : `${p.stock > 0 ? "In stock" : "Out of stock"} · delivery in ${days(p.policies.deliveryDays)}`}
      </p>
      <button data-ghost="add_to_cart" data-product={p.id} disabled={!canAdd(p, inCart)}
        onClick={() => { track("add_to_cart", { blockId: "buyBox", productId: p.id }); cart.add(p.id); }}
        className={`mt-4 ${big ? "w-full py-4 text-xl" : "px-6 py-3"} ${primaryBtn}`}>
        {p.stock === 0 ? "Out of stock" : "Add to cart"}
      </button>
      {inCart > 0 && (
        <span className="mt-3 ml-3 inline-flex flex-wrap items-center gap-3">
          <button data-ghost="remove_from_cart" onClick={() => { track("remove_from_cart", { blockId: "buyBox", productId: p.id }); cart.set(p.id, inCart - 1); }}
            className="rounded-[var(--babel-radius)] px-3 py-2 font-semibold text-[var(--c-primary)] hover:bg-black/5">Remove one ({inCart} in cart)</button>
          <Link href="/taraba/cart" className="font-semibold text-[var(--c-primary)] underline">Go to cart</Link>
        </span>
      )}
    </div>
  );
}

function Specs({ p, limit }: { p: Product; limit?: number }) {
  const { track } = useBabel();
  const rows = (list: Product["specs"]) => (
    <table className="w-full text-left">
      <tbody>
        {list.map((s) => (
          <tr key={s.key} data-babel-focus={`spec:${s.key}`} className="border-b border-black/10 last:border-0">
            <th scope="row" className="py-2 pr-4 font-medium text-[var(--c-muted)]">{s.label}</th>
            <td className="py-2">{s.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <div className={`${card} p-5`}>
      <h2 className="mb-2 text-xl font-bold">Specifications</h2>
      {rows(limit ? p.specs.slice(0, limit) : p.specs)}
      {limit && p.specs.length > limit && (
        <details className="mt-2" onToggle={(e) => e.currentTarget.open && track("block_open", { blockId: "specs", productId: p.id })}>
          <summary data-ghost="block_open" className="cursor-pointer font-semibold text-[var(--c-primary)]">All {p.specs.length} specifications</summary>
          {rows(p.specs.slice(limit))}
        </details>
      )}
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <details onToggle={(e) => e.currentTarget.open && track("block_open", { blockId: "specs", productId: p.id, target: "spec:technical" })}>
          <summary data-ghost="block_open:technical" className="cursor-pointer font-semibold text-[var(--c-primary)]">Technical description</summary>
          <p className="mt-1">{p.copy.technical}</p>
        </details>
        <details onToggle={(e) => e.currentTarget.open && track("block_open", { blockId: "specs", productId: p.id, target: "glossary" })}>
          <summary data-ghost="block_open:glossary" className="cursor-pointer font-semibold text-[var(--c-primary)]">What do these terms mean?</summary>
          <p className="mt-1 text-[var(--c-muted)]">In plain words: {p.copy.plain}</p>
        </details>
      </div>
    </div>
  );
}

function Policy({ p, kind, title, children }: { p: Product; kind: string; title: string; children: ReactNode }) {
  const { track } = useBabel();
  return (
    <details onToggle={(e) => e.currentTarget.open && track("policy_open", { blockId: "trust", productId: p.id, value: kind })}>
      <summary data-ghost={`policy_open:${kind}`} className="cursor-pointer font-semibold text-[var(--c-primary)]">{title}</summary>
      <p className="mt-1 text-[var(--c-muted)]">{children}</p>
    </details>
  );
}

function Trust({ p, policiesFirst }: { p: Product; policiesFirst: boolean }) {
  const { track } = useBabel();
  const [critical, setCritical] = useState(false);
  const reviews = critical ? [...p.reviews].sort((a, b) => a.rating - b.rating) : p.reviews;
  const policies = policiesFirst ? (
    <div className="grid gap-3 sm:grid-cols-3">
      {[[`${days(p.policies.returnDays)} to return`, "Free return, no questions asked"], [`${months(p.policies.warrantyMonths)} warranty`, "Repair or replacement"], [`Delivery in ${days(p.policies.deliveryDays)}`, "Tracked, to your door"]].map(([t, n]) => (
        <div key={t} className="rounded-[var(--babel-radius)] bg-[#f3f5fb] p-3"><p className="font-bold">{t}</p><p className="text-sm text-[var(--c-muted)]">{n}</p></div>
      ))}
    </div>
  ) : (
    <div className="flex flex-col gap-1">
      <Policy p={p} kind="returns" title="Returns">You can return it within {days(p.policies.returnDays)}.</Policy>
      <Policy p={p} kind="warranty" title="Warranty">{months(p.policies.warrantyMonths)} of warranty.</Policy>
      <Policy p={p} kind="delivery" title="Delivery">Delivered in {days(p.policies.deliveryDays)}.</Policy>
    </div>
  );
  const list = (
    <div>
      <Stars p={p} />
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <p><span className="font-semibold">People like:</span> {p.reviewSummary.pros.join(", ")}</p>
        <p><span className="font-semibold">Watch out for:</span> {p.reviewSummary.cons.join(", ")}</p>
      </div>
      <details className="mt-2" onToggle={(e) => e.currentTarget.open && track("review_open", { blockId: "trust", productId: p.id })}>
        <summary data-ghost="review_open" className="cursor-pointer font-semibold text-[var(--c-primary)]">Read reviews</summary>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--c-muted)]">
          {p.reviews.length} of {p.reviewCount} reviews shown <Simulated />
          <button type="button" data-ghost="review_sort:critical" onClick={() => { setCritical(true); track("review_sort", { blockId: "trust", productId: p.id, value: "critical" }); }} className="underline">Most critical first</button>
        </p>
        <ul className="mt-2 flex flex-col gap-3">
          {reviews.map((r) => (
            <li key={r.author + r.date} className="border-t border-black/10 pt-3">
              <p><span role="img" aria-label={`${r.rating} out of 5`} className="text-[var(--c-primary)]">{"★".repeat(r.rating)}<span className="text-black/20">{"★".repeat(5 - r.rating)}</span></span> <span className="font-semibold">{r.title}</span></p>
              <p className="mt-1">{r.text}</p>
              <p className="mt-1 text-sm text-[var(--c-muted)]">{r.author} · {r.date}{r.verified ? " · verified purchase" : ""}</p>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
  return (
    <div className={`${card} flex flex-col gap-4 p-5`}>
      <h2 className="text-xl font-bold">{policiesFirst ? "Returns, warranty and reviews" : "Reviews"}</h2>
      {policiesFirst ? <>{policies}{list}</> : <>{list}{policies}</>}
    </div>
  );
}

function Compare({ p, all, kind }: { p: Product; all: Product[]; kind: "similar" | "cheaper" }) {
  const { track } = useBabel();
  const same = all.filter((x) => x.category === p.category && x.id !== p.id);
  if (kind === "cheaper") {
    const cheaper = same.filter((x) => x.price < p.price).sort((a, b) => a.price - b.price).slice(0, 3);
    if (!cheaper.length) return <div className={`${card} p-5`}><h2 className="text-xl font-bold">Lower-priced options</h2><p className="mt-1 text-[var(--c-muted)]">This is already the lowest-priced item in {CATEGORY_LABEL[p.category].toLowerCase()}.</p></div>;
    return (
      <div className={`${card} p-5`}>
        <h2 className="text-xl font-bold">Lower-priced options</h2>
        <p className="text-sm text-[var(--c-muted)]">Catalog prices, the same for every shopper.</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {cheaper.map((x) => (
            <li key={x.id}><Link href={`/taraba/p/${x.id}`} data-ghost="product_click:cheaper" data-product={x.id} onClick={() => track("product_click", { blockId: "compare", productId: x.id, value: "cheaper" })} className="flex items-center gap-3 hover:underline">
              <Picture p={x} size="sm" /><span><span className="block font-semibold">{x.name}</span><span className="font-bold">{lei.format(x.price)}</span></span>
            </Link></li>
          ))}
        </ul>
      </div>
    );
  }
  const others = same.sort((a, b) => Math.abs(a.price - p.price) - Math.abs(b.price - p.price)).slice(0, 2);
  const cols = [p, ...others];
  const keys = [...new Map(cols.flatMap((x) => x.specs.map((s) => [s.key, s.label] as const))).entries()].slice(0, 7);
  return (
    <div className={`${card} overflow-x-auto p-5`}>
      <h2 className="text-xl font-bold">Compare with similar products</h2>
      <table className="mt-2 w-full min-w-[32rem] text-left text-sm">
        <thead><tr><th className="py-1" />{cols.map((x) => <th key={x.id} className="py-1 font-semibold">{x.id === p.id ? "This one" : <Link className="underline" href={`/taraba/p/${x.id}`} onClick={() => track("product_click", { blockId: "compare", productId: x.id, value: "similar" })}>{x.name}</Link>}</th>)}</tr></thead>
        <tbody>
          {[["price", "Price", cols.map((x) => lei.format(x.price))] as const, ["rating", "Rating", cols.map((x) => `★ ${x.rating.toFixed(1)}`)] as const,
            ...keys.map(([k, label]) => [k, label, cols.map((x) => x.specs.find((s) => s.key === k)?.value ?? "–")] as const)].map(([k, label, vals]) => {
            const differs = new Set(vals).size > 1;
            return <tr key={k} data-babel-focus={`spec:${k}`} className="border-t border-black/10"><th scope="row" className="py-1.5 pr-3 font-medium text-[var(--c-muted)]">{label}{differs && <span className="sr-only"> (differs)</span>}</th>{vals.map((v, i) => <td key={i} className={`py-1.5 ${differs ? "font-semibold" : ""}`}>{v}</td>)}</tr>;
          })}
        </tbody>
      </table>
      <button type="button" data-ghost="compare_add" onClick={() => track("compare_add", { blockId: "compare", productId: p.id })} className="mt-2 text-sm font-semibold text-[var(--c-primary)] underline">Keep this comparison</button>
    </div>
  );
}

function Assist() {
  const { setChatOpen, ask } = useBabel();
  const qs = ["Which one is easiest to use?", "What is the warranty?", "Make the page simpler"];
  return (
    <div className={`${card} p-5`}>
      <h2 className="text-xl font-bold">Not sure? Ask the assistant</h2>
      <p className="text-sm text-[var(--c-muted)]">An AI that answers from this store's catalog. It can't change prices.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {qs.map((q) => <button key={q} type="button" onClick={() => { setChatOpen(true); void ask(q); }} className="rounded-full border-2 border-[var(--c-primary)] px-4 py-2 font-semibold text-[var(--c-primary)]">{q}</button>)}
      </div>
    </div>
  );
}

export function Recent({ all, exclude }: { all: Product[]; exclude?: string }) {
  const ids = useRecent().filter((id) => id !== exclude);
  const list = ids.map((id) => all.find((p) => p.id === id)).filter((p): p is Product => !!p).slice(0, 6);
  if (!list.length) return null;
  return (
    <div>
      <h2 className="mb-2 text-xl font-bold">Recently viewed</h2>
      <ul className="flex gap-3 overflow-x-auto pb-1">
        {list.map((p) => <li key={p.id} className="w-28 shrink-0"><Link href={`/taraba/p/${p.id}`} className="block text-sm hover:underline"><Picture p={p} /><span className="mt-1 block font-semibold">{p.name}</span><span>{lei.format(p.price)}</span></Link></li>)}
      </ul>
    </div>
  );
}

export function ProductPage({ initial, product: p, all }: { initial: Initial; product: Product; all: Product[] }) {
  useRememberViewed(p.id);
  return (
    <BabelProvider initial={initial} registry={registry} brand={brand}>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6 pb-28">
        <nav aria-label="Breadcrumb" className="text-sm text-[var(--c-muted)]">
          <Link href="/taraba" className="hover:underline">Taraba</Link> / <Link href={`/taraba/c/${p.category}`} className="hover:underline">{CATEGORY_LABEL[p.category]}</Link>
        </nav>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>{p.name}</h1>
        <p className="mt-1 text-[var(--c-muted)]">{p.brand} · <Stars p={p} /></p>
        <BabelStack className="mt-6">
          <BabelBlock id="gallery" variants={{ grid_thumbs: <Gallery p={p} layout="thumbs" />, single_large: <Gallery p={p} layout="single" />, strip: <Gallery p={p} layout="strip" /> }} />
          <BabelBlock id="summary" variants={{ standard: <Summary p={p} kind="standard" />, benefits_plain: <Summary p={p} kind="benefits" />, key_facts: <Summary p={p} kind="facts" /> }} />
          <BabelBlock id="buyBox" variants={{ standard: <BuyBox p={p} variant="standard" />, calm: <BuyBox p={p} variant="calm" />, prominent_simple: <BuyBox p={p} variant="prominent_simple" /> }} />
          <BabelBlock id="specs" variants={{ table_key: <Specs p={p} limit={3} />, table_full: <Specs p={p} /> }} />
          <BabelBlock id="trust" variants={{ reviews_summary: <Trust p={p} policiesFirst={false} />, returns_warranty_first: <Trust p={p} policiesFirst /> }} />
          <BabelBlock id="compare" variants={{ similar: <Compare p={p} all={all} kind="similar" />, cheaper: <Compare p={p} all={all} kind="cheaper" /> }} />
          <BabelBlock id="assist" variants={{ ask_prompt: <Assist /> }} />
          <BabelBlock id="continuity" variants={{ recent: <Recent all={all} exclude={p.id} /> }} />
        </BabelStack>
      </main>
    </BabelProvider>
  );
}
