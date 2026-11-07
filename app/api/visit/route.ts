// Starts a visit: rules pick the persona and slide 0 instantly (no LLM on first paint).
// A consented shopper's remembered view of this page type, if any, takes the place of the rules' slide 0.
import { z } from "zod";
import { validateSlide } from "@/babel/guardrails/validateSlide";
import { buildSlide, initialPersona, NEUTRAL_PERSONA } from "@/babel/persona";
import { TRAITS, type Groups } from "@/babel/persona/signalModel";
import { Dialect, Need, PartnerContext, Template } from "@/babel/schema";
import { createVisit, forget, recall, recallSlide, rememberGroups, startSession } from "@/babel/session";
import { activeDefaults, withDefaults } from "@/babel/session/defaults";
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
  const { store, template, productId, visitorId, fresh, memory, variant } = body.data;
  const cfg = storeConfig(store);
  if (!cfg) return bad(`unknown store ${store}`, 404);

  if (visitorId && fresh) forget(visitorId);
  const consented = body.data.partner.consent.personalization ? visitorId : undefined;
  // The server knows better than the page whether this shopper has been here before; it can only add to the claim.
  const seen = consented ? startSession(consented) : undefined;
  const partner = seen
    ? { ...body.data.partner, visitor: { ...body.data.partner.visitor, returning: body.data.partner.visitor.returning || seen.returning, visits: Math.max(body.data.partner.visitor.visits, seen.visits) } }
    : body.data.partner;

  // Lab return visit: the browser hands back what it kept; it replaces the server's memory, scaled down.
  const fromBrowser = !!(memory && consented && partner.visitor.returning);
  if (fromBrowser) {
    rememberGroups(consented!, Object.fromEntries(TRAITS.map((t) => [t, Object.fromEntries(
      Object.entries(memory![t] ?? {}).map(([g, v]) => [g, v * RETURN_CARRY]),
    )])) as Groups);
  }

  const model = initialPersona(partner, recall(consented));
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
  const check = (slide: unknown) => validateSlide({ slide, registry: cfg.registry, brand: cfg.brand, returning: partner.visitor.returning });

  // What Insights learned from all shoppers is the starting view; if it no longer validates, the rules' slide stands.
  // A forced lab variant is compared on its own format, so neither learned defaults nor a kept slide touch it.
  const learned = variant ? [] : activeDefaults(store, template);
  const withLearned = learned.length ? check(withDefaults(built, learned)) : undefined;
  const fromRules = withLearned?.ok ? withLearned : check(built);

  const kept = variant || fromBrowser ? undefined : recallSlide(consented, template);
  const restored = kept && check({ ...kept, id: `${template}-0-${Math.random().toString(36).slice(2, 8)}`, index: 0, parentId: undefined, kind: "initial", trigger: "page_load", source: "cache" });
  const checked = restored && restored.ok ? restored : fromRules;
  if (checked === withLearned) reasons.push(...learned.map((d) => `store default learned from all shoppers: ${d.rationale}`));
  const slide = checked.ok
    ? checked.slide
    : buildSlide({ persona: NEUTRAL_PERSONA, template, registry: cfg.registry, brand: cfg.brand });
  if (restored && restored.ok && checked === restored) reasons.unshift("restored the last view the agent chose for this page type");

  const visit = createVisit({ store, template, productId, partner, persona: slide.persona, slide, reasons, visitorId });
  // A forced variant is locked like an explicit choice (SPEC §3.5): indicators keep updating, but the
  // agent is not called, so variants are compared on the format alone.
  if (variant) {
    visit.standardView = true;
    visit.trace.push({ at: 0, kind: "visit", text: "lab variant: format locked, the agent will not change it" });
  }
  return Response.json({ visitId: visit.id, slide, reasons, fromMemory: fromBrowser || !!visit.prior });
}
