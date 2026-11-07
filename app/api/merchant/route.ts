// Merchant panel feed: live visits, markers, Director trace, LLM usage.
import { usageLog, isMocked } from "@/babel/llm";
import { costOf, prices } from "@/babel/llm/cost";
import { elapsed, listVisits, shopperSummary } from "@/babel/session";
import { listDefaults } from "@/babel/session/defaults";
import { listGaps } from "@/babel/session/gaps";

export const dynamic = "force-dynamic";

export async function GET() {
  const usage = usageLog();
  const all = listVisits();
  // Visits where the Director actually looked (slide or hold): the visits the model cost is spent on.
  const adapted = all.filter((v) => v.trace.some((t) => t.kind === "slide" || t.kind === "hold")).length;
  const p = prices();
  return Response.json({
    cost: { ...costOf(usage, p, adapted), prices: p },
    llm: {
      mocked: isMocked(),
      model: isMocked() ? "mock" : process.env.DEEPSEEK_MODEL ?? "",
      calls: usage.length,
      errors: usage.filter((u) => u.error).length,
      cacheHitTokens: usage.reduce((s, u) => s + u.cacheHitTokens, 0),
      cacheMissTokens: usage.reduce((s, u) => s + u.cacheMissTokens, 0),
      outputTokens: usage.reduce((s, u) => s + u.outputTokens, 0),
    },
    defaults: listDefaults(),
    gaps: listGaps(),
    visits: all.slice(0, 20).map((v) => ({
      id: v.id,
      store: v.store,
      template: v.template,
      productId: v.productId,
      returning: v.returning,
      standardView: v.standardView,
      ageMs: elapsed(v),
      persona: v.slides.at(-1)!.persona,
      slides: v.slides.map((s) => ({ index: s.index, kind: s.kind, source: s.source, rationale: s.rationale })),
      markers: v.markers,
      shopper: shopperSummary(v),
      events: v.events.length,
      eventCounts: v.events.reduce<Record<string, number>>((c, e) => ({ ...c, [e.type]: (c[e.type] ?? 0) + 1 }), {}),
      trace: v.trace,
    })),
  });
}
