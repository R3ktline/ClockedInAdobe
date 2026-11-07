import { notFound } from "next/navigation";
import { productById } from "@/data/catalog";
import { storePages } from "@/stores/pages";
import { shopperFrom, type PageProps } from "../../_shopper";

export default async function StoreProduct({ params, searchParams }: PageProps<{ store: string; id: string }>) {
  const { store, id } = await params;
  const pages = storePages[store as keyof typeof storePages];
  const product = productById(id);
  if (!pages || !product) notFound();
  return <pages.Product product={product} {...await shopperFrom(searchParams)} />;
}
