// Runs the Director for a visit with pending triggers. The client calls this once the shopper pauses.
import { z } from "zod";
import { runDirector } from "@/babel/agents/director";
import { addSlide, describeDiff, elapsed, getVisit } from "@/babel/session";
import { recordGaps } from "@/babel/session/gaps";
import { bad, storeConfig } from "../_store";

// `message` is what the shopper typed in the chatbox: it is asked for now, whatever the pacing says.
const Body = z.object({ visitId: z.string(), message: z.string().trim().min(1).max(200).optional() });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return bad(body.error.message);
  const visit = getVisit(body.data.visitId);
  if (!visit) return bad("unknown visit", 404);
  const message = body.data.message;
  if (message && visit.standardView) return Response.json({ decision: "none", reason: "The standard view is on. Switch to the personalized view to change the page." });
  if (visit.directorBusy) return Response.json({ decision: "none", reason: message ? "Still working on the last change. Try again in a moment." : undefined });
  if (!message && (!visit.pendingTriggers.length || visit.standardView)) {
    return Response.json({ decision: "none" });
  }
  const cfg = storeConfig(visit.store)!;

  visit.directorBusy = true;
  const triggers = [...new Set([...visit.pendingTriggers, ...(message ? ["chat" as const] : [])])];
  visit.pendingTriggers = [];
  try {
    const prev = visit.slides.at(-1)!;
    const o = await runDirector(visit, cfg.registry, cfg.brand, triggers, message);
    recordGaps(visit.store, prev.template, o.gaps, o.mocked);
    const common = { at: elapsed(visit), triggers, errors: o.errors, clamps: o.clamps, rounds: o.rounds, ms: o.ms, mocked: o.mocked, llm: o.transcript };
    if (o.decision === "slide" && o.slide) {
      addSlide(visit, o.slide);
      visit.trace.push({
        ...common, kind: "slide", hypothesis: o.slide.hypothesis, diff: describeDiff(prev, o.slide),
        text: `slide ${o.slide.index} (${o.slide.kind}${message ? ", asked in chat" : ""}): ${o.slide.rationale}`,
      });
      return Response.json({ decision: "slide", slide: o.slide, llm: o.transcript, urgent: triggers.includes("zoom") || triggers.includes("chat") });
    }
    visit.trace.push({ ...common, kind: "hold", text: `hold: ${o.reason}` });
    return Response.json({ decision: "hold", reason: o.reason, llm: o.transcript });
  } finally {
    visit.directorBusy = false;
  }
}
