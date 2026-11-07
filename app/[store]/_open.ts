// Host glue for the store pages: works out who is visiting (consented cookie, or a demo ghost from ?ghost=) and
// asks Babel for this page's view on the server, so the first paint is already the adapted page. No LLM here.
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Template } from "@/babel/schema";
import type { GhostScript, Initial } from "@/babel/sdk";
import { ageVisitor, forget, openPage } from "@/babel/session";
import { isMocked, modelName } from "@/babel/llm";
import { anonymousPartner, shoppers } from "@/data/shoppers";
import { storeConfig } from "../api/_store";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function open(a: { store: string; template: Template; productId?: string; path: string; searchParams: SearchParams }): Promise<Initial> {
  const cfg = storeConfig(a.store);
  if (!cfg) notFound();
  const q = await a.searchParams;
  const s = typeof q.ghost === "string" ? shoppers[q.ghost] : undefined;
  let consent: Initial["consent"], partner, visitorId: string | undefined, ghost: GhostScript | undefined;
  if (s) {
    const step = Math.max(0, Number(q.step) || 0);
    const visit = q.visit === "2" ? 2 : 1;
    visitorId = `ghost:${s.id}`;
    if (step === 0 && visit === 1) forget(visitorId);  // a new run starts from a clean memory
    if (step === 0 && visit === 2) ageVisitor(visitorId); // "days later": the next page starts a return visit
    const script = visit === 2
      ? s.revisit ?? { startPath: s.startPath, events: [{ t: 0, type: "page_view" as const }], pages: [] }
      : { startPath: s.startPath, events: s.events, pages: s.pages };
    const walk = [{ path: script.startPath, events: script.events }, ...script.pages];
    const here = walk[step];
    const next = walk[step + 1];
    ghost = {
      id: s.id, label: s.id[0].toUpperCase() + s.id.slice(1), events: here?.events ?? [], step, visit,
      next: next && `${next.path}${next.path.includes("?") ? "&" : "?"}ghost=${s.id}&step=${step + 1}&visit=${visit}`,
    };
    partner = visit === 2 ? { ...s.partner, visitor: { returning: true, visits: s.partner.visitor.visits + 1 } } : s.partner;
    consent = "ghost";
  } else {
    const jar = await cookies();
    const said = jar.get("babel_consent")?.value;
    const vid = jar.get("babel_vid")?.value;
    consent = said === "yes" && vid ? "yes" : said === "no" ? "no" : "unset";
    partner = anonymousPartner(consent === "yes");
    visitorId = consent === "yes" && vid && /^[0-9a-f-]{36}$/.test(vid) ? vid : undefined;
  }
  const opened = openPage({ store: a.store, cfg, template: a.template, productId: a.productId, path: a.path, partner, visitorId, ghost: s?.id });
  return { ...opened, store: a.store, template: a.template, productId: a.productId, consent, ghost, llm: { mocked: isMocked(), model: modelName() } };
}
