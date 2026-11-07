// What the shopper asks for on the open page: Standard view on/off, undo, a view switch or a style. These change
// the page at once because the shopper asked. Everything still goes through the validator.
import { z } from "zod";
import { ExplicitChange } from "@/babel/schema";
import { changeOpenPage, getVisit } from "@/babel/session";
import { bad, storeConfig } from "../_store";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("explicit"), visitId: z.string().max(64), pageId: z.string().max(64), change: ExplicitChange, via: z.enum(["view_switch", "style"]) }),
  z.object({ action: z.literal("standard"), visitId: z.string().max(64), pageId: z.string().max(64), on: z.boolean() }),
  z.object({ action: z.literal("undo"), visitId: z.string().max(64), pageId: z.string().max(64) }),
]);

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return bad(body.error.message);
  const v = getVisit(body.data.visitId);
  if (!v) return bad("unknown visit", 404);
  if (!v.partner.consent.personalization) return bad("Babel is off for this visit", 409);
  const r = changeOpenPage(v, body.data.pageId, storeConfig(v.store)!, body.data);
  return r.ok ? Response.json(r) : Response.json({ ok: false, error: r.error }, { status: 422 });
}
