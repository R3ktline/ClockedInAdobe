// One-click demo run: replays synthetic shoppers headlessly (visit -> events -> Director), then runs the
// cross-shopper analysis, which suggests store defaults. Streams one JSON line per step so /demo can draw it live.
// It calls the real route handlers, so it exercises exactly what a browser ghost does. Everything is simulated.
import { analyzeAll } from "@/babel/agents/insights";
import { describeDiff } from "@/babel/schema/diff";
import { templateOf } from "@/babel/session/simulate";
import { shoppers } from "@/data/shoppers";
import { storeConfig } from "../_store";
import { POST as visitPOST } from "../visit/route";
import { POST as eventsPOST } from "../events/route";
import { POST as slidePOST } from "../slide/route";

export const dynamic = "force-dynamic";

// Radu three times so one change clears the "3+ sessions, 40%" bar; the rest once for variety.
const CAST = ["radu", "radu", "radu", "gheorghe", "mihai"] as const;

const call = (h: (r: Request) => Promise<Response>, body: unknown) =>
  h(new Request("http://demo.local", { method: "POST", body: JSON.stringify(body) })).then((r) => r.json());

export async function POST() {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const say = (kind: string, extra: object = {}) => ctrl.enqueue(enc.encode(JSON.stringify({ kind, ...extra }) + "\n"));
      try {
        say("plan", { cast: CAST.map((id) => ({ id, label: shoppers[id].label.split(":")[0], story: shoppers[id].label.split(":").slice(1).join(":").trim(), events: shoppers[id].events.map((e) => e.type) })) });
        const run = Date.now();
        // Concurrent: each shopper waits on the model, so this takes one model call's time, not five.
        await Promise.all(CAST.map(async (id, i) => {
          const s = shoppers[id];
          const path = s.startPath.split("/"); // ["", store, "p", id]
          const v = await call(visitPOST, {
            store: path[1], template: templateOf(s.startPath), productId: path[3], partner: s.partner,
            visitorId: `ghost:${id}-${run}-${i}`, fresh: true,
          });
          if (!v.visitId) { say("error", { text: `${id}: ${v.error ?? "visit failed"}` }); return; }
          say("visit", { i, persona: v.slide.persona, path: s.startPath });
          const ev = await call(eventsPOST, { visitId: v.visitId, events: s.events });
          say("markers", { i, markers: Object.fromEntries(Object.entries(ev.markers ?? {}).map(([k, m]) => [k, { value: (m as { value: number }).value, trend: (m as { trend: string }).trend }])) });
          const o = await call(slidePOST, { visitId: v.visitId });
          say("agent", {
            i, decision: o.decision, reason: o.reason, rationale: o.slide?.rationale, persona: o.slide?.persona,
            changes: o.slide ? describeDiff(v.slide, o.slide) : [],
          });
        }));
        say("insights");
        say("done", { results: await analyzeAll(storeConfig) });
      } catch (e) {
        say("error", { text: e instanceof Error ? e.message : String(e) });
      }
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson" } });
}
