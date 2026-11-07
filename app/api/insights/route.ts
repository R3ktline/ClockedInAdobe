// Insights: POST {action:"analyze"} looks across all shoppers so far and applies what is convincing as the
// store's starting view; POST {action:"revert", id} takes a default back. The list is in /api/merchant.
import { z } from "zod";
import { analyzeAll } from "@/babel/agents/insights";
import { revertDefault } from "@/babel/session/defaults";
import { bad, storeConfig } from "../_store";

export const dynamic = "force-dynamic";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("analyze") }),
  z.object({ action: z.literal("revert"), id: z.string().max(32) }),
]);

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return bad(body.error.message);
  if (body.data.action === "revert") return Response.json({ reverted: revertDefault(body.data.id) });
  return Response.json({ results: await analyzeAll(storeConfig) });
}
