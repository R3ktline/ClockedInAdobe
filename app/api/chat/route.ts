// The Concierge chat. Labelled as an AI in the UI. The text itself is never stored as a signal.
import { z } from "zod";
import { runConcierge } from "@/babel/agents/concierge";
import { getVisit } from "@/babel/session";
import { clientKey, rateLimited } from "@/babel/tools";
import { bad, storeConfig } from "../_store";

const Body = z.object({ visitId: z.string().max(64), pageId: z.string().max(64), message: z.string().max(1000) });

export async function POST(req: Request) {
  if (rateLimited(`chat:${clientKey(req)}`, 30)) return bad("Too many messages. Please wait a minute.", 429);
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return bad(body.error.message);
  const v = getVisit(body.data.visitId);
  if (!v) return bad("unknown visit", 404);
  const r = await runConcierge(v, storeConfig(v.store)!, body.data.pageId, body.data.message);
  return Response.json({ reply: r.reply, view: r.view, why: r.why, changes: r.changes, refused: r.refused, replaced: r.replaced, mocked: r.mocked });
}
