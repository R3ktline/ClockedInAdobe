// Builds a whole new page for a typed request (the Composer agent). The store page calls this after its
// instant fallback is on screen, so first paint never waits on the model (rule 4).
import { z } from "zod";
import { composePage } from "@/babel/agents/composer";
import { clientKey, rateLimited } from "@/babel/tools";
import { LANG_CODES, type Lang } from "@/lib/i18n/locales";
import { bad, storeConfig } from "../_store";

export const dynamic = "force-dynamic";

const Body = z.object({ store: z.string(), request: z.string().trim().min(2).max(200), lang: z.enum(LANG_CODES as [Lang, ...Lang[]]).optional() });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return bad(body.error.message);
  const cfg = storeConfig(body.data.store);
  if (!cfg) return bad(`unknown store ${body.data.store}`, 404);
  if (rateLimited(`compose:${clientKey(req)}`, 20)) return bad("too many pages requested, try again in a minute", 429);
  return Response.json(await composePage(body.data.request, cfg.brand, body.data.lang));
}
