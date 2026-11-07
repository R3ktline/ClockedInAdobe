// The shopper read: David's signal model over the events so far (plus what earlier pages or visits taught it).
// This is the ONE source of the inferred persona. Markers trigger the Director; they do not pick personas.
import type { InteractionEvent, PartnerContext, Persona } from "@/babel/schema";
import { modelInputs } from "./modelInputs";
import { buildProfile, personaOf, type Groups } from "./signalModel";
import { CONFIDENCE_THRESHOLD, NEUTRAL } from "./view";

export * from "./view";
export { pickSkin, seeded, SKIN_NAMES } from "./skin";

/** `prior` = group sums from earlier pages of this visit (carry 1) or from a past visit (carry 0.6). */
export function readShopper(ctx: PartnerContext, events: InteractionEvent[] = [], prior?: Groups, carry = 1) {
  const { signals, context, declared } = modelInputs(events, ctx);
  const profile = buildProfile(signals, declared, context, prior, carry);
  const model = personaOf(profile);
  // Low confidence means less adaptation, never a guess (SPEC §3.5).
  const persona: Persona = !profile || model.confidence < CONFIDENCE_THRESHOLD
    ? { ...NEUTRAL, confidence: model.confidence }
    : { dialect: model.dialect, need: model.need, confidence: model.confidence };
  // Declared needs (accessibility settings) are not guesses: they hold even with little evidence.
  if (profile && model.dialectWhy === "accessibility setting") persona.dialect = "guided";
  return { profile, model, persona, signals };
}

export type ShopperRead = ReturnType<typeof readShopper>;
