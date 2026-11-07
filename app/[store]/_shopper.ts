// Host glue: picks the partner context (and optional ghost replay) from ?ghost=<shopper>.
// ?step=<n> is the ghost's n-th page (0 = start page); after its events it walks on to page n+1.
import { anonymousPartner, shoppers } from "@/data/shoppers";

export async function shopperFrom(searchParams: Promise<Record<string, string | string[] | undefined>>) {
  const q = await searchParams;
  const s = typeof q.ghost === "string" ? shoppers[q.ghost] : undefined;
  if (!s) return { partner: anonymousPartner };
  // step=free: the ghost stays on (same shopper, same memory) but nothing is replayed, e.g. after a click-through.
  const free = q.step === "free";
  const step = free ? -1 : Math.max(0, Number(q.step) || 0);
  const pages = [{ path: s.startPath, events: s.events }, ...s.pages];
  const page = pages[Math.min(Math.max(step, 0), pages.length - 1)];
  const nextPage = free ? undefined : pages[step + 1];
  const keep = typeof q.apply === "string" ? `&apply=${encodeURIComponent(q.apply)}` : "";
  return {
    partner: s.partner,
    ghost: {
      label: s.id[0].toUpperCase() + s.id.slice(1),
      events: free ? [] : page.events,
      step,
      next: nextPage && `${nextPage.path}?ghost=${s.id}&step=${step + 1}${keep}`,
    },
  };
}

export type PageProps<P> = { params: Promise<P>; searchParams: Promise<Record<string, string | string[] | undefined>> };
