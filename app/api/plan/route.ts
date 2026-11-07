// Runs the Director for a visit: it plans how the shopper's NEXT pages open. Nothing on screen changes now.
// `leaving`: a page is about to be left (a ghost walking on); the agent gets one last look even inside its pause.
import { z } from "zod";
import { runDirector } from "@/babel/agents/director";
import { recordGaps } from "@/babel/session/gaps";
import { canLook, clock, getVisit, type Trigger } from "@/babel/session";
import { bad, storeConfig } from "../_store";

const Body = z.object({ visitId: z.string().max(64), leaving: z.boolean().optional() });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return bad(body.error.message);
  const v = getVisit(body.data.visitId);
  if (!v) return bad("unknown visit", 404);
  const cfg = storeConfig(v.store)!;
  const at = clock(v);
  const gate = canLook(v, at, !!body.data.leaving);
  if (!gate.ok) return Response.json({ decision: "none", reason: gate.why });
  const pending = v.trace.filter((t) => t.kind === "trigger").at(-1)?.triggers ?? [];
  const triggers: Trigger[] = body.data.leaving ? ["page_leave"] : pending.length ? pending : ["checkin"];
  v.directorBusy = true;
  v.directorRuns += 1;
  v.lastDirectorAt = at;
  v.eventsAtLastLook = v.events.length;
  try {
    const o = await runDirector(v, cfg, triggers);
    recordGaps(v.store, o.gaps, o.mocked);
    const common = { at: clock(v), triggers, errors: o.errors, rounds: o.rounds, ms: o.ms, mocked: o.mocked, llm: o.llm };
    if (o.decision === "plan" && o.plan) {
      const previews = Object.entries(v.plan?.previews ?? {}).map(([t, view]) => `${t}: ${view!.persona.dialect} × ${view!.persona.need}`);
      v.trace.push({ ...common, kind: "plan", hypothesis: o.plan.hypothesis, diff: previews, text: `plan for the next pages: ${o.plan.rationale}` });
      return Response.json({ decision: "plan", rationale: o.plan.rationale, ms: o.ms });
    }
    v.trace.push({ ...common, kind: "hold", text: `hold: ${o.reason}` });
    return Response.json({ decision: "hold", reason: o.reason, ms: o.ms });
  } finally {
    v.directorBusy = false;
  }
}
