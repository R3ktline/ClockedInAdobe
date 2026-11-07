// Insights: POST {action:"analyze"} looks across all shoppers so far and SUGGESTS what is convincing as the
// store's starting view; {action:"approve", id} makes a suggestion permanent; {action:"revert", id} takes a default back
// (or dismisses a suggestion). The list is in /api/merchant.
import { z } from "zod";
import { analyzeAll } from "@/babel/agents/insights";
import { approveDefault, revertDefault } from "@/babel/session/defaults";
import { bad, storeConfig } from "../_store";

export const dynamic = "force-dynamic";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("analyze") }),
  z.object({ action: z.literal("revert"), id: z.string().max(32) }),
  z.object({ action: z.literal("approve"), id: z.string().max(32) }),
]);

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return bad(body.error.message);
  if (body.data.action === "approve") return Response.json({ approved: approveDefault(body.data.id) });
  if (body.data.action === "revert") return Response.json({ reverted: revertDefault(body.data.id) });
  return Response.json({ results: await analyzeAll(storeConfig) });
}
