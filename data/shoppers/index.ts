// Synthetic shopper fixtures (SPEC §3.4). More are added in Phase 2 (Track D).
import { Dialect, InteractionEvent, Need, PartnerContext } from "@/babel/schema";
import { z } from "zod";
import radu from "./radu.json";
import gheorghe from "./gheorghe.json";
import mihai from "./mihai.json";
import tudor from "./tudor.json";

const Shopper = z.object({
  id: z.string(),
  label: z.string(),
  expectedPersona: z.object({ dialect: Dialect, need: Need }).optional(), // what the signal model should read from the events
  startPath: z.string(),
  partner: PartnerContext,
  events: z.array(InteractionEvent),
  // Pages the ghost walks on to after the first; each starts its own visit, with the memory of the ones before.
  pages: z.array(z.object({ path: z.string(), events: z.array(InteractionEvent) })).default([]),
});
export type Shopper = z.infer<typeof Shopper>;

// A first-time visitor who accepted personalization and shared nothing else.
export const anonymousPartner: PartnerContext = {
  consent: { personalization: true, partnerData: false },
  visitor: { returning: false, visits: 1 },
};

export const shoppers: Record<string, Shopper> = Object.fromEntries(
  [radu, gheorghe, mihai, tudor].map((s) => { const parsed = Shopper.parse(s); return [parsed.id, parsed]; }),
);
