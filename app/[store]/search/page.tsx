import { catalog } from "@/data/catalog";
import { ListingPage } from "@/stores/taraba/lists";
import { open, type SearchParams } from "../_open";

const STOP = new Set(["and", "the", "for", "with", "my", "a", "an", "good", "best", "cheap", "under", "lei"]);

export default async function Page({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: SearchParams }) {
  const { store } = await params;
  const q = await searchParams;
  const query = typeof q.q === "string" ? q.q.slice(0, 120) : "";
  const words = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1 && !STOP.has(w));
  const hay = (p: (typeof catalog)[number]) => [p.name, p.brand, p.category, p.copy.technical, ...p.specs.map((s) => `${s.label} ${s.value}`)].join(" ").toLowerCase();
  const scored = catalog.map((p) => ({ p, n: words.filter((w) => hay(p).includes(w)).length + 2 * words.filter((w) => p.name.toLowerCase().includes(w)).length }));
  const products = words.length ? scored.filter((x) => x.n > 0).sort((a, b) => b.n - a.n).map((x) => x.p) : catalog;
  const initial = await open({ store, template: "category", path: `/${store}/search?q=${encodeURIComponent(query)}`, searchParams });
  return <ListingPage initial={initial} title={query ? `Results for “${query}”` : "All products"} products={products} query={query} />;
}
