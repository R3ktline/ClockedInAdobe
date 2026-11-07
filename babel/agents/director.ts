// The Director (SPEC §6.1, next-page mode): observes the shopper, bets on a hypothesis and plans how their next
// pages open, through tools. Code previews the plan on every page type and validates it; errors go back so the
// agent repairs its own plan. Any failure → hold, and the store keeps its rules view.
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { chat, isMocked, modelName, type ChatCompletionMessage, type ChatCompletionMessageParam, type ChatCompletionTool } from "@/babel/llm";
import { markerKinds } from "@/babel/markers";
import { Gap, MarkerId, Plan, type BrandKit, type Need, type Registry, type Template } from "@/babel/schema";
import { acceptPlan, clock, currentPage, nextCandidate, onScreen, previewPlan, type StoreCfg, type TraceEntry, type Trigger, type Visit } from "@/babel/session";
import { TRAIT_NAMES, TRAITS } from "@/babel/persona/signalModel";
import { productById } from "@/data/catalog";

const MAX_ROUNDS = 4;      // info lookups + up to 3 proposal attempts
const MAX_INFO_CALLS = 2;
const BUDGET_MS = Number(process.env.BABEL_DIRECTOR_BUDGET_MS ?? 25_000); // nobody waits on it: next-page mode
const SYSTEM_PROMPT = readFileSync(path.join(process.cwd(), "prompts", "director.md"), "utf8");

const schema = (s: z.ZodType) => { const { $schema: _drop, ...rest } = z.toJSONSchema(s) as Record<string, unknown>; return rest; };
const TOOLS: ChatCompletionTool[] = [
  { type: "function", function: { name: "proposePlan", description: "Plan how the shopper's next pages open. Returns validator errors if it is not allowed.", parameters: schema(Plan) } },
  { type: "function", function: { name: "hold", description: "Change nothing: the baseline already fits, or the evidence is too weak.", parameters: schema(z.object({ reason: z.string().max(200), gaps: z.array(Gap).max(2).optional() })) } },
  { type: "function", function: { name: "getMarkerEvidence", description: "The events behind one marker.", parameters: schema(z.object({ marker: MarkerId })) } },
  { type: "function", function: { name: "getProductFacts", description: "Catalog facts (specs, policies, rating) for up to 3 products.", parameters: schema(z.object({ ids: z.array(z.string()).min(1).max(3) })) } },
];

/** The static part of every call (identical across calls, so DeepSeek's prefix cache reuses it). */
export const staticContext = (registry: Registry, brand: BrandKit) => [
  SYSTEM_PROMPT,
  `REGISTRY (page type → block → label, variants with what each shows, neutral)\n${JSON.stringify(registry)}\n\nBRAND RANGES\n${JSON.stringify(brand.ranges)}`,
];

export type DirectorOutcome = {
  decision: "plan" | "hold";
  plan?: Plan;
  reason?: string;
  gaps: z.infer<typeof Gap>[];
  errors: string[][];
  rounds: number;
  ms: number;
  mocked: boolean;
  llm: NonNullable<TraceEntry["llm"]>;
};

function observation(v: Visit, cfg: StoreCfg, triggers: Trigger[]) {
  const page = currentPage(v);
  const p = page?.productId ? productById(page.productId) : undefined;
  const lastResult = v.trace.filter((t) => t.kind === "result").at(-1);
  const model = v.shopper.profile;
  const now = clock(v);
  return {
    page: page && { type: page.template, number: page.index + 1, product: p && { id: p.id, name: p.name, category: p.category } },
    triggers,
    stage: v.snapshot.stage,
    markers: Object.fromEntries(Object.entries(v.snapshot.markers).map(([k, m]) => [k, { value: m!.value, trend: m!.trend, ...(m!.top ? { top: m!.top } : {}) }])),
    markerKinds: markerKinds(),
    shopperModel: model && {
      suggested: { dialect: v.shopper.model.dialect, need: v.shopper.model.need, confidence: v.shopper.model.confidence, why: [v.shopper.model.dialectWhy, v.shopper.model.needWhy] },
      traits: Object.fromEntries(TRAITS.map((t) => [TRAIT_NAMES[t], { value: model.traits[t].value, confidence: model.traits[t].conf }])),
      buyingFor: model.buyingFor,
    },
    onScreen: page && { persona: onScreen(page).persona, blocks: onScreen(page).blocks.map(({ id, variant, order, collapsed }) => ({ id, variant, order, ...(collapsed ? { collapsed } : {}) })) },
    nextPages: Object.fromEntries((Object.keys(cfg.registry) as Template[]).map((t) => {
      const c = nextCandidate(v, cfg, t);
      return [t, { persona: { dialect: c.view.persona.dialect, need: c.view.persona.need }, blocks: c.view.blocks.map(({ id, variant, order, collapsed }) => ({ id, variant, order, ...(collapsed ? { collapsed } : {}) })) }];
    })),
    allowed: { dialectChange: v.dialectChanges < 1, currentDialect: v.dialect, frozen: v.frozen },
    recentEvents: v.events.slice(-15).map((e) => ({ page: e.page + 1, type: e.type, block: e.blockId, target: e.target, value: e.value, secondsAgo: Math.max(0, Math.round((now - e.t) / 1000)) })),
    lastHypothesisResult: lastResult?.text ?? null,
    plansSoFar: v.directorRuns,
  };
}

const safeJson = (s: string): Record<string, unknown> | undefined => { try { return JSON.parse(s); } catch { return undefined; } };

export async function runDirector(v: Visit, cfg: StoreCfg, triggers: Trigger[]): Promise<DirectorOutcome> {
  const started = Date.now();
  const input = JSON.stringify(observation(v, cfg, triggers), null, 1);
  const llm: DirectorOutcome["llm"] = { model: modelName(), input, rounds: [] };
  const out: DirectorOutcome = { decision: "hold", gaps: [], errors: [], rounds: 0, ms: 0, mocked: isMocked(), llm };
  const done = (o: Partial<DirectorOutcome>): DirectorOutcome => ({ ...out, ...o, ms: Date.now() - started });
  const messages: ChatCompletionMessageParam[] = [
    ...staticContext(cfg.registry, cfg.brand).map((content) => ({ role: "system" as const, content })),
    { role: "user", content: `<data>\n${input}\n</data>` },
  ];
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), BUDGET_MS);
  let infoCalls = 0;
  try {
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      out.rounds = round;
      const t0 = Date.now();
      const msg = await chat({ agent: "director", messages, tools: TOOLS, signal: abort.signal, mock: () => mockDecision(v, cfg, round) });
      messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
      const calls = (msg.tool_calls ?? []).filter((c) => c.type === "function");
      const said = (msg.content ?? "").slice(0, 1500);
      const log = (verdict: string, call?: { name: string; args: unknown }) => llm.rounds.push({ said, call, verdict, ms: Date.now() - t0 });
      if (!calls.length) { log("no tool call → hold"); return done({ reason: "no tool call" }); }
      const [call, ...extra] = calls;
      const args = safeJson(call.function.arguments);
      const shown = { name: call.function.name, args: args ?? call.function.arguments };
      for (const c of extra) messages.push({ role: "tool", tool_call_id: c.id, content: "ignored: one call per turn" });
      const reply = (content: unknown) => messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(content) });

      if (call.function.name === "getMarkerEvidence" || call.function.name === "getProductFacts") {
        if (++infoCalls > MAX_INFO_CALLS) { log("lookup refused: limit reached", shown); reply({ error: "no more lookups; decide now" }); continue; }
        log("lookup", shown);
        reply(call.function.name === "getMarkerEvidence" ? evidence(v, args?.marker) : facts(args?.ids));
        continue;
      }
      if (call.function.name === "hold") {
        const gaps = z.array(Gap).max(2).catch([]).parse(args?.gaps ?? []);
        log("hold", shown);
        return done({ reason: String(args?.reason ?? "hold").slice(0, 200), gaps });
      }
      const parsed = Plan.safeParse(args);
      const errs = !parsed.success ? parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) : undefined;
      const preview = parsed.success ? previewPlan(v, cfg, parsed.data) : undefined;
      if (parsed.success && preview?.ok) {
        acceptPlan(v, parsed.data, preview.previews);
        log("accepted", shown);
        return done({ decision: "plan", plan: parsed.data, gaps: parsed.data.gaps ?? [] });
      }
      const errors = errs ?? (preview && !preview.ok ? preview.errors : ["unknown error"]);
      log(`rejected: ${errors.join("; ")}`, shown);
      out.errors.push(errors);
      reply({ ok: false, errors });
    }
    return done({ reason: "no valid plan after repairs" });
  } catch (e) {
    const reason = abort.signal.aborted ? "timeout" : `llm error: ${e instanceof Error ? e.message : String(e)}`;
    llm.rounds.push({ said: "", verdict: `${reason} → hold`, ms: Date.now() - started });
    return done({ reason });
  } finally {
    clearTimeout(timer);
  }
}

function evidence(v: Visit, marker: unknown) {
  const id = MarkerId.safeParse(marker);
  if (!id.success) return { error: "unknown marker" };
  const m = v.snapshot.markers[id.data];
  return { marker: id.data, value: m?.value ?? 0, evidence: m?.evidence ?? [] };
}

function facts(ids: unknown) {
  const list = z.array(z.string()).max(3).catch([]).parse(ids);
  return list.map((id) => {
    const p = productById(id);
    return p ? { id, name: p.name, category: p.category, rating: p.rating, reviewCount: p.reviewCount, policies: p.policies, specs: p.specs.slice(0, 8), hasPromotion: !!p.promotion } : { id, error: "not found" };
  });
}

// ---------------------------------------------------------------- deterministic stand-in (no key)
// Reads the same observation a model would and plans one step beyond the rules' baseline. It keeps the pipeline
// testable offline; it is not the intelligence of the system and the merchant panel says "mock".
type MockPlan = { need: Need; dialect?: "guided"; changes: Plan["changes"]; rationale: string; hypothesis: Plan["hypothesis"] };
function mockPlanFor(v: Visit): MockPlan | null {
  const m = v.snapshot.markers;
  const val = (id: z.infer<typeof MarkerId>) => m[id]?.value ?? 0;
  if (val("confusion") >= 0.6 && v.dialect !== "guided" && v.dialectChanges < 1) return {
    need: "balanced", dialect: "guided",
    changes: [{ template: "product", id: "assist", variant: "ask_prompt" }, { template: "category", id: "filters", variant: "simple" }],
    rationale: "You moved between several pages without opening much, so the next pages show fewer, clearer choices and a way to ask.",
    hypothesis: { marker: "confusion", expect: "down", withinSeconds: 40, outcome: "stay" },
  };
  if (val("trustNeed") >= 0.6 || val("hesitation") >= 0.6) return {
    need: "reassurance",
    changes: [{ template: "product", id: "assist", variant: "ask_prompt" }, { template: "home", id: "hero", variant: "category_tiles" }],
    rationale: "You checked returns, warranty and reviews, so they come first on the next products, without promotion badges.",
    hypothesis: { marker: "hesitation", expect: "down", withinSeconds: 40, outcome: "cart" },
  };
  if (val("infoAppetite") >= 0.6) return {
    need: "specs",
    changes: [{ template: "product", id: "summary", variant: "key_facts" }],
    rationale: "You opened and read the specifications, so the next products open with all of them and a comparison.",
    hypothesis: { marker: "infoAppetite", expect: "up", withinSeconds: 40, outcome: "cart" },
  };
  if (val("priceSensitivity") >= 0.5) return {
    need: "deals",
    changes: [{ template: "product", id: "compare", variant: "cheaper" }],
    rationale: "You sorted and filtered by price, so lower-priced options and the store's current promotions come first.",
    hypothesis: { marker: "priceSensitivity", expect: "up", withinSeconds: 40, outcome: "cart" },
  };
  if (val("inspirationAppetite") >= 0.6) return {
    need: "inspiration",
    changes: [{ template: "home", id: "hero", variant: "collage" }],
    rationale: "You spent time on the photos, so the next pages lead with bigger pictures to browse.",
    hypothesis: { marker: "inspirationAppetite", expect: "up", withinSeconds: 40, outcome: "stay" },
  };
  if (v.snapshot.stage === "deciding") return {
    need: "quick", changes: [],
    rationale: "You added something to the cart, so buying comes first and the rest is folded away.",
    hypothesis: { marker: "purchaseIntent", expect: "up", withinSeconds: 40, outcome: "checkout" },
  };
  return null;
}

function mockDecision(v: Visit, cfg: StoreCfg, round: number): ChatCompletionMessage {
  const call = (name: string, args: unknown): ChatCompletionMessage => ({
    role: "assistant", content: null, refusal: null,
    tool_calls: [{ id: `mock-${v.directorRuns}-${round}`, type: "function", function: { name, arguments: JSON.stringify(args) } }],
  });
  const p = mockPlanFor(v);
  if (!p) return call("hold", { reason: "mock: no marker is high enough to act on" });
  const sameNeed = v.plan?.plan.need === p.need && !p.dialect;
  if (sameNeed) return call("hold", { reason: `mock: the plan already leads with ${p.need}` });
  // Drop changes the baseline already has, or that touch frozen blocks, so the plan stays inside the budget.
  const changes = p.changes.filter((c) => !v.frozen.includes(c.id) && cfg.registry[c.template]?.[c.id]);
  return call("proposePlan", { need: p.need, ...(p.dialect ? { dialect: p.dialect } : {}), changes, rationale: p.rationale, hypothesis: p.hypothesis });
}
