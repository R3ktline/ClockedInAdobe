// "Forget me": drops everything remembered about a visitor id (profile, last views, visit count).
import { z } from "zod";
import { forget } from "@/babel/session";
import { bad } from "../_store";

const Body = z.object({ visitorId: z.string().max(64) });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return bad(body.error.message);
  return Response.json({ forgotten: forget(body.data.visitorId) });
}
