import { notFound } from "next/navigation";
import { catalog } from "@/data/catalog";
import { CartPage } from "@/stores/taraba/shop";
import { storeConfig } from "../../api/_store";

export default async function Page({ params }: { params: Promise<{ store: string }> }) {
  if (!storeConfig((await params).store)) notFound();
  return <CartPage products={catalog} />;
}
