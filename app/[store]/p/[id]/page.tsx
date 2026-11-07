import { notFound } from "next/navigation";
import { catalog, productById } from "@/data/catalog";
import { ProductPage } from "@/stores/taraba/product";
import { open, type SearchParams } from "../../_open";

export default async function Page({ params, searchParams }: { params: Promise<{ store: string; id: string }>; searchParams: SearchParams }) {
  const { store, id } = await params;
  const product = productById(id);
  if (!product) notFound();
  const initial = await open({ store, template: "product", productId: id, path: `/${store}/p/${id}`, searchParams });
  return <ProductPage initial={initial} product={product} all={catalog} />;
}
