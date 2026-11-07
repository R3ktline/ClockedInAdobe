"use client";
// Taraba's home, category, search and hand-off pages. Lists and filters are <BabelBlock>s.
import Link from "next/link";
import { useMemo, useState } from "react";
import { BabelBlock, BabelProvider, BabelStack, useBabel, type BrandKit, type Category, type Initial, type Product } from "@/babel/sdk";
import brandKit from "./brand-kit.json";
import { ProductArt } from "./art";
import { canAdd, useCart } from "./cart";
import { registry } from "./registry";
import { Recent } from "./product";
import { CATEGORY_LABEL, CATEGORY_TINT, Header, Picture, Stars, card, lei, primaryBtn } from "./ui";

const brand = brandKit as BrandKit;
type ListVariant = "grid_standard" | "grid_dense" | "list_guided" | "bento_visual";

function QuickAdd({ p, className = "" }: { p: Product; className?: string }) {
  const { track } = useBabel();
  const cart = useCart();
  const n = cart.qty(p.id);
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <button type="button" data-ghost="add_to_cart" data-product={p.id} disabled={!canAdd(p, n)} aria-label={`Add ${p.name} to cart`}
        onClick={() => { track("add_to_cart", { blockId: "productList", productId: p.id }); cart.add(p.id); }}
        className="rounded-[var(--babel-radius)] border border-[var(--c-primary)] px-3 py-1.5 text-sm font-bold text-[var(--c-primary)] hover:bg-[var(--c-primary)] hover:text-white disabled:opacity-50">
        {p.stock === 0 ? "Out of stock" : "Add to cart"}
      </button>
      {n > 0 && <span className="text-sm text-[var(--c-muted)]" role="status">✓ {n} in cart</span>}
    </span>
  );
}

function ProductLink({ p, className, children, label }: { p: Product; className?: string; children: React.ReactNode; label?: string }) {
  const { track } = useBabel();
  return (
    <Link href={`/taraba/p/${p.id}`} aria-label={label} data-ghost="product_click" data-product={p.id} className={className}
      onClick={() => track("product_click", { blockId: "productList", productId: p.id })}>{children}</Link>
  );
}

function ProductList({ products, variant }: { products: Product[]; variant: ListVariant }) {
  const { track } = useBabel();
  if (!products.length) return <div className={`${card} p-6`}><p className="font-semibold">No products match.</p></div>;
  if (variant === "grid_dense") {
    return (
      <table className="w-full text-left text-sm">
        <thead className="text-[var(--c-muted)]"><tr><th className="py-2" colSpan={2}>Product</th><th>Brand</th><th>Key spec</th><th>Rating</th><th className="text-right">Price</th><th><span className="sr-only">Add</span></th></tr></thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-t border-black/10">
              <td className="w-12 py-1.5 pr-2"><Picture p={p} size="sm" /></td>
              <td className="py-2"><ProductLink p={p} className="font-semibold hover:underline">{p.name}</ProductLink></td>
              <td className="text-[var(--c-muted)]">{p.brand}</td>
              <td>{p.specs[0] ? `${p.specs[0].label}: ${p.specs[0].value}` : ""}</td>
              <td>★ {p.rating.toFixed(1)}</td>
              <td className="text-right font-bold">{lei.format(p.price)}</td>
              <td className="pl-3"><QuickAdd p={p} /><button type="button" data-ghost="compare_add" data-product={p.id} onClick={() => track("compare_add", { blockId: "productList", productId: p.id })} className="mt-1 text-xs underline">Compare</button></td>
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
              <ProductLink p={p} className={`mt-3 inline-block px-5 py-3 text-lg ${primaryBtn}`}>See this product</ProductLink>
              <QuickAdd p={p} className="mt-3" />
            </div>
          </li>
        ))}
      </ul>
    );
  }
  if (variant === "bento_visual") {
    return (
      <ul className="grid grid-flow-dense auto-rows-[9rem] grid-cols-2 gap-3 md:auto-rows-[11rem] md:grid-cols-4">
        {products.map((p, i) => (
          <li key={p.id} className={i === 0 ? "col-span-2 row-span-2" : i % 7 === 3 ? "col-span-2" : ""}>
            <ProductLink p={p} label={`${p.name}, ${lei.format(p.price)}`} className="group relative block h-full overflow-hidden rounded-[var(--babel-radius)]">
              <span className="block h-full w-full transition-transform duration-500 group-hover:scale-105" onMouseEnter={() => track("image_zoom", { blockId: "productList", productId: p.id })}><ProductArt p={p} decorative /></span>
              <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent p-3 text-white">
                <span className={`${i === 0 ? "text-xl" : "text-sm"} font-bold leading-tight`}>{p.name}</span>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-sm font-extrabold text-[#14171f]">{lei.format(p.price)}</span>
              </span>
            </ProductLink>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {products.map((p) => (
        <li key={p.id} className="flex flex-col gap-2">
          <ProductLink p={p} className="group flex flex-col gap-2">
            <Picture p={p} />
            <span className="font-semibold group-hover:underline">{p.name}</span>
            <span className="text-lg font-extrabold">{lei.format(p.price)}</span>
            <Stars p={p} />
          </ProductLink>
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

const featured = (products: Product[]) => (Object.keys(CATEGORY_LABEL) as Category[]).flatMap((c) => {
  const top = products.filter((p) => p.category === c).sort((a, b) => b.rating - a.rating)[0];
  return top ? [top] : [];
});

function CategoryLink({ c, className, children, style }: { c: Category; className?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  const { track } = useBabel();
  return <Link href={`/taraba/c/${c}`} data-ghost="category_click" className={className} style={style} onClick={() => track("category_click", { value: c })}>{children}</Link>;
}

export function HomePage({ initial, products }: { initial: Initial; products: Product[] }) {
  const promo = products.filter((p) => p.promotion).slice(0, 2);
  return (
    <BabelProvider initial={initial} registry={registry} brand={brand}>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6 pb-28">
        <BabelStack>
          <BabelBlock id="hero" variants={{
            banner_promo: (
              <div className="grid items-center gap-4 overflow-hidden rounded-[var(--babel-radius)] bg-[var(--c-accent)] text-[#14171f] md:grid-cols-[1fr_16rem]">
                <span className="block p-8">
                  <span className="block text-sm font-bold uppercase">This season at Taraba</span>
                  <span className="mt-1 block text-3xl font-extrabold" style={{ fontFamily: "var(--font-heading)" }}>Autumn deals, same price for everyone</span>
                  <span className="mt-2 block">{promo.map((p) => `${p.name}: ${lei.format(p.price)} (was ${lei.format(p.promotion!.oldPrice)})`).join(" · ")}</span>
                </span>
                <span className="grid h-40 grid-cols-2 gap-1 md:h-full">{promo.map((p) => <ProductArt key={p.id} p={p} decorative />)}</span>
              </div>
            ),
            category_tiles: (
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {featured(products).map((p) => (
                  <li key={p.category}><CategoryLink c={p.category} className="flex items-center gap-3 rounded-[var(--babel-radius)] p-3 text-lg font-bold" style={{ background: CATEGORY_TINT[p.category] }}><Picture p={p} size="lg" />{CATEGORY_LABEL[p.category]}</CategoryLink></li>
                ))}
              </ul>
            ),
            collage: (
              <ul className="grid auto-rows-[7rem] grid-cols-3 gap-3 md:auto-rows-[10rem]">
                {featured(products).map((p, i) => (
                  <li key={p.category} className={i === 0 ? "col-span-2 row-span-2" : ""}>
                    <CategoryLink c={p.category} className="relative block h-full overflow-hidden rounded-[var(--babel-radius)]"><ProductArt p={p} decorative /><span className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-sm font-bold text-[#14171f]">{CATEGORY_LABEL[p.category]}</span></CategoryLink>
                  </li>
                ))}
              </ul>
            ),
          }} />
          <BabelBlock id="continuity" variants={{ recent: <Recent all={products} /> }} />
          <BabelBlock id="productList" variants={listVariants(products.filter((_, i) => i % 3 === 0).slice(0, 12))} />
        </BabelStack>
      </main>
    </BabelProvider>
  );
}

type Sort = "relevance" | "price_asc" | "price_desc" | "rating";
const field = "rounded-[var(--babel-radius)] border border-black/20 bg-white px-2 py-1.5";

function ListingBody({ title, products, note }: { title: string; products: Product[]; note?: string }) {
  const { track, view } = useBabel();
  const filtersVariant = view.blocks.find((b) => b.id === "filters")?.variant ?? "sidebar";
  const top = Math.ceil(Math.max(0, ...products.map((p) => p.price)));
  const brands = useMemo(() => [...new Set(products.map((p) => p.brand))].sort(), [products]);
  const [sort, setSort] = useState<Sort>(filtersVariant === "price_first" ? "price_asc" : "relevance");
  const [maxPrice, setMaxPrice] = useState(top);
  const [minRating, setMinRating] = useState(0);
  const [inStock, setInStock] = useState(false);
  const [onSale, setOnSale] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const shown = useMemo(() => {
    const list = products.filter((p) => p.price <= maxPrice && p.rating >= minRating && (!inStock || p.stock > 0) && (!onSale || p.promotion) && (!picked.length || picked.includes(p.brand)));
    if (sort === "price_asc") list.sort((a, b) => a.price - b.price);
    if (sort === "price_desc") list.sort((a, b) => b.price - a.price);
    if (sort === "rating") list.sort((a, b) => b.rating - a.rating);
    return list;
  }, [products, sort, maxPrice, minRating, inStock, onSale, picked]);
  const setS = (s: Sort) => { setSort(s); track("sort", { blockId: "filters", value: s }); };
  const sortSelect = (
    <label className="flex flex-col gap-1 font-semibold">Sort by
      <select data-ghost="sort" value={sort} onChange={(e) => setS(e.target.value as Sort)} className={`${field} font-normal`}>
        <option value="relevance">Relevance</option><option value="price_asc">Price, lowest first</option><option value="price_desc">Price, highest first</option><option value="rating">Best rated</option>
      </select>
    </label>
  );
  const sale = <label className="flex items-center gap-2"><input type="checkbox" checked={onSale} onChange={(e) => { setOnSale(e.target.checked); track("filter", { blockId: "filters", value: "on_sale" }); }} /> On sale (store promotions)</label>;
  const full = (compact: boolean) => (
    <form aria-label="Filters" onSubmit={(e) => e.preventDefault()} className={`${card} flex h-fit gap-4 p-4 ${compact ? "flex-row flex-wrap items-end text-sm" : "flex-col"}`}>
      {filtersVariant === "price_first" && sale}
      {sortSelect}
      <label className="flex flex-col gap-1 font-semibold"><span>Up to {lei.format(maxPrice)}</span>
        <input type="range" min={0} max={top} step={Math.max(1, Math.round(top / 50))} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))}
          onPointerUp={() => track("filter", { blockId: "filters", value: `price<=${maxPrice}` })} onKeyUp={() => track("filter", { blockId: "filters", value: `price<=${maxPrice}` })} />
      </label>
      <label className="flex flex-col gap-1 font-semibold">Rating
        <select value={minRating} onChange={(e) => { setMinRating(Number(e.target.value)); track("filter", { blockId: "filters", value: `rating>=${e.target.value}` }); }} className={`${field} font-normal`}>
          <option value={0}>Any</option><option value={4}>4 stars and up</option><option value={4.5}>4.5 stars and up</option>
        </select>
      </label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={inStock} onChange={(e) => { setInStock(e.target.checked); track("filter", { blockId: "filters", value: "in_stock" }); }} /> In stock</label>
      {filtersVariant !== "price_first" && sale}
      {brands.length > 1 && (
        <fieldset className={`flex flex-col gap-1 ${compact ? "" : "max-h-48 overflow-y-auto"}`}>
          <legend className="mb-1 font-semibold">Brand</legend>
          {brands.map((b) => <label key={b} className="flex items-center gap-2"><input type="checkbox" checked={picked.includes(b)} onChange={(e) => { setPicked(e.target.checked ? [...picked, b] : picked.filter((x) => x !== b)); track("filter", { blockId: "filters", value: `brand:${b}` }); }} />{b}</label>)}
        </fieldset>
      )}
    </form>
  );
  const simple = (
    <form aria-label="Filters" onSubmit={(e) => e.preventDefault()} className={`${card} flex flex-col gap-4 p-4 text-lg`}>
      {sortSelect}
      <button type="button" aria-pressed={inStock} onClick={() => { setInStock(!inStock); track("filter", { blockId: "filters", value: "in_stock" }); }} className={`rounded-[var(--babel-radius)] border-2 border-[var(--c-primary)] px-4 py-3 font-bold ${inStock ? "bg-[var(--c-primary)] text-white" : "text-[var(--c-primary)]"}`}>In stock only</button>
      <button type="button" aria-pressed={sort === "rating"} onClick={() => setS("rating")} className={`rounded-[var(--babel-radius)] border-2 border-[var(--c-primary)] px-4 py-3 font-bold ${sort === "rating" ? "bg-[var(--c-primary)] text-white" : "text-[var(--c-primary)]"}`}>Best rated first</button>
    </form>
  );
  const list = <BabelBlock id="productList" variants={listVariants(shown)} />;
  const filters = <BabelBlock id="filters" variants={{ sidebar: full(false), compact: full(true), simple, price_first: full(false) }} />;
  const side = filtersVariant === "sidebar" || filtersVariant === "price_first" || filtersVariant === "simple";
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 pb-28">
      <h1 className="text-3xl font-extrabold" style={{ fontFamily: "var(--font-heading)" }}>{title}</h1>
      {note && <p className="mt-1 text-[var(--c-muted)]">{note}</p>}
      <p className="mt-1 mb-3 text-[var(--c-muted)]" role="status">{shown.length} of {products.length} products</p>
      {side ? <div className="grid gap-6 md:grid-cols-[15rem_1fr]">{filters}<section aria-label="Results">{list}</section></div> : <BabelStack>{filters}{list}</BabelStack>}
    </main>
  );
}

export function ListingPage({ initial, title, products, query, note }: { initial: Initial; title: string; products: Product[]; query?: string; note?: string }) {
  return (
    <BabelProvider initial={initial} registry={registry} brand={brand}>
      <Header query={query} />
      <ListingBody key={title} title={title} products={products} note={note} />
    </BabelProvider>
  );
}
