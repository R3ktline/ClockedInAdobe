"use client";
// Taraba: a fictional general marketplace. This is "the store's own code": it renders its pages
// and declares variants; Babel (via babel/sdk) only picks which variant shows and where.
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  BabelBlock, BabelProvider, BabelStack, useBabel, useReviewPicks,
  type BrandKit, type Category, type InteractionEvent, type PartnerContext, type Product,
} from "@/babel/sdk";
import brandKit from "./brand-kit.json";
import { ProductArt } from "./art";
import { registry } from "./registry";
import { canAdd, useCart } from "./cart";

const brand = brandKit as BrandKit;
export const lei = new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 });

export const CATEGORY_LABEL: Record<Category, string> = {
  electronics: "Electronics", fashion: "Fashion", home: "Home & furniture",
  groceries: "Groceries", toys: "Toys", health_beauty: "Health & beauty",
};
const CATEGORY_TINT: Record<Category, string> = {
  electronics: "#e7ecfb", fashion: "#f6e9ef", home: "#e9f3ec", groceries: "#fbf3df", toys: "#fdeee3", health_beauty: "#eef0f6",
};

type Common = { partner: PartnerContext; ghost?: { label: string; events: InteractionEvent[]; step?: number; next?: string } };

export const card = "rounded-[var(--babel-radius)] border border-black/10 bg-white";

export function Header({ query = "" }: { query?: string }) {
  const { count } = useCart();
  return (
    <header className="bg-[var(--c-primary)] text-white">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/taraba" className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
          taraba
        </Link>
        <form action="/taraba/search" role="search" className="flex min-w-0 flex-1">
          <input
            type="search"
            name="q"
            defaultValue={query}
            aria-label="Search Taraba"
            placeholder="Search products"
            className="min-w-0 flex-1 rounded-full bg-white px-4 py-2 text-[var(--c-text)] placeholder:text-[#5b6170]"
          />
        </form>
        <Link href="/taraba/cart" className="rounded-full bg-[var(--c-accent)] px-3 py-1.5 text-sm font-bold text-[#14171f]" aria-label={`Cart, ${count} items`}>
          Cart · {count}
        </Link>
      </div>
      <nav aria-label="Categories" className="mx-auto flex max-w-5xl gap-4 overflow-x-auto px-4 pb-2 text-sm text-white/90">
        {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
          <Link key={c} href={`/taraba/c/${c}`} className="whitespace-nowrap hover:underline">{CATEGORY_LABEL[c]}</Link>
        ))}
      </nav>
    </header>
  );
}

// Product pictures are original illustrations (./art.tsx). Cards that print the name beside the picture mark it decorative.
export function Picture({ p, size = "md" }: { p: Product; size?: "sm" | "md" | "lg" }) {
  const h = size === "md" ? "aspect-square" : size === "lg" ? "h-32 w-32 shrink-0 sm:h-40 sm:w-40" : "h-14 w-14 shrink-0";
  return (
    <div className={`${h} overflow-hidden rounded-[var(--babel-radius)]`}>
      <ProductArt p={p} decorative />
    </div>
  );
}

const Stars = ({ p }: { p: Product }) => (
  <span className="text-sm text-[var(--c-muted)]">★ {p.rating.toFixed(1)} · {p.reviewCount} reviews</span>
);

// ---------- Product page ----------

function Gallery({ p, thumbs }: { p: Product; thumbs: boolean }) {
  const [view, setView] = useState<0 | 1 | 2>(0);
  const frame = "overflow-hidden rounded-[var(--babel-radius)]";
  if (!thumbs) return <div className={`${frame} aspect-[4/3] w-full sm:aspect-[16/10]`}><ProductArt p={p} /></div>;
  return (
    <div className="flex gap-3">
      <div className="flex flex-col gap-2" role="group" aria-label="Choose a picture">
        {([0, 1, 2] as const).map((i) => (
          <button
            key={i}
            type="button"
            aria-label={`Picture ${i + 1} of 3`}
            aria-pressed={view === i}
            onClick={() => setView(i)}
            className={`${frame} h-16 w-16 border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-primary)] ${view === i ? "border-[var(--c-primary)]" : "border-transparent"}`}
          >
            <ProductArt p={p} view={i} decorative />
          </button>
        ))}
      </div>
      <div className={`${frame} aspect-square flex-1 sm:aspect-[4/3]`}><ProductArt p={p} view={view} /></div>
    </div>
  );
}

function Summary({ p }: { p: Product }) {
  const { slide } = useBabel();
  return <p className="text-lg leading-relaxed">{p.copy[slide.copyRegister]}</p>;
}

function Benefits({ p }: { p: Product }) {
  return (
    <div>
      <p className="text-lg leading-relaxed">{p.copy.plain}</p>
      <ul className="mt-3 flex flex-col gap-2 text-lg">
        {p.benefits.map((b) => <li key={b} className="flex gap-2"><span aria-hidden className="font-bold text-[var(--c-primary)]">✓</span>{b}</li>)}
      </ul>
    </div>
  );
}

function BuyBox({ p, variant }: { p: Product; variant: "standard" | "calm" | "prominent_simple" }) {
  const { track } = useBabel();
  const cart = useCart();
  const inCart = cart.qty(p.id);
  const add = () => { track("add_to_cart", { blockId: "buyBox", productId: p.id }); cart.add(p.id); };
  const remove = () => { track("remove_from_cart", { blockId: "buyBox", productId: p.id }); cart.set(p.id, inCart - 1); };
  const promo = variant === "standard" && p.promotion;
  const big = variant === "prominent_simple";
  return (
    <div className={`${card} p-5`} onMouseEnter={() => track("hover_price", { blockId: "buyBox", productId: p.id })}>
      <div className="flex flex-wrap items-baseline gap-3">
        <span data-ghost="hover_price" className={`${big ? "text-5xl" : "text-3xl"} font-extrabold`}>{lei.format(p.price)}</span>
        {promo && (
          <>
            <span className="text-[var(--c-muted)] line-through">{lei.format(p.promotion!.oldPrice)}</span>
            <span className="rounded-full bg-[var(--c-accent)] px-2.5 py-0.5 text-sm font-bold text-[#14171f]">{p.promotion!.label}</span>
          </>
        )}
      </div>
      <p className="mt-2 text-[var(--c-muted)]">
        {variant === "calm"
          ? `Free returns within ${p.policies.returnDays} days · ${p.policies.warrantyMonths}-month warranty · delivery in ${p.policies.deliveryDays} days`
          : big ? `It arrives in ${p.policies.deliveryDays} days.` : `${p.stock > 0 ? "In stock" : "Out of stock"} · delivery in ${p.policies.deliveryDays} days`}
      </p>
      <button
        data-ghost="add_to_cart"
        onClick={add}
        disabled={!canAdd(p, inCart)}
        className={`mt-4 ${big ? "w-full py-4 text-xl" : "px-6 py-3"} rounded-[var(--babel-radius)] bg-[var(--c-primary)] font-bold text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-primary)] disabled:opacity-50`}
      >
        {p.stock === 0 ? "Out of stock" : "Add to cart"}
      </button>
      {inCart > 0 && (
        <>
          <button data-ghost="remove_from_cart" onClick={remove} className="mt-4 ml-3 rounded-[var(--babel-radius)] px-4 py-3 font-semibold text-[var(--c-primary)] hover:bg-black/5">
            Remove one ({inCart} in cart)
          </button>
          <Link href="/taraba/cart" className="mt-3 block font-semibold text-[var(--c-primary)] underline">Go to cart and checkout</Link>
        </>
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
          <tr key={s.key} className="border-b border-black/10 last:border-0">
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
        <details className="mt-2" onToggle={(e) => e.currentTarget.open && track("block_open", { blockId: "specs" })}>
          <summary data-ghost="block_open" className="cursor-pointer font-semibold text-[var(--c-primary)]">All {p.specs.length} specifications</summary>
          {rows(p.specs.slice(limit))}
        </details>
      )}
    </div>
  );
}

function Policy({ p, kind, title, children }: { p: Product; kind: string; title: string; children: ReactNode }) {
  const { track } = useBabel();
  return (
    <details className="group" onToggle={(e) => e.currentTarget.open && track("policy_open", { blockId: "trust", productId: p.id, value: kind })}>
      <summary data-ghost={`policy_open:${kind}`} className="cursor-pointer font-semibold text-[var(--c-primary)]">{title}</summary>
      <p className="mt-1 text-[var(--c-muted)]">{children}</p>
    </details>
  );
}

// `narrow`: shown in half the width beside the photos, so inner columns are stacked.
function Trust({ p, policiesFirst, narrow = false }: { p: Product; policiesFirst: boolean; narrow?: boolean }) {
  const { track } = useBabel();
  const picks = useReviewPicks(p.id);
  const policies = policiesFirst ? (
    <div className={`grid gap-3 ${narrow ? "" : "sm:grid-cols-3"}`}>
      {[
        [`${p.policies.returnDays}-day free returns`, "Send it back for any reason, we collect it."],
        [`${p.policies.warrantyMonths}-month warranty`, "Repair or replacement at no cost."],
        [`Delivery in ${p.policies.deliveryDays} days`, "Tracked, with a time slot."],
      ].map(([t, d]) => (
        <div key={t} className="rounded-[var(--babel-radius)] bg-[#f3f5fb] p-3">
          <p className="font-bold">{t}</p>
          <p className="text-sm text-[var(--c-muted)]">{d}</p>
        </div>
      ))}
    </div>
  ) : (
    <div className="flex flex-col gap-1">
      <Policy p={p} kind="returns" title="Returns policy">Free returns within {p.policies.returnDays} days. We collect it from your door.</Policy>
      <Policy p={p} kind="warranty" title="Warranty">{p.policies.warrantyMonths} months, repair or replacement at no cost.</Policy>
      <Policy p={p} kind="delivery" title="Delivery">Delivered in {p.policies.deliveryDays} days, tracked.</Policy>
    </div>
  );
  const reviewItem = (r: Product["reviews"][number]) => (
    <li key={r.author + r.date} className="border-t border-black/10 pt-3">
      <p>
        <span role="img" className="text-[var(--c-primary)]" aria-label={`Rated ${r.rating} out of 5`}>
          {"★".repeat(r.rating)}<span className="text-black/20">{"★".repeat(5 - r.rating)}</span>
        </span>{" "}
        <span className="font-semibold">{r.title}</span>
      </p>
      <p className="mt-1">{r.text}</p>
      <p className="mt-1 text-sm text-[var(--c-muted)]">
        {r.author} · {new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
        {r.verified && " · Verified purchase"}
      </p>
    </li>
  );
  const reviews = (
    <div>
      <Stars p={p} />
      <div className={`mt-2 grid gap-2 ${narrow ? "" : "sm:grid-cols-2"}`}>
        <p><span className="font-semibold">People like:</span> {p.reviewSummary.pros.join(", ")}</p>
        <p><span className="font-semibold">Watch out for:</span> {p.reviewSummary.cons.join(", ")}</p>
      </div>
      <div className="mt-3">
        <button type="button" onClick={picks.ask} disabled={picks.status === "loading"} className="font-semibold text-[var(--c-primary)] underline disabled:opacity-50">
          {picks.status === "loading" ? "Summarising…" : "Summarise the reviews"}
        </button>
        {picks.status === "error" && <p className="mt-1 text-sm text-[var(--c-muted)]">Could not choose right now. All reviews are below.</p>}
        {picks.status === "done" && (
          <div className="mt-2 rounded-[var(--babel-radius)] bg-[#f3f5fb] p-3">
            {picks.summary && <p className="font-semibold">{picks.summary}</p>}
            <p className="mt-1 text-sm text-[var(--c-muted)]">
              {picks.summary ? "Summary written by the Babel agent from these reviews. " : ""}
              The reviews below were chosen by the agent to cover the range of opinions; their words are the buyers&apos;.{" "}
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold">simulated</span>
            </p>
            <ul className="mt-2 flex flex-col gap-3">{picks.indexes.map((i) => reviewItem(p.reviews[i]))}</ul>
          </div>
        )}
      </div>
      <details className="mt-2" onToggle={(e) => e.currentTarget.open && track("review_open", { blockId: "trust", productId: p.id })}>
        <summary data-ghost="review_open" className="cursor-pointer font-semibold text-[var(--c-primary)]">Read reviews</summary>
        <p className="mt-2 text-sm text-[var(--c-muted)]">
          {p.reviews.length} of {p.reviewCount} reviews{" "}
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold">simulated</span>
        </p>
        <ul className="mt-2 flex flex-col gap-3">
          {p.reviews.map(reviewItem)}
        </ul>
      </details>
    </div>
  );
  return (
    <div className={`${card} flex flex-col gap-4 p-5`}>
      <h2 className="text-xl font-bold">{policiesFirst ? "Returns, warranty and reviews" : "Reviews"}</h2>
      {policiesFirst ? <>{policies}{reviews}</> : <>{reviews}{policies}</>}
    </div>
  );
}

export function ProductPage({ product: p, partner, ghost }: Common & { product: Product }) {
  return (
    <BabelProvider store="taraba" template="product" productId={p.id} registry={registry} brand={brand} partner={partner} ghost={ghost}>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6 pb-28">
        <nav aria-label="Breadcrumb" className="text-sm text-[var(--c-muted)]">
          <Link href="/taraba" className="hover:underline">Taraba</Link> /{" "}
          <Link href={`/taraba/c/${p.category}`} className="hover:underline">{CATEGORY_LABEL[p.category]}</Link>
        </nav>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>{p.name}</h1>
        <p className="mt-1 text-[var(--c-muted)]">{p.brand} · <Stars p={p} /></p>
        <BabelStack className="mt-6">
          <BabelBlock id="gallery" variants={{ grid_thumbs: <Gallery p={p} thumbs />, single_large: <Gallery p={p} thumbs={false} />, side_large: <Gallery p={p} thumbs={false} /> }} />
          <BabelBlock id="summary" variants={{ standard: <Summary p={p} />, benefits_plain: <Benefits p={p} /> }} />
          <BabelBlock
            id="buyBox"
            variants={{
              standard: <BuyBox p={p} variant="standard" />,
              calm: <BuyBox p={p} variant="calm" />,
              prominent_simple: <BuyBox p={p} variant="prominent_simple" />,
              side_standard: <BuyBox p={p} variant="standard" />,
            }}
          />
          <BabelBlock id="specs" variants={{ table_key: <Specs p={p} limit={3} />, table_full: <Specs p={p} />, side_key: <Specs p={p} limit={3} /> }} />
          <BabelBlock
            id="trust"
            variants={{
              reviews_summary: <Trust p={p} policiesFirst={false} />,
              returns_warranty_first: <Trust p={p} policiesFirst />,
              side_reviews: <Trust p={p} policiesFirst={false} narrow />,
            }}
          />
        </BabelStack>
      </main>
    </BabelProvider>
  );
}

// ---------- Lists (home, category) ----------

type ListVariant = "grid_standard" | "grid_dense" | "list_guided" | "bento_visual";

function QuickAdd({ p, className = "" }: { p: Product; className?: string }) {
  const { track } = useBabel();
  const cart = useCart();
  const n = cart.qty(p.id);
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        disabled={!canAdd(p, n)}
        onClick={() => { track("add_to_cart", { blockId: "productList", productId: p.id }); cart.add(p.id); }}
        aria-label={`Add ${p.name} to cart`}
        className="rounded-[var(--babel-radius)] border border-[var(--c-primary)] px-3 py-1.5 text-sm font-bold text-[var(--c-primary)] hover:bg-[var(--c-primary)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-primary)] disabled:opacity-50"
      >
        {p.stock === 0 ? "Out of stock" : "Add to cart"}
      </button>
      {n > 0 && <span className="text-sm text-[var(--c-muted)]" role="status">✓ {n} in cart</span>}
    </span>
  );
}

function ProductList({ products, variant }: { products: Product[]; variant: ListVariant }) {
  if (variant === "grid_dense") {
    return (
      <table className="w-full text-left text-sm">
        <thead className="text-[var(--c-muted)]">
          <tr><th className="py-2" colSpan={2}>Product</th><th>Brand</th><th>Key spec</th><th>Rating</th><th className="text-right">Price</th><th><span className="sr-only">Add to cart</span></th></tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-t border-black/10">
              <td className="w-12 py-1.5 pr-2"><Picture p={p} size="sm" /></td>
              <td className="py-2"><Link href={`/taraba/p/${p.id}`} className="font-semibold hover:underline">{p.name}</Link></td>
              <td className="text-[var(--c-muted)]">{p.brand}</td>
              <td>{p.specs[0] ? `${p.specs[0].label}: ${p.specs[0].value}` : ""}</td>
              <td>★ {p.rating.toFixed(1)}</td>
              <td className="text-right font-bold">{lei.format(p.price)}</td>
              <td className="pl-3"><QuickAdd p={p} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (variant === "list_guided") {
    return (
      <ul className="flex flex-col gap-4">
        {products.map((p) => (
          <li key={p.id} className={`${card} flex gap-4 p-4`}>
            <Picture p={p} size="lg" />
            <div className="flex-1">
              <p className="text-xl font-bold">{p.name}</p>
              <p className="mt-1">{p.benefits.slice(0, 2).join(" · ")}</p>
              <p className="mt-2 text-2xl font-extrabold">{lei.format(p.price)}</p>
              <Link href={`/taraba/p/${p.id}`} className="mt-3 inline-block rounded-[var(--babel-radius)] bg-[var(--c-primary)] px-5 py-3 text-lg font-bold text-white">
                See this product
              </Link>
              <QuickAdd p={p} className="mt-3" />
            </div>
          </li>
        ))}
      </ul>
    );
  }
  if (variant === "bento_visual") {
    // Image-first: the first product is a big tile; name and price sit on the picture.
    return (
      <ul className="grid grid-flow-dense auto-rows-[9rem] grid-cols-2 gap-3 md:auto-rows-[11rem] md:grid-cols-4">
        {products.map((p, i) => (
          <li key={p.id} className={i === 0 ? "col-span-2 row-span-2" : i % 7 === 3 ? "col-span-2" : ""}>
            <Link href={`/taraba/p/${p.id}`} aria-label={`${p.name}, ${lei.format(p.price)}`} className="group relative block h-full overflow-hidden rounded-[var(--babel-radius)]">
              <div className="h-full w-full transition-transform duration-500 group-hover:scale-105"><ProductArt p={p} decorative /></div>
              <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent p-3 text-white">
                <span className={`${i === 0 ? "text-xl" : "text-sm"} font-bold leading-tight`}>{p.name}</span>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-sm font-extrabold text-[#14171f]">{lei.format(p.price)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {products.map((p) => (
        <li key={p.id} className="flex flex-col gap-2">
          <Link href={`/taraba/p/${p.id}`} className="group flex flex-col gap-2">
            <Picture p={p} />
            <span className="font-semibold group-hover:underline">{p.name}</span>
            <span className="text-lg font-extrabold">{lei.format(p.price)}</span>
            <Stars p={p} />
          </Link>
          <QuickAdd p={p} />
        </li>
      ))}
    </ul>
  );
}

const listVariants = (products: Product[]) => ({
  grid_standard: <ProductList products={products} variant="grid_standard" />,
  grid_dense: <ProductList products={products} variant="grid_dense" />,
  list_guided: <ProductList products={products} variant="list_guided" />,
  bento_visual: <ProductList products={products} variant="bento_visual" />,
});

// The best-rated product of each category: what the hero pictures show.
const featured = (products: Product[]) =>
  (Object.keys(CATEGORY_LABEL) as Category[]).flatMap((c) => {
    const top = products.filter((p) => p.category === c).sort((a, b) => b.rating - a.rating)[0];
    return top ? [top] : [];
  });

export function HomePage({ products, partner, ghost }: Common & { products: Product[] }) {
  return (
    <BabelProvider store="taraba" template="home" registry={registry} brand={brand} partner={partner} ghost={ghost}>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6 pb-28">
        <BabelStack>
          <BabelBlock
            id="hero"
            variants={{
              banner_promo: (
                <Link href="/taraba/c/home" className="grid items-center gap-4 overflow-hidden rounded-[var(--babel-radius)] bg-[var(--c-accent)] text-[#14171f] md:grid-cols-[1fr_16rem]">
                  <span className="block p-8">
                    <span className="block text-sm font-bold uppercase">Autumn deals</span>
                    <span className="mt-1 block text-3xl font-extrabold" style={{ fontFamily: "var(--font-heading)" }}>Washing machines and headphones for less</span>
                    <span className="mt-2 block">The same prices for everyone, until the end of the month.</span>
                  </span>
                  <span className="grid h-40 grid-cols-2 gap-1 md:h-full">
                    {["home-wm-01", "elec-hp-01"].map((id) => {
                      const p = products.find((x) => x.id === id);
                      return p ? <ProductArt key={id} p={p} decorative /> : null;
                    })}
                  </span>
                </Link>
              ),
              category_tiles: (
                <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {featured(products).map((p) => (
                    <li key={p.category}>
                      <Link href={`/taraba/c/${p.category}`} className="flex items-center gap-3 rounded-[var(--babel-radius)] p-3 text-lg font-bold" style={{ background: CATEGORY_TINT[p.category] }}>
                        <Picture p={p} size="lg" />
                        {CATEGORY_LABEL[p.category]}
                      </Link>
                    </li>
                  ))}
                </ul>
              ),
              collage: (
                <ul className="grid auto-rows-[7rem] grid-cols-3 gap-3 md:auto-rows-[10rem]">
                  {featured(products).map((p, i) => (
                    <li key={p.category} className={i === 0 ? "col-span-2 row-span-2" : ""}>
                      <Link href={`/taraba/c/${p.category}`} className="relative block h-full overflow-hidden rounded-[var(--babel-radius)]">
                        <ProductArt p={p} decorative />
                        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-sm font-bold text-[#14171f]">{CATEGORY_LABEL[p.category]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ),
            }}
          />
          <BabelBlock id="productList" variants={listVariants(products)} />
        </BabelStack>
      </main>
    </BabelProvider>
  );
}

// ---------- Category and search results, with filters ----------

type Sort = "relevance" | "price_asc" | "price_desc" | "rating";
const SORTS: [Sort, string][] = [["relevance", "Recommended"], ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"], ["rating", "Best rated"]];
const field = "rounded-[var(--babel-radius)] border border-black/20 bg-white px-2 py-1.5";

function ListingBody({ title, products, note }: { title: string; products: Product[]; note?: string }) {
  const { track } = useBabel();
  const top = Math.ceil(Math.max(0, ...products.map((p) => p.price)));
  const brands = useMemo(() => [...new Set(products.map((p) => p.brand))].sort(), [products]);
  const [sort, setSort] = useState<Sort>("relevance");
  const [maxPrice, setMaxPrice] = useState(top);
  const [minRating, setMinRating] = useState(0);
  const [inStock, setInStock] = useState(false);
  const [onSale, setOnSale] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const shown = useMemo(() => {
    const list = products.filter((p) =>
      p.price <= maxPrice && p.rating >= minRating && (!inStock || p.stock > 0) && (!onSale || p.promotion) &&
      (picked.length === 0 || picked.includes(p.brand)));
    if (sort === "price_asc") list.sort((a, b) => a.price - b.price);
    if (sort === "price_desc") list.sort((a, b) => b.price - a.price);
    if (sort === "rating") list.sort((a, b) => b.rating - a.rating);
    return list;
  }, [products, sort, maxPrice, minRating, inStock, onSale, picked]);
  const filtered = maxPrice < top || minRating > 0 || inStock || onSale || picked.length > 0;
  const clear = () => { setMaxPrice(top); setMinRating(0); setInStock(false); setOnSale(false); setPicked([]); track("filter", { value: "clear" }); };
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 pb-28">
      <h1 className="text-3xl font-extrabold" style={{ fontFamily: "var(--font-heading)" }}>{title}</h1>
      {note && <p className="mt-1 text-[var(--c-muted)]">{note}</p>}
      <div className="mt-4 grid gap-6 md:grid-cols-[14rem_1fr]">
        <form aria-label="Filters" onSubmit={(e) => e.preventDefault()} className={`${card} flex h-fit flex-col gap-4 p-4`}>
          <label className="flex flex-col gap-1 font-semibold">
            Sort by
            <select value={sort} onChange={(e) => { setSort(e.target.value as Sort); track("sort", { value: e.target.value }); }} className={`${field} font-normal`}>
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-semibold">
            <span>Up to <span className="font-extrabold">{lei.format(maxPrice)}</span></span>
            <input
              type="range" min={0} max={top} step={Math.max(1, Math.round(top / 50))} value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              onPointerUp={() => track("filter", { value: `price<=${maxPrice}` })}
              onKeyUp={() => track("filter", { value: `price<=${maxPrice}` })}
              className="accent-[var(--c-primary)]"
            />
          </label>
          <label className="flex flex-col gap-1 font-semibold">
            Rating
            <select value={minRating} onChange={(e) => { setMinRating(Number(e.target.value)); track("filter", { value: `rating>=${e.target.value}` }); }} className={`${field} font-normal`}>
              <option value={0}>Any</option><option value={4}>4 ★ and up</option><option value={4.5}>4.5 ★ and up</option>
            </select>
          </label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={inStock} onChange={(e) => { setInStock(e.target.checked); track("filter", { value: "in_stock" }); }} className="accent-[var(--c-primary)]" /> In stock only</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={onSale} onChange={(e) => { setOnSale(e.target.checked); track("filter", { value: "on_sale" }); }} className="accent-[var(--c-primary)]" /> On promotion</label>
          {brands.length > 1 && (
            <fieldset className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              <legend className="mb-1 font-semibold">Brand</legend>
              {brands.map((b) => (
                <label key={b} className="flex items-center gap-2">
                  <input
                    type="checkbox" checked={picked.includes(b)} className="accent-[var(--c-primary)]"
                    onChange={(e) => { setPicked(e.target.checked ? [...picked, b] : picked.filter((x) => x !== b)); track("filter", { value: `brand:${b}` }); }}
                  />
                  {b}
                </label>
              ))}
            </fieldset>
          )}
          {filtered && <button type="button" onClick={clear} className="text-left font-semibold text-[var(--c-primary)] underline">Clear filters</button>}
        </form>
        <section aria-label="Results">
          <p className="mb-3 text-[var(--c-muted)]" role="status">{shown.length} of {products.length} products</p>
          {shown.length === 0 ? (
            <div className={`${card} p-6`}>
              <p className="font-semibold">Nothing matches these filters.</p>
              {filtered && <button type="button" onClick={clear} className="mt-2 font-semibold text-[var(--c-primary)] underline">Clear filters</button>}
            </div>
          ) : (
            <BabelStack><BabelBlock id="productList" variants={listVariants(shown)} /></BabelStack>
          )}
        </section>
      </div>
    </main>
  );
}

function Listing({ title, products, query, note, partner, ghost }: Common & { title: string; products: Product[]; query?: string; note?: string }) {
  return (
    <BabelProvider store="taraba" template="category" registry={registry} brand={brand} partner={partner} ghost={ghost}>
      <Header query={query} />
      {/* key: a new page (another category or search) starts with fresh filters */}
      <ListingBody key={title} title={title} products={products} note={note} />
    </BabelProvider>
  );
}

export const CategoryPage = ({ category, ...rest }: Common & { category: Category; products: Product[] }) =>
  <Listing title={CATEGORY_LABEL[category]} {...rest} />;

export const SearchPage = ({ query, ...rest }: Common & { query: string; products: Product[] }) =>
  <Listing title={query ? `Results for “${query}”` : "All products"} query={query} {...rest} />;
