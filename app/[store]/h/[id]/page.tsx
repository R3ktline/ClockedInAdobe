// The hand-off page (SPEC §8): a shopping agent made a shortlist over A2A/MCP; the human opens it here and sees
// it in their own view, with the same catalog prices as everyone.
import { notFound } from "next/navigation";
import { getHandoff } from "@/babel/tools";
import { passes } from "@/babel/guardrails/policy";
import { checkGrounding } from "@/babel/guardrails/grounding";
import { catalog } from "@/data/catalog";
import { ListingPage } from "@/stores/taraba/lists";
import { open, type SearchParams } from "../../_open";

export default async function Page({ params, searchParams }: { params: Promise<{ store: string; id: string }>; searchParams: SearchParams }) {
  const { store, id } = await params;
  const h = getHandoff(id);
  if (!h || h.store !== store) notFound();
  const products = catalog.filter((p) => h.ids.includes(p.id));
  const initial = await open({ store, template: "category", path: `/${store}/h/${id}`, searchParams });
  // The agent's note is untrusted outside text: shown only if it passes the same policy as our own replies.
  const quoted = h.note && passes(h.note, "reply") && checkGrounding(h.note, products).length === 0 ? `: “${h.note.slice(0, 200)}”` : "";
  const note = `Chosen for you by a shopping agent${quoted}. Same prices as every shopper; nothing was negotiated.`;
  return <ListingPage initial={initial} title="Your shortlist" products={products} note={note} />;
}
