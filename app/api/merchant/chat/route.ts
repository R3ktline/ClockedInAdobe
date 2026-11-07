// Merchant chat: POST {text, visitId} → one turn of the agent, which may apply or revert a store default.
// The transcript lives client-side; applied/reverted effects show up in /api/merchant (and in /api/insights).
import { z } from "zod";
import { merchantChat } from "@/babel/agents/merchant-chat";
import { listVisits } from "@/babel/session";
import { bad, storeConfig } from "../../_store";

export const dynamic = "force-dynamic";

const Body = z.object({ text: z.string().trim().min(2).max(500), visitId: z.string().max(64).optional() });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return bad(body.error.message);
  const visits = listVisits();
  const chosen = body.data.visitId ? visits.find((v) => v.id === body.data.visitId) : visits[0];
  if (!chosen) return bad("no shopper session yet");
  return Response.json(await merchantChat({ text: body.data.text, visitId: chosen.id, visits, cfg: storeConfig(chosen.store) }));
}
