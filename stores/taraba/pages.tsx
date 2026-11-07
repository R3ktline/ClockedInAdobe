"use client";
// Taraba: a fictional general marketplace. This is "the store's own code": it renders its pages
// and declares variants; Babel (via babel/sdk) only picks which variant shows and where.
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  BabelBlock, BabelProvider, BabelStack, useBabel,
  type BrandKit, type Category, type InteractionEvent, type PartnerContext, type Product,
} from "@/babel/sdk";
import brandKit from "./brand-kit.json";
import { registry } from "./registry";

const brand = brandKit as BrandKit;
const lei = new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 });

export const CATEGORY_LABEL: Record<Category, string> = {
  electronics: "Electronics", fashion: "Fashion", home: "Home & furniture",
  groceries: "Groceries", toys: "Toys", health_beauty: "Health & beauty",
};
const CATEGORY_TINT: Record<Category, string> = {
  electronics: "#e7ecfb", fashion: "#f6e9ef", home: "#e9f3ec", groceries: "#fbf3df", toys: "#fdeee3", health_beauty: "#eef0f6",
};

type Common = { partner: PartnerContext; ghost?: { label: string; events: InteractionEvent[] } };

const card = "rounded-[var(--babel-radius)] border border-black/10 bg-white";

function Header({ cart = 0 }: { cart?: number }) {
  return (
    <header className="bg-[var(--c-primary)] text-white">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/taraba" className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
          taraba
        </Link>
        <input
          type="search"
          aria-label="Search Taraba"
          placeholder="Search products"
          className="min-w-0 flex-1 rounded-full bg-white px-4 py-2 text-[var(--c-text)] placeholder:text-[#5b6170]"
        />
        <span className="rounded-full bg-[var(--c-accent)] px-3 py-1.5 text-sm font-bold text-[#14171f]" aria-label={`Cart, ${cart} items`}>
          Cart · {cart}
        </span>
      </div>
      <nav aria-label="Categories" className="mx-auto flex max-w-5xl gap-4 overflow-x-auto px-4 pb-2 text-sm text-white/90">
        {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
          <Link key={c} href={`/taraba/c/${c}`} className="whitespace-nowrap hover:underline">{CATEGORY_LABEL[c]}</Link>
        ))}
      </nav>
    </header>
  );
}

function Picture({ p, size = "md" }: { p: Product; size?: "sm" | "md" }) {
  const h = size === "md" ? "aspect-square" : "h-20 w-20 shrink-0";
  return (
    <div
      className={`${h} flex items-end rounded-[var(--babel-radius)] p-3`}
      style={{ background: CATEGORY_TINT[p.category] }}
      role="img"
      aria-label={`Photo placeholder: ${p.name}`}
    >
      {size !== "sm" && <span className="text-xs font-semibold tracking-wide text-black/45">{p.brand}</span>}
    </div>
  );
}

const Stars = ({ p }: { p: Product }) => (
  <span className="text-sm text-[var(--c-muted)]">★ {p.rating.toFixed(1)} · {p.reviewCount} reviews</span>
);

// ---------- Product page ----------

function Gallery({ p, thumbs }: { p: Product; thumbs: boolean }) {
  const photo = (h: string) => (
    <div className={`${h} flex items-end rounded-[var(--babel-radius)] p-3`} style={{ background: CATEGORY_TINT[p.category] }} role="img" aria-label={`Photo placeholder: ${p.name}`}>
      <span className="text-xs font-semibold tracking-wide text-black/45">{p.brand}</span>
    </div>
  );
  if (!thumbs) return photo("h-80");
  return (
    <div className="flex gap-2">
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => <div key={i} className="h-14 w-14 rounded-[var(--babel-radius)]" style={{ background: CATEGORY_TINT[p.category] }} />)}
      </div>
      <div className="flex-1">{photo("h-48")}</div>
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

type Cart = { count: number; add: () => void; remove: () => void };

function BuyBox({ p, variant, cart }: { p: Product; variant: "standard" | "calm" | "prominent_simple"; cart: Cart }) {
  const { track } = useBabel();
  const add = () => { track("add_to_cart", { blockId: "buyBox", productId: p.id }); cart.add(); };
  const remove = () => { track("remove_from_cart", { blockId: "buyBox", productId: p.id }); cart.remove(); };
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
        className={`mt-4 ${big ? "w-full py-4 text-xl" : "px-6 py-3"} rounded-[var(--babel-radius)] bg-[var(--c-primary)] font-bold text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-primary)]`}
      >
        Add to cart
      </button>
      {cart.count > 0 && (
        <button data-ghost="remove_from_cart" onClick={remove} className="mt-4 ml-3 rounded-[var(--babel-radius)] px-4 py-3 font-semibold text-[var(--c-primary)] hover:bg-black/5">
          Remove from cart ({cart.count})
        </button>
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

function Trust({ p, policiesFirst }: { p: Product; policiesFirst: boolean }) {
  const { track } = useBabel();
  const policies = policiesFirst ? (
    <div className="grid gap-3 sm:grid-cols-3">
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
  const reviews = (
    <div>
      <Stars p={p} />
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <p><span className="font-semibold">People like:</span> {p.reviewSummary.pros.join(", ")}</p>
        <p><span className="font-semibold">Watch out for:</span> {p.reviewSummary.cons.join(", ")}</p>
      </div>
      <details className="mt-2" onToggle={(e) => e.currentTarget.open && track("review_open", { blockId: "trust", productId: p.id })}>
        <summary data-ghost="review_open" className="cursor-pointer font-semibold text-[var(--c-primary)]">Read reviews</summary>
        <p className="mt-2 text-sm text-[var(--c-muted)]">
          {p.reviews.length} of {p.reviewCount} reviews{" "}
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold">simulated</span>
        </p>
        <ul className="mt-2 flex flex-col gap-3">
          {p.reviews.map((r) => (
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
          ))}
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
  const [count, setCount] = useState(0);
  const cart: Cart = { count, add: () => setCount((c) => c + 1), remove: () => setCount((c) => Math.max(0, c - 1)) };
  return (
    <BabelProvider store="taraba" template="product" productId={p.id} registry={registry} brand={brand} partner={partner} ghost={ghost}>
      <Header cart={count} />
      <main className="mx-auto max-w-3xl px-4 py-6 pb-28">
        <nav aria-label="Breadcrumb" className="text-sm text-[var(--c-muted)]">
          <Link href="/taraba" className="hover:underline">Taraba</Link> /{" "}
          <Link href={`/taraba/c/${p.category}`} className="hover:underline">{CATEGORY_LABEL[p.category]}</Link>
        </nav>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>{p.name}</h1>
        <p className="mt-1 text-[var(--c-muted)]">{p.brand} · <Stars p={p} /></p>
        <BabelStack className="mt-6">
          <BabelBlock id="gallery" variants={{ grid_thumbs: <Gallery p={p} thumbs />, single_large: <Gallery p={p} thumbs={false} /> }} />
          <BabelBlock id="summary" variants={{ standard: <Summary p={p} />, benefits_plain: <Benefits p={p} /> }} />
          <BabelBlock
            id="buyBox"
            variants={{
              standard: <BuyBox p={p} variant="standard" cart={cart} />,
              calm: <BuyBox p={p} variant="calm" cart={cart} />,
              prominent_simple: <BuyBox p={p} variant="prominent_simple" cart={cart} />,
            }}
          />
          <BabelBlock id="specs" variants={{ table_key: <Specs p={p} limit={3} />, table_full: <Specs p={p} /> }} />
          <BabelBlock id="trust" variants={{ reviews_summary: <Trust p={p} policiesFirst={false} />, returns_warranty_first: <Trust p={p} policiesFirst /> }} />
        </BabelStack>
      </main>
    </BabelProvider>
  );
}

// ---------- Lists (home, category) ----------

function ProductList({ products, variant }: { products: Product[]; variant: "grid_standard" | "grid_dense" | "list_guided" }) {
  if (variant === "grid_dense") {
    return (
      <table className="w-full text-left text-sm">
        <thead className="text-[var(--c-muted)]">
          <tr><th className="py-2">Product</th><th>Key spec</th><th>Rating</th><th className="text-right">Price</th></tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-t border-black/10">
              <td className="py-2"><Link href={`/taraba/p/${p.id}`} className="font-semibold hover:underline">{p.name}</Link></td>
              <td>{p.specs[0] ? `${p.specs[0].label}: ${p.specs[0].value}` : ""}</td>
              <td>★ {p.rating.toFixed(1)}</td>
              <td className="text-right font-bold">{lei.format(p.price)}</td>
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
            <Picture p={p} size="sm" />
            <div className="flex-1">
              <p className="text-xl font-bold">{p.name}</p>
              <p className="mt-1">{p.benefits.slice(0, 2).join(" · ")}</p>
              <p className="mt-2 text-2xl font-extrabold">{lei.format(p.price)}</p>
              <Link href={`/taraba/p/${p.id}`} className="mt-3 inline-block rounded-[var(--babel-radius)] bg-[var(--c-primary)] px-5 py-3 text-lg font-bold text-white">
                See this product
              </Link>
            </div>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {products.map((p) => (
        <li key={p.id}>
          <Link href={`/taraba/p/${p.id}`} className="group flex flex-col gap-2">
            <Picture p={p} />
            <span className="font-semibold group-hover:underline">{p.name}</span>
            <span className="text-lg font-extrabold">{lei.format(p.price)}</span>
            <Stars p={p} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

const listVariants = (products: Product[]) => ({
  grid_standard: <ProductList products={products} variant="grid_standard" />,
  grid_dense: <ProductList products={products} variant="grid_dense" />,
  list_guided: <ProductList products={products} variant="list_guided" />,
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
                <Link href="/taraba/c/home" className="block rounded-[var(--babel-radius)] bg-[var(--c-accent)] p-8 text-[#14171f]">
                  <p className="text-sm font-bold uppercase">Autumn deals</p>
                  <p className="mt-1 text-3xl font-extrabold" style={{ fontFamily: "var(--font-heading)" }}>Washing machines and headphones for less</p>
                  <p className="mt-2">The same prices for everyone, until the end of the month.</p>
                </Link>
              ),
              category_tiles: (
                <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                    <li key={c}>
                      <Link href={`/taraba/c/${c}`} className="block rounded-[var(--babel-radius)] p-6 text-lg font-bold" style={{ background: CATEGORY_TINT[c] }}>
                        {CATEGORY_LABEL[c]}
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

export function CategoryPage({ category, products, partner, ghost }: Common & { category: Category; products: Product[] }) {
  return (
    <BabelProvider store="taraba" template="category" registry={registry} brand={brand} partner={partner} ghost={ghost}>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6 pb-28">
        <h1 className="mb-4 text-3xl font-extrabold" style={{ fontFamily: "var(--font-heading)" }}>{CATEGORY_LABEL[category]}</h1>
        <BabelStack>
          <BabelBlock id="productList" variants={listVariants(products)} />
        </BabelStack>
      </main>
    </BabelProvider>
  );
}
