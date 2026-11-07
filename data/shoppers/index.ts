// The 10 synthetic demo shoppers (SPEC §3.4): a synthetic PartnerContext plus a scripted walk through Taraba.
// Ages stay in the human-written labels only; the engine never sees them (no age inference, ever).
import { z } from "zod";
import { Dialect, InteractionEvent, Need, PartnerContext } from "@/babel/schema";
import ana from "./ana.json";
import cristina from "./cristina.json";
import elena from "./elena.json";
import gheorghe from "./gheorghe.json";
import ioana from "./ioana.json";
import maria from "./maria.json";
import mihai from "./mihai.json";
import radu from "./radu.json";
import tudor from "./tudor.json";
import victor from "./victor.json";

const Walk = z.object({ path: z.string(), events: z.array(InteractionEvent) });
export const Shopper = z.object({
  id: z.string().regex(/^[a-z]+$/),
  label: z.string(),
  expectedPersona: z.object({ dialect: Dialect, need: Need }),
  startPath: z.string(),
  partner: PartnerContext,
  events: z.array(InteractionEvent),
  pages: z.array(Walk).default([]),
  revisit: z.object({ startPath: z.string(), events: z.array(InteractionEvent), pages: z.array(Walk).default([]) }).optional(),
});
export type Shopper = z.infer<typeof Shopper>;

export const shoppers: Record<string, Shopper> = Object.fromEntries(
  [tudor, ana, mihai, elena, cristina, radu, ioana, victor, maria, gheorghe].map((s) => { const p = Shopper.parse(s); return [p.id, p]; }),
);

/** A first-time visitor who has not answered the consent question yet: standard store, nothing collected. */
export const anonymousPartner = (consent: boolean): PartnerContext => ({
  consent: { personalization: consent, partnerData: false },
  visitor: { returning: false, visits: 1 },
});
