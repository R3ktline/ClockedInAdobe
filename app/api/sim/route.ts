// Registers a simulator setup (what /sim edits) so the store can replay it as a ghost.
import { z } from "zod";
import { InteractionEvent, PartnerContext } from "@/babel/schema";
import { registerSim } from "../_sim";
import { bad } from "../_store";

const Body = z.object({
  path: z.string().regex(/^\/[a-z0-9/_-]*$/i).max(80), // a store page, e.g. /taraba/p/home-sofa-01
  partner: PartnerContext,
  events: z.array(InteractionEvent).max(80),
});

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return bad(body.error.message);
  const s = registerSim(body.data.path, body.data.partner, body.data.events);
  return Response.json({ id: s.id });
}
