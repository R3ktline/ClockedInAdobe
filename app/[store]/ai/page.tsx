import { notFound } from "next/navigation";
import { fallbackPage } from "@/babel/agents/composer";
import { catalog } from "@/data/catalog";
import { localeFromRequest } from "@/lib/i18n/server";
import { storePages } from "@/stores/pages";
import type { PageProps } from "../_shopper";

// /<store>/ai?q=...: what the header search sends. The agent builds a new page for the request;
// the keyword fallback renders at once so first paint never waits on the model.
export default async function StoreComposed({ params, searchParams }: PageProps<{ store: string }>) {
  const { store } = await params;
  const pages = storePages[store as keyof typeof storePages];
  if (!pages) notFound();
  const raw = (await searchParams).q;
  const request = (typeof raw === "string" ? raw : "").trim().slice(0, 200);
  const { lang } = await localeFromRequest();
  return <pages.Composed request={request} initial={request.length >= 2 ? fallbackPage(request, lang) : undefined} products={catalog} />;
}
