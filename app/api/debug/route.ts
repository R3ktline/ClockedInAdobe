// Debug feed for one visit: markers, the shopper model, what the Director was sent and what it answered.
// Only in development, or with BABEL_DEBUG=1; it exposes raw behaviour data.
import { staticContext } from "@/babel/agents/director";
import { isMocked } from "@/babel/llm";
import { elapsed, getVisit, memoryOf, shopperSummary } from "@/babel/session";
import { z } from "zod";
import { bad, storeConfig } from "../_store";

export const dynamic = "force-dynamic";

const enabled = () => process.env.NODE_ENV !== "production" || process.env.BABEL_DEBUG === "1";

export async function GET(req: Request) {
  if (!enabled()) return bad("debug is off", 404);
  const v = getVisit(new URL(req.url).searchParams.get("visitId") ?? "");
  if (!v) return bad("unknown visit", 404);
  const cfg = storeConfig(v.store)!;
  const slide = v.slides.at(-1)!;
  return Response.json({
    id: v.id,
    store: v.store,
    template: v.template,
    productId: v.productId,
    ageMs: elapsed(v),
    returning: v.returning,
    standardView: v.standardView,
    consent: v.partner.consent.personalization,
    busy: v.directorBusy,
    pendingTriggers: v.pendingTriggers,
    minorCount: v.minorCount,
    zoom: v.zoom,
    llm: { mocked: isMocked(), model: isMocked() ? "mock" : process.env.DEEPSEEK_MODEL ?? "" },
    markers: v.markers,
    shopper: shopperSummary(v),
    memory: memoryOf(v.visitorId),
    eventCounts: v.events.reduce<Record<string, number>>((c, e) => ({ ...c, [e.type]: (c[e.type] ?? 0) + 1 }), {}),
    recentEvents: v.events.slice(-12),
    slide: { index: slide.index, source: slide.source, persona: slide.persona, theme: slide.theme, copyRegister: slide.copyRegister, blocks: slide.blocks.map(({ id, variant, order, collapsed }) => ({ id, variant, order, collapsed })), rationale: slide.rationale },
    trace: v.trace.slice(-25).map(({ llm: _llm, ...t }) => t),
    // Every Director call so far (newest last): the observation it was sent, its replies and the validator's verdicts.
    calls: v.trace.filter((t) => t.llm).slice(-5).map((t) => ({ at: t.at, kind: t.kind, text: t.text, triggers: t.triggers, ms: t.ms, rounds: t.rounds, errors: t.errors, clamps: t.clamps, llm: t.llm })),
    context: staticContext(cfg.registry, cfg.brand, v.template),
  });
}

const Post = z.object({ visitId: z.string(), action: z.literal("look") });

// "Ask the AI now": queue a check-in the pacing rules would otherwise hold back.
export async function POST(req: Request) {
  if (!enabled()) return bad("debug is off", 404);
  const body = Post.safeParse(await req.json().catch(() => null));
  if (!body.success) return bad(body.error.message);
  const v = getVisit(body.data.visitId);
  if (!v) return bad("unknown visit", 404);
  if (!v.partner.consent.personalization || v.standardView) return bad("personalization is off for this visit", 409);
  if (!v.pendingTriggers.includes("checkin")) v.pendingTriggers.push("checkin");
  return Response.json({ queued: true });
}
