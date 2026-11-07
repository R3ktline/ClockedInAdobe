import { catalog } from "@/data/catalog";
import { HomePage } from "@/stores/taraba/lists";
import { open, type SearchParams } from "./_open";

export default async function Page({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: SearchParams }) {
  const { store } = await params;
  const initial = await open({ store, template: "home", path: `/${store}`, searchParams });
  return <HomePage initial={initial} products={catalog} />;
}
