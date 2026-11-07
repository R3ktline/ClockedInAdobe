import { notFound } from "next/navigation";
import { catalog } from "@/data/catalog";
import { storePages } from "@/stores/pages";
import { shopperFrom, type PageProps } from "../_shopper";

export default async function StoreSearch({ params, searchParams }: PageProps<{ store: string }>) {
  const { store } = await params;
  const pages = storePages[store as keyof typeof storePages];
  if (!pages) notFound();
  const raw = (await searchParams).q;
  const query = (typeof raw === "string" ? raw : "").trim().slice(0, 80);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  // Every word must appear in name, brand or category.
  const products = catalog.filter((p) => {
    const hay = `${p.name} ${p.brand} ${p.category.replace("_", " ")}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  return <pages.Search query={query} products={products} {...await shopperFrom(searchParams)} />;
}
