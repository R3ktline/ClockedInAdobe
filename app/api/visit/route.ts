// Starts a visit: rules pick the persona and slide 0 instantly (no LLM on first paint).
import { z } from "zod";
import { validateSlide } from "@/babel/guardrails/validateSlide";
import { buildSlide, initialPersona, NEUTRAL_PERSONA } from "@/babel/persona";
import { TRAITS, type Groups } from "@/babel/persona/signalModel";
import { Dialect, Need, PartnerContext, Template } from "@/babel/schema";
import { createVisit, forget, recall, remember } from "@/babel/session";
import { bad, storeConfig } from "../_store";

// How much last visit's behaviour still counts on a return visit (signal-model spec §3: new behaviour wins).
const RETURN_CARRY = 0.6;

const Body = z.object({
  store: z.string(),
  template: Template,
  productId: z.string().max(64).optional(),
  partner: PartnerContext,
  visitorId: z.string().max(64).optional(), // random id the SDK keeps (consented); ghosts use "ghost:<name>"
  fresh: z.boolean().optional(),            // first page of a ghost run: start from a clean memory
  // Return visit: the group sums the browser kept from last time (consented localStorage, no raw events).
  memory: z.record(z.string(), z.record(z.string(), z.number())).optional(),
  // Lab only: force a page format to compare variants side by side. Logged as such, never a guess.
  variant: z.object({ dialect: Dialect, need: Need }).optional(),
});

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return bad(body.error.message);
  const { store, template, productId, partner, visitorId, fresh, memory, variant } = body.data;
  const cfg = storeConfig(store);
  if (!cfg) return bad(`unknown store ${store}`, 404);

  if (visitorId && fresh) forget(visitorId);
  const fromBrowser = !!(memory && visitorId && partner.consent.personalization && partner.visitor.returning);
  if (fromBrowser) {
    const scaled = Object.fromEntries(TRAITS.map((t) => [t, Object.fromEntries(
      Object.entries(memory![t] ?? {}).map(([g, v]) => [g, v * RETURN_CARRY]),
    )])) as Groups;
    remember(visitorId!, scaled);
  }

  const model = initialPersona(partner, partner.consent.personalization ? recall(visitorId) : undefined);
  const persona = variant ? { ...variant, confidence: 1 } : model.persona;
  const reasons = variant
    ? [`lab variant forced: ${variant.dialect} × ${variant.need}`, `the model alone would pick ${model.persona.dialect} × ${model.persona.need}`]
    : model.reasons;
  const built = buildSlide({
    persona, template, registry: cfg.registry, brand: cfg.brand, ctx: partner, copyRegister: model.copyRegister,
    // A return visit opens with a major slide: the page is rebuilt from what was remembered (SPEC §4.2).
    ...(fromBrowser ? { kind: "major" as const, trigger: "revisit" as const } : {}),
    ...(variant ? { source: "explicit" as const } : {}),
  });
  const checked = validateSlide({ slide: built, registry: cfg.registry, brand: cfg.brand, returning: partner.visitor.returning });
  const slide = checked.ok
    ? checked.slide
    : buildSlide({ persona: NEUTRAL_PERSONA, template, registry: cfg.registry, brand: cfg.brand });

  const visit = createVisit({ store, template, productId, partner, persona: slide.persona, slide, reasons, visitorId });
  // A forced variant is locked like an explicit choice (SPEC §3.5): indicators keep updating, but the
  // agent is not called, so variants are compared on the format alone.
  if (variant) {
    visit.standardView = true;
    visit.trace.push({ at: 0, kind: "visit", text: "lab variant: format locked, the agent will not change it" });
  }
  return Response.json({ visitId: visit.id, slide, reasons, fromMemory: fromBrowser || !!visit.prior });
}
