import { notFound } from "next/navigation";
import { Category } from "@/babel/schema";
import { catalog } from "@/data/catalog";
import { storePages } from "@/stores/pages";
import { shopperFrom, type PageProps } from "../../_shopper";

export default async function StoreCategory({ params, searchParams }: PageProps<{ store: string; category: string }>) {
  const { store, category } = await params;
  const pages = storePages[store as keyof typeof storePages];
  const cat = Category.safeParse(category);
  if (!pages || !cat.success) notFound();
  const products = catalog.filter((p) => p.category === cat.data);
  return <pages.Category category={cat.data} products={products} {...await shopperFrom(searchParams)} />;
}
