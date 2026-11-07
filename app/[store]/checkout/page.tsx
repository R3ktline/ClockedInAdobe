import { notFound } from "next/navigation";
import { catalog } from "@/data/catalog";
import { storePages } from "@/stores/pages";
import type { PageProps } from "../_shopper";

export default async function StoreCheckout({ params }: PageProps<{ store: string }>) {
  const { store } = await params;
  const pages = storePages[store as keyof typeof storePages];
  if (!pages) notFound();
  return <pages.Checkout products={catalog} />;
}
