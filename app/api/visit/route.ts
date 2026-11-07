// Starts a visit: rules pick the persona and slide 0 instantly (no LLM on first paint).
import { z } from "zod";
import { validateSlide } from "@/babel/guardrails/validateSlide";
import { buildSlide, initialPersona, NEUTRAL_PERSONA } from "@/babel/persona";
import { PartnerContext, Template } from "@/babel/schema";
import { createVisit, forget, recall } from "@/babel/session";
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
  const { store, template, productId, partner, visitorId, fresh } = body.data;
  const cfg = storeConfig(store);
  if (!cfg) return bad(`unknown store ${store}`, 404);

  if (visitorId && fresh) forget(visitorId);
  const { persona, reasons, copyRegister } = initialPersona(partner, partner.consent.personalization ? recall(visitorId) : undefined);
  const built = buildSlide({ persona, template, registry: cfg.registry, brand: cfg.brand, ctx: partner, copyRegister });
  const checked = validateSlide({ slide: built, registry: cfg.registry, brand: cfg.brand, returning: partner.visitor.returning });
  const slide = checked.ok
    ? checked.slide
    : buildSlide({ persona: NEUTRAL_PERSONA, template, registry: cfg.registry, brand: cfg.brand });

  const visit = createVisit({ store, template, productId, partner, persona: slide.persona, slide, reasons, visitorId });
  return Response.json({ visitId: visit.id, slide });
}
