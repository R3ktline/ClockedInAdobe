// Demo simulator logic (pure): turns an editable setup into the same inputs the real page gets, and
// runs them through the same code as the server (modelInputs → signal model → buildSlide).
// It shows slide 0 and the model's read. The agent's later slides, learned defaults and the
// validator are not run here; open the store from /sim to see those.
import { buildSlide, NEUTRAL_PERSONA } from "@/babel/persona";
import { modelInputs } from "@/babel/persona/modelInputs";
import { accumulate, buildProfile, personaOf, type Groups } from "@/babel/persona/signalModel";
import type { BrandKit, Category, InteractionEvent, PartnerContext, Registry, Slide, Template } from "@/babel/schema";

// Same weight the server gives last visit's memory (app/api/visit RETURN_CARRY).
export const RETURN_CARRY = 0.6;

export type Setup = {
  personalization: boolean; partnerData: boolean;
  returning: boolean; visits: number;
  utm: string; intent: string;                       // "" = not set
  orders: Category[]; largeText: boolean; highContrast: boolean; reducedMotion: boolean;
  ageBand: string;                                   // "" = not shared; only ever partner-declared
  path: string;                                      // store page the shopper lands on
  events: InteractionEvent[];                        // what they do in this visit
  memoryEvents: InteractionEvent[];                  // what they did last time (becomes the remembered group sums)
  variant: string;                                   // "" = let the model decide, else "dialect.need" (forced, agent locked)
};

export const BLANK: Setup = {
  personalization: true, partnerData: false, returning: false, visits: 1, utm: "", intent: "",
  orders: [], largeText: false, highContrast: false, reducedMotion: false, ageBand: "",
  path: "/taraba", events: [], memoryEvents: [], variant: "",
};

export const templateOf = (path: string): Template => (path.includes("/p/") ? "product" : path.includes("/c/") ? "category" : "home");

export function partnerOf(s: Setup): PartnerContext {
  // Account data reaches Babel only when the store shares it with consent; without it, none of it is sent.
  const account = s.partnerData && (s.orders.length || s.largeText || s.highContrast || s.reducedMotion || s.ageBand)
    ? {
      ...(s.orders.length ? { orderCategories: s.orders } : {}),
      ...(s.largeText || s.highContrast || s.reducedMotion ? { accessibility: { largeText: s.largeText, highContrast: s.highContrast, reducedMotion: s.reducedMotion } } : {}),
      ...(s.ageBand ? { ageBand: s.ageBand as NonNullable<PartnerContext["account"]>["ageBand"] } : {}),
    }
    : undefined;
  return {
    consent: { personalization: s.personalization, partnerData: s.partnerData },
    visitor: { returning: s.returning, visits: s.returning ? Math.max(2, s.visits) : 1 },
    ...(account ? { account } : {}),
    ...(s.utm || s.intent
      ? { campaign: { ...(s.utm ? { utmSource: s.utm } : {}), ...(s.intent ? { intentTag: s.intent as NonNullable<PartnerContext["campaign"]>["intentTag"] } : {}) } }
      : {}),
  };
}

/** What the browser would hand back on a return visit: the group sums of the earlier behaviour (unscaled). */
export function memoryOf(s: Setup): Groups | undefined {
  if (!s.returning || !s.personalization || !s.memoryEvents.length) return undefined;
  const earlier = { ...partnerOf(s), visitor: { returning: false, visits: 1 } };
  return accumulate(modelInputs(s.memoryEvents, earlier).signals);
}

/** The model's read after the first `k` events of this visit (all of them when k is omitted). */
export function readAfter(s: Setup, k = s.events.length) {
  const partner = partnerOf(s);
  const { signals, context, declared } = modelInputs(s.events.slice(0, k), partner);
  const profile = buildProfile(signals, declared, context, memoryOf(s), RETURN_CARRY);
  return { partner, signals, profile, model: personaOf(profile) };
}

/** The page the rules would build for that read, plus the store's normal page to compare against. */
export function pageAfter(s: Setup, cfg: { brand: BrandKit; registry: Registry }, k = s.events.length): { slide: Slide; normal: Slide } {
  const { partner, model } = readAfter(s, k);
  const [fd, fn] = s.variant.split(".");
  const persona = fd && fn ? { dialect: fd as Slide["persona"]["dialect"], need: fn as Slide["persona"]["need"], confidence: 1 }
    : { dialect: model.dialect, need: model.need, confidence: model.confidence };
  const template = templateOf(s.path);
  const common = { template, registry: cfg.registry, brand: cfg.brand, ctx: partner };
  return {
    slide: buildSlide({ ...common, persona, copyRegister: model.copyRegister }),
    normal: buildSlide({ ...common, persona: NEUTRAL_PERSONA }),
  };
}
