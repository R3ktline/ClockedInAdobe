import { notFound } from "next/navigation";
import { catalog } from "@/data/catalog";
import { storePages } from "@/stores/pages";
import { shopperFrom, type PageProps } from "./_shopper";

export default async function StoreHome({ params, searchParams }: PageProps<{ store: string }>) {
  const { store } = await params;
  const pages = storePages[store as keyof typeof storePages];
  if (!pages) notFound();
  return <pages.Home products={catalog} {...await shopperFrom(searchParams)} />;
}
