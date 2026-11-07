// Interaction signals in. Markers and the shopper read update; the reply says whether the agent should look.
import { z } from "zod";
import { InteractionEvent } from "@/babel/schema";
import { getVisit, recordEvents } from "@/babel/session";
import { bad } from "../_store";

const Body = z.object({ visitId: z.string().max(64), pageId: z.string().max(64), events: z.array(InteractionEvent).max(200) });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return bad(body.error.message);
  const v = getVisit(body.data.visitId);
  if (!v) return bad("unknown visit", 404);
  const { look } = recordEvents(v, body.data.pageId, body.data.events);
  return Response.json({ look });
}
