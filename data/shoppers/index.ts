// Synthetic shopper fixtures (SPEC §3.4). The other nine are added in Phase 2 (Track D).
import { InteractionEvent, PartnerContext } from "@/babel/schema";
import { z } from "zod";
import radu from "./radu.json";

const Shopper = z.object({
  id: z.string(),
  label: z.string(),
  startPath: z.string(),
  partner: PartnerContext,
  events: z.array(InteractionEvent),
});
export type Shopper = z.infer<typeof Shopper>;

// A first-time visitor who accepted personalization and shared nothing else.
export const anonymousPartner: PartnerContext = {
  consent: { personalization: true, partnerData: false },
  visitor: { returning: false, visits: 1 },
};

export const shoppers: Record<string, Shopper> = Object.fromEntries(
  [radu].map((s) => { const parsed = Shopper.parse(s); return [parsed.id, parsed]; }),
);
