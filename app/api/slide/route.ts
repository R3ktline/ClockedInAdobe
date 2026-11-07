// Runs the Director for a visit with pending triggers. The client calls this once the shopper pauses.
import { z } from "zod";
import { runDirector } from "@/babel/agents/director";
import { addSlide, describeDiff, elapsed, getVisit } from "@/babel/session";
import { bad, storeConfig } from "../_store";

const Body = z.object({ visitId: z.string() });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return bad(body.error.message);
  const visit = getVisit(body.data.visitId);
  if (!visit) return bad("unknown visit", 404);
  if (!visit.pendingTriggers.length || visit.directorBusy || visit.standardView) {
    return Response.json({ decision: "none" });
  }
  const cfg = storeConfig(visit.store)!;

  visit.directorBusy = true;
  const triggers = visit.pendingTriggers;
  visit.pendingTriggers = [];
  try {
    const prev = visit.slides.at(-1)!;
    const o = await runDirector(visit, cfg.registry, cfg.brand);
    const common = { at: elapsed(visit), triggers, errors: o.errors, clamps: o.clamps, rounds: o.rounds, ms: o.ms, mocked: o.mocked };
    if (o.decision === "slide" && o.slide) {
      addSlide(visit, o.slide);
      visit.trace.push({
        ...common, kind: "slide", hypothesis: o.slide.hypothesis, diff: describeDiff(prev, o.slide),
        text: `slide ${o.slide.index} (${o.slide.kind}): ${o.slide.rationale}`,
      });
      return Response.json({ decision: "slide", slide: o.slide });
    }
    visit.trace.push({ ...common, kind: "hold", text: `hold: ${o.reason}` });
    return Response.json({ decision: "hold", reason: o.reason });
  } finally {
    visit.directorBusy = false;
  }
}
