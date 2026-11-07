// "Forget me": the server drops everything it kept about this visitor (profile, remembered views, choices).
import { z } from "zod";
import { forget, getVisit } from "@/babel/session";
import { bad } from "../_store";

const Body = z.object({ visitId: z.string().max(64) });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return bad(body.error.message);
  const v = getVisit(body.data.visitId);
  const id = v?.visitorId;
  return Response.json({ forgotten: id ? forget(id) : false });
}
