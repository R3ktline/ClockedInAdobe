// Lab feed (testing only): everything the indicators panel shows about one live visit.
// What the shopper did, which model signal each action became, every trait with its confidence,
// the team markers the agent watches, the agent's trace, and the memory the browser should keep.
import { modelInputs } from "@/babel/persona/modelInputs";
import { SIGNALS, THRESHOLD, TRAITS, TRAIT_NAMES } from "@/babel/persona/signalModel";
import type { InteractionEvent } from "@/babel/schema";
import { elapsed, getVisit, recall, shopperSummary } from "@/babel/session";

export const dynamic = "force-dynamic";

const BARE = { consent: { personalization: true, partnerData: false }, visitor: { returning: false, visits: 1 } };

// The model signals one event produces on its own, with the traits they push.
function effectsOf(e: InteractionEvent) {
  const { signals } = modelInputs([e], BARE);
  delete signals.views_without_opens; // only meaningful over a whole page, shown under "page signals"
  return Object.keys(signals).flatMap((id) =>
    (SIGNALS[id]?.[1] ?? []).map(([t, sign]) => ({ signal: id, trait: TRAIT_NAMES[t], dir: sign > 0 ? "+" : "−" })),
  ).concat(Object.keys(signals).filter((id) => !SIGNALS[id]).map((id) => ({ signal: id, trait: "intent stage", dir: "" })));
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("visitId") ?? "";
  const v = getVisit(id);
  if (!v) return Response.json({ error: "unknown visit" }, { status: 404 });
  const slide = v.slides.at(-1)!;
  const shopper = shopperSummary(v);
  const p = v.shopper?.profile;
  const page = modelInputs(v.events, v.partner).signals;
  const context = Object.keys(modelInputs([], v.partner).signals);
  return Response.json({
    ageMs: elapsed(v),
    returning: v.returning,
    usedMemory: !!v.prior,
    threshold: THRESHOLD,
    slide: { index: slide.index, kind: slide.kind, source: slide.source, persona: slide.persona, rationale: slide.rationale, copyRegister: slide.copyRegister },
    slides: v.slides.length,
    events: v.events.slice(-10).reverse().map((e) => ({ ...e, effects: effectsOf(e) })),
    pageSignals: page.views_without_opens ? [`views_without_opens × ${page.views_without_opens} (infoAppetite −)`] : [],
    contextSignals: context, // from what the store shared: referrer, return visit
    traits: p ? TRAITS.map((t) => ({
      id: t, name: TRAIT_NAMES[t], value: p.traits[t].value, conf: p.traits[t].conf,
      used: p.traits[t].conf >= THRESHOLD,
      groups: Object.entries(p.groups[t]).map(([g, x]) => ({ group: g, sum: Math.round(x * 100) / 100 })),
    })) : [],
    stage: p?.stage, buyingFor: p?.buyingFor,
    suggested: shopper?.suggested ?? null,
    markers: Object.fromEntries(Object.entries(v.markers).map(([k, m]) => [k, m!.value])),
    trace: v.trace.slice(-8).reverse().map((t) => ({ at: t.at, kind: t.kind, text: t.text })),
    memory: v.visitorId ? recall(v.visitorId) ?? null : null, // what the browser keeps when the site closes
  });
}
