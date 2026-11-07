// Host glue: picks the partner context (and optional ghost replay) from ?ghost=<shopper>.
import { anonymousPartner, shoppers } from "@/data/shoppers";

export async function shopperFrom(searchParams: Promise<Record<string, string | string[] | undefined>>) {
  const ghost = (await searchParams).ghost;
  const s = typeof ghost === "string" ? shoppers[ghost] : undefined;
  return s
    ? { partner: s.partner, ghost: { label: s.id[0].toUpperCase() + s.id.slice(1), events: s.events } }
    : { partner: anonymousPartner };
}

export type PageProps<P> = { params: Promise<P>; searchParams: Promise<Record<string, string | string[] | undefined>> };
