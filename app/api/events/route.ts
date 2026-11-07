// Interaction signals in, markers out. Tells the client when a slide boundary is due.
import { z } from "zod";
import { InteractionEvent } from "@/babel/schema";
import { getVisit, recordEvents } from "@/babel/session";
import { bad } from "../_store";

const Body = z.object({ visitId: z.string(), events: z.array(InteractionEvent).max(200) });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return bad(body.error.message);
  const visit = getVisit(body.data.visitId);
  if (!visit) return bad("unknown visit", 404);
  const { trigger, restyle } = recordEvents(visit, body.data.events);
  return Response.json({ trigger, restyle: !!restyle, markers: visit.markers });
}
