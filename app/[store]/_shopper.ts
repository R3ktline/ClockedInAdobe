// Host glue: picks the partner context (and optional ghost replay) from ?ghost=<shopper>.
// ?step=<n> is the ghost's n-th page (0 = start page); after its events it walks on to page n+1.
// Lab extras: ?lab=1 shows the indicators panel; ?visit=2 replays the shopper's return visit,
// days later, starting from what the browser remembered; ?variant=<dialect>.<need> forces a format.
import type { Dialect, Need } from "@/babel/schema";
import { anonymousPartner, shoppers } from "@/data/shoppers";
import { simShoppers } from "../api/_sim";

export async function shopperFrom(searchParams: Promise<Record<string, string | string[] | undefined>>) {
  const q = await searchParams;
  const s = typeof q.ghost === "string" ? simShoppers.get(q.ghost) ?? shoppers[q.ghost] : undefined;
  if (!s) return { partner: anonymousPartner };
  const simulated = simShoppers.has(s.id); // /sim setups already say whether the visitor is returning
  const lab = q.lab === "1";
  const visit = q.visit === "2" && s.revisit ? 2 : 1;
  const [vd, vn] = typeof q.variant === "string" ? q.variant.split(".") : [];
  const variant = vd && vn ? { dialect: vd as Dialect, need: vn as Need } : undefined;
  // step=free: the ghost stays on (same shopper, same memory) but nothing is replayed, e.g. after a click-through.
  const free = q.step === "free";
  const step = free ? -1 : Math.max(0, Number(q.step) || 0);
  const script = visit === 2 ? s.revisit! : { startPath: s.startPath, events: s.events, pages: s.pages };
  const pages = [{ path: script.startPath, events: script.events }, ...script.pages];
  const page = pages[Math.min(Math.max(step, 0), pages.length - 1)];
  const nextPage = free ? undefined : pages[step + 1];
  const keep = [
    typeof q.apply === "string" ? `&apply=${encodeURIComponent(q.apply)}` : "",
    lab ? "&lab=1" : "",
    visit === 2 ? "&visit=2" : "",
    typeof q.variant === "string" ? `&variant=${encodeURIComponent(q.variant)}` : "",
  ].join("");
  const partner = visit === 2 && !simulated
    ? { ...s.partner, visitor: { returning: true, visits: s.partner.visitor.visits + 1 } }
    : s.partner;
  return {
    partner,
    ghost: {
      label: s.id[0].toUpperCase() + s.id.slice(1),
      events: free ? [] : page.events,
      step,
      next: nextPage && `${nextPage.path}?ghost=${s.id}&step=${step + 1}${keep}`,
      lab, visit, variant,
      last: !nextPage && !free, // the last scripted page of this visit: the lab offers "close the site"
    },
  };
}

export type PageProps<P> = { params: Promise<P>; searchParams: Promise<Record<string, string | string[] | undefined>> };
