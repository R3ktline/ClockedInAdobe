// Curtain mode: the client asks for the big change once /api/events said the profile is clear (restyle: true)
// and it is a safe moment. Rules build the slide from the signal model's read: no LLM, so the curtain always
// lifts on a finished page. The validator still has the last word.
import { z } from "zod";
import { validateSlide } from "@/babel/guardrails/validateSlide";
import { buildSlide } from "@/babel/persona";
import { addSlide, describeDiff, elapsed, getVisit } from "@/babel/session";
import { personaKey, restyleDecision } from "@/babel/session/calibration";
import { bad, storeConfig } from "../_store";

const Body = z.object({ visitId: z.string() });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return bad(body.error.message);
  const visit = getVisit(body.data.visitId);
  if (!visit) return bad("unknown visit", 404);
  const cfg = storeConfig(visit.store)!;

  const now = Math.max(elapsed(visit), ...visit.events.map((e) => e.t));
  const d = restyleDecision(visit, now);
  if (!d.ok) return Response.json({ decision: "none", reason: d.why });

  const prev = visit.slides.at(-1)!;
  const built = buildSlide({
    persona: d.persona, template: prev.template, registry: cfg.registry, brand: cfg.brand, ctx: visit.partner,
    copyRegister: visit.shopper!.model.copyRegister, skin: prev.skin,
    index: prev.index + 1, parentId: prev.id, kind: "major", trigger: "calibration", source: "rules",
  });
  const slide = { ...built, rationale: `Set up from how you have been browsing. ${built.rationale}`.slice(0, 240) };
  const check = validateSlide({ slide, prev, registry: cfg.registry, brand: cfg.brand, returning: visit.returning });
  if (!check.ok) {
    visit.trace.push({ at: elapsed(visit), kind: "skip", text: `calibration slide rejected: ${check.errors.join("; ")}` });
    return Response.json({ decision: "none", reason: "the calibration slide did not validate" });
  }

  addSlide(visit, check.slide);
  visit.restyles += 1;
  visit.lastRestyleAt = elapsed(visit);
  visit.lastRestyleKey = personaKey(d.persona);
  visit.trace.push({
    at: elapsed(visit), kind: "slide", diff: describeDiff(prev, check.slide), mocked: false,
    text: `slide ${check.slide.index} (calibration, big change ${visit.restyles}): ${personaKey(d.persona)} · ${d.reasons.join(" · ")}`,
  });
  return Response.json({ decision: "slide", slide: check.slide, reasons: d.reasons });
}
