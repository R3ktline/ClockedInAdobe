import { notFound } from "next/navigation";
import { Category } from "@/babel/schema";
import { catalog } from "@/data/catalog";
import { ListingPage } from "@/stores/taraba/lists";
import { CATEGORY_LABEL } from "@/stores/taraba/ui";
import { open, type SearchParams } from "../../_open";

export default async function Page({ params, searchParams }: { params: Promise<{ store: string; category: string }>; searchParams: SearchParams }) {
  const { store, category } = await params;
  const c = Category.safeParse(category);
  if (!c.success) notFound();
  const initial = await open({ store, template: "category", path: `/${store}/c/${c.data}`, searchParams });
  return <ListingPage initial={initial} title={CATEGORY_LABEL[c.data]} products={catalog.filter((p) => p.category === c.data)} />;
}
