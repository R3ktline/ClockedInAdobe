// Starts a visit: rules pick the persona and slide 0 instantly (no LLM on first paint).
// A consented shopper's remembered view of this page type, if any, takes the place of the rules' slide 0.
import { z } from "zod";
import { validateSlide } from "@/babel/guardrails/validateSlide";
import { buildSlide, initialPersona, NEUTRAL_PERSONA } from "@/babel/persona";
import { PartnerContext, Template } from "@/babel/schema";
import { createVisit, forget, recall, recallSlide, startSession } from "@/babel/session";
import { activeDefaults, withDefaults } from "@/babel/session/defaults";
import { bad, storeConfig } from "../_store";

const Body = z.object({
  store: z.string(),
  template: Template,
  productId: z.string().max(64).optional(),
  partner: PartnerContext,
  visitorId: z.string().max(64).optional(), // random id the SDK keeps (consented); ghosts use "ghost:<name>"
  fresh: z.boolean().optional(),            // first page of a ghost run: start from a clean memory
});

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return bad(body.error.message);
  const { store, template, productId, visitorId, fresh } = body.data;
  const cfg = storeConfig(store);
  if (!cfg) return bad(`unknown store ${store}`, 404);

  if (visitorId && fresh) forget(visitorId);
  const consented = body.data.partner.consent.personalization ? visitorId : undefined;
  // The server knows better than the page whether this shopper has been here before; it can only add to the claim.
  const seen = consented ? startSession(consented) : undefined;
  const partner = seen
    ? { ...body.data.partner, visitor: { ...body.data.partner.visitor, returning: body.data.partner.visitor.returning || seen.returning, visits: Math.max(body.data.partner.visitor.visits, seen.visits) } }
    : body.data.partner;

  const { persona, reasons, copyRegister } = initialPersona(partner, recall(consented));
  const built = buildSlide({ persona, template, registry: cfg.registry, brand: cfg.brand, ctx: partner, copyRegister });
  const check = (slide: unknown) => validateSlide({ slide, registry: cfg.registry, brand: cfg.brand, returning: partner.visitor.returning });

  // What Insights learned from all shoppers is the starting view; if it no longer validates, the rules' slide stands.
  const learned = activeDefaults(store, template);
  const withLearned = learned.length ? check(withDefaults(built, learned)) : undefined;
  const fromRules = withLearned?.ok ? withLearned : check(built);

  const kept = recallSlide(consented, template);
  const restored = kept && check({ ...kept, id: `${template}-0-${Math.random().toString(36).slice(2, 8)}`, index: 0, parentId: undefined, kind: "initial", trigger: "page_load", source: "cache" });
  const checked = restored && restored.ok ? restored : fromRules;
  if (checked === withLearned) reasons.push(...learned.map((d) => `store default learned from all shoppers: ${d.rationale}`));
  const slide = checked.ok
    ? checked.slide
    : buildSlide({ persona: NEUTRAL_PERSONA, template, registry: cfg.registry, brand: cfg.brand });
  if (restored && restored.ok && checked === restored) reasons.unshift("restored the last view the agent chose for this page type");

  const visit = createVisit({ store, template, productId, partner, persona: slide.persona, slide, reasons, visitorId });
  return Response.json({ visitId: visit.id, slide });
}
