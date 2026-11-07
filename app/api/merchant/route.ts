// The merchant panel's data: live visits, markers, the Director's trace, guardrail log, LLM usage and cost.
// Everything here comes from synthetic sessions and is labelled simulated in the UI.
import { costOf, isMocked, modelName, prices, usageLog } from "@/babel/llm";
import { TRAIT_NAMES, TRAITS } from "@/babel/persona/signalModel";
import { listGaps } from "@/babel/session/gaps";
import { clock, getVisit, listVisits, onScreen, resetAll, scoreHypotheses, type Visit } from "@/babel/session";

export const dynamic = "force-dynamic";

const brief = (v: Visit) => {
  const last = v.pages.at(-1);
  const view = last && onScreen(last);
  return {
    id: v.id, who: v.ghost ? `${v.ghost[0].toUpperCase()}${v.ghost.slice(1)} (ghost)` : v.visitorId ? "visitor" : "no consent",
    consent: v.partner.consent.personalization, returning: v.returning, number: v.number, pages: v.pages.length,
    persona: view ? `${view.persona.dialect} × ${view.persona.need}` : "-", kind: view?.kind, stage: v.snapshot.stage,
    markers: Object.fromEntries(Object.entries(v.snapshot.markers).map(([k, m]) => [k, { value: m!.value, trend: m!.trend }])),
    directorRuns: v.directorRuns, standard: v.standard, lastActiveAt: v.lastActiveAt,
  };
};

const detail = (v: Visit) => ({
  ...brief(v),
  markers: v.snapshot.markers,
  traits: v.shopper.profile ? Object.fromEntries(TRAITS.map((t) => [TRAIT_NAMES[t], v.shopper.profile!.traits[t]])) : null,
  model: v.shopper.model,
  pages: v.pages.map((p) => ({ index: p.index, template: p.template, path: p.path, confirmed: p.confirmed, planId: p.planId, views: p.views.map((x) => ({ kind: x.kind, source: x.source, persona: x.persona, skin: x.skin, rationale: x.rationale, blocks: x.blocks })) })),
  plan: v.plan && { ...v.plan, previews: Object.fromEntries(Object.entries(v.plan.previews).map(([t, x]) => [t, { persona: x!.persona, blocks: x!.blocks }])) },
  hypotheses: v.hypotheses,
  frozen: v.frozen, explicit: v.explicit ?? null, dialectChanges: v.dialectChanges, skin: v.skin ?? null,
  trace: v.trace,
  events: v.events.length,
});

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("visit");
  const visits = listVisits();
  for (const v of visits) scoreHypotheses(v, clock(v)); // bets whose window ended while the shopper was quiet
  const usage = usageLog();
  const p = prices();
  const agents = new Map<string, { calls: number; hit: number; miss: number; out: number; ms: number; errors: number; cost: number | null }>();
  for (const e of usage) {
    const a = agents.get(e.agent) ?? { calls: 0, hit: 0, miss: 0, out: 0, ms: 0, errors: 0, cost: p ? 0 : null };
    a.calls++; a.hit += e.cacheHitTokens; a.miss += e.cacheMissTokens; a.out += e.outputTokens; a.ms += e.ms; a.errors += e.error ? 1 : 0;
    if (p && a.cost !== null) a.cost += costOf(e, p);
    agents.set(e.agent, a);
  }
  const totalCost = p ? usage.reduce((s, e) => s + costOf(e, p), 0) : null;
  const decisions = usage.filter((e) => e.agent === "director").length;
  const consented = visits.filter((v) => v.partner.consent.personalization).length;
  return Response.json({
    llm: { mocked: isMocked(), model: modelName(), prices: p },
    cost: {
      total: totalCost,
      perDirectorCall: totalCost !== null && decisions ? (agents.get("director")?.cost ?? 0) / decisions : null,
      per1000Visits: totalCost !== null && consented ? (totalCost / consented) * 1000 : null,
      visits: consented,
      agents: Object.fromEntries(agents),
    },
    visits: visits.slice(0, 40).map(brief),
    detail: (id ? getVisit(id) : visits[0]) ? detail((id ? getVisit(id) : visits[0])!) : null,
    gaps: listGaps().slice(0, 10),
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  if (body?.action === "reset") { resetAll(); return Response.json({ ok: true }); }
  return Response.json({ error: "unknown action" }, { status: 400 });
}
