// Merchant panel feed: live visits, markers, Director trace, LLM usage.
import { usageLog, isMocked } from "@/babel/llm";
import { elapsed, listVisits, shopperSummary } from "@/babel/session";
import { listDefaults } from "@/babel/session/defaults";

export const dynamic = "force-dynamic";

export async function GET() {
  const usage = usageLog();
  return Response.json({
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
    visits: listVisits().slice(0, 20).map((v) => ({
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
