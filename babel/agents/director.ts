// The Director (SPEC §6.1): observes markers, bets on a hypothesis, proposes one slide through a
// tool, repairs its own proposal from validator errors, or holds. Foundation version: tools are
// proposeSlide and hold; getMarkerEvidence, getRegistry, getBrandKit and getProductFacts come in Phase 2.
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { chat, isMocked, type ChatCompletionMessage, type ChatCompletionMessageParam, type ChatCompletionTool } from "@/babel/llm";
import { validateSlide } from "@/babel/guardrails/validateSlide";
import { markerKinds } from "@/babel/markers";
import { moveBlock } from "@/babel/persona";
import { SlideProposal, type BrandKit, type Registry, type Slide } from "@/babel/schema";
import { shopperSummary, type Trigger, type Visit } from "@/babel/session";

const MAX_ROUNDS = 3;
const BUDGET_MS = Number(process.env.BABEL_DIRECTOR_BUDGET_MS ?? 6_000); // raise for slow free models

const SYSTEM_PROMPT = readFileSync(path.join(process.cwd(), "prompts", "director.md"), "utf8");

const { $schema: _drop, ...proposalSchema } = z.toJSONSchema(SlideProposal) as Record<string, unknown>;
const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "proposeSlide",
      description: "Propose the next slide as changes to the current one. Returns validator errors if it is not allowed.",
      parameters: proposalSchema,
    },
  },
  {
    type: "function",
    function: {
      name: "hold",
      description: "Keep the current slide.",
      parameters: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"] },
    },
  },
];

export type DirectorOutcome = {
  decision: "slide" | "hold";
  slide?: Slide;
  reason?: string;
  clamps: string[];
  errors: string[][]; // validator errors per rejected round
  rounds: number;
  ms: number;
  mocked: boolean;
  transcript: LlmTranscript; // for the merchant panel: what the model saw and said
};

// One entry per model round, so you can read the agent's reasoning while testing.
export type LlmTranscript = {
  model: string;
  input: string; // the observation sent this turn (the static prompt and registry are left out)
  rounds: { said: string; call?: { name: string; args: unknown }; verdict: string; ms: number }[];
};

export async function runDirector(visit: Visit, registry: Registry, brand: BrandKit, triggers: Trigger[] = []): Promise<DirectorOutcome> {
  const started = Date.now();
  const prev = visit.slides.at(-1)!;
  const kind: Slide["kind"] = visit.returning && prev.index === 0 ? "major" : "minor";
  const input = JSON.stringify(observation(visit, prev, kind, triggers), null, 1);
  const transcript: LlmTranscript = { model: isMocked() ? "mock" : process.env.DEEPSEEK_MODEL ?? "", input, rounds: [] };
  const out: DirectorOutcome = { decision: "hold", clamps: [], errors: [], rounds: 0, ms: 0, mocked: isMocked(), transcript };
  const done = (o: Partial<DirectorOutcome>) => ({ ...out, ...o, ms: Date.now() - started });

  // Static parts first so DeepSeek's prefix cache can reuse them (GUARDRAILS §5).
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `REGISTRY\n${JSON.stringify(registry[prev.template])}\n\nBRAND RANGES\n${JSON.stringify(brand.ranges)}` },
    { role: "user", content: `<data>\n${input}\n</data>` },
  ];

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), BUDGET_MS);
  try {
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      out.rounds = round;
      const roundStart = Date.now();
      const msg = await chat({ agent: "director", messages, tools: TOOLS, signal: abort.signal, mock: () => mockDecision(visit, prev, triggers, brand) });
      messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
      const calls = (msg.tool_calls ?? []).filter((c) => c.type === "function");
      const said = (msg.content ?? "").slice(0, 2000);
      const log = (verdict: string, call?: { name: string; args: unknown }) =>
        transcript.rounds.push({ said, call, verdict, ms: Date.now() - roundStart });
      if (!calls.length) { log("no tool call → hold"); return done({ reason: "no tool call" }); }

      const [call, ...extra] = calls;
      const shown = { name: call.function.name, args: safeJson(call.function.arguments) ?? call.function.arguments };
      for (const c of extra) messages.push({ role: "tool", tool_call_id: c.id, content: "ignored: one call per turn" });
      if (call.function.name === "hold") {
        log("hold", shown);
        return done({ reason: String(safeJson(call.function.arguments)?.reason ?? "hold") });
      }

      const parsed = SlideProposal.safeParse(safeJson(call.function.arguments));
      const result = parsed.success
        ? validateSlide({ slide: applyProposal(prev, parsed.data, kind), prev, registry, brand, returning: visit.returning })
        : { ok: false as const, clamps: [], errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
      out.clamps.push(...result.clamps);
      log(result.ok ? `accepted${result.clamps.length ? ` (clamped: ${result.clamps.join("; ")})` : ""}` : `rejected: ${result.errors.join("; ")}`, shown);
      if (result.ok) return done({ decision: "slide", slide: result.slide });
      out.errors.push(result.errors);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ ok: false, errors: result.errors }) });
    }
    return done({ reason: "no valid slide after repairs" });
  } catch (e) {
    const reason = abort.signal.aborted ? "timeout" : `llm error: ${e instanceof Error ? e.message : e}`;
    transcript.rounds.push({ said: "", verdict: `${reason} → hold`, ms: Date.now() - started });
    return done({ reason });
  } finally {
    clearTimeout(timer);
  }
}

function observation(visit: Visit, prev: Slide, kind: Slide["kind"], triggers: Trigger[]) {
  const lastScored = visit.trace.filter((t) => t.kind === "result").at(-1);
  return {
    page: prev.template,
    allowedSlideKind: kind,
    triggers,
    pageZoom: visit.zoom,
    markers: visit.markers,
    markerKinds: markerKinds(),
    shopperModel: shopperSummary(visit),
    currentSlide: {
      persona: prev.persona, theme: prev.theme, copyRegister: prev.copyRegister,
      blocks: prev.blocks.map(({ id, variant, order, collapsed }) => ({ id, variant, order, collapsed })),
      keep: prev.keep, hypothesis: prev.hypothesis,
    },
    lastHypothesisResult: lastScored?.text ?? null,
    wentBack: visit.events.filter((e) => e.type === "slide_prev").length,
    slidesSoFar: visit.slides.length,
  };
}

export function applyProposal(prev: Slide, p: SlideProposal, kind: Slide["kind"]): Slide {
  let blocks = structuredClone(prev.blocks);
  for (const c of p.changes) {
    const b = blocks.find((x) => x.id === c.id);
    if (!b) { blocks.push({ id: c.id, variant: c.variant ?? "", order: blocks.length + 1 }); continue; }
    if (c.variant) b.variant = c.variant;
    if (c.collapsed !== undefined) b.collapsed = c.collapsed;
  }
  for (const c of p.changes) if (c.order) blocks = moveBlock(blocks, c.id, c.order);
  return {
    ...prev,
    id: `${prev.template}-${prev.index + 1}-${Math.random().toString(36).slice(2, 8)}`,
    index: prev.index + 1,
    parentId: prev.id,
    kind,
    trigger: kind === "major" ? "revisit" : "markers",
    persona: {
      dialect: kind === "major" ? (p.dialect ?? prev.persona.dialect) : prev.persona.dialect,
      need: p.need ?? prev.persona.need,
      confidence: Math.max(prev.persona.confidence, 0.7),
    },
    theme: { ...prev.theme, ...p.theme },
    copyRegister: p.copyRegister ?? prev.copyRegister,
    blocks,
    rationale: p.rationale,
    hypothesis: p.hypothesis,
    confidence: 0.7,
    source: "director",
  };
}

function safeJson(s: string): Record<string, unknown> | undefined {
  try { return JSON.parse(s); } catch { return undefined; }
}

// Deterministic stand-in used without an API key: answers trust or hesitation spikes on a product page.
function mockDecision(visit: Visit, prev: Slide, triggers: Trigger[], brand: BrandKit): ChatCompletionMessage {
  const call = (name: string, args: unknown): ChatCompletionMessage => ({
    role: "assistant", content: null, refusal: null,
    tool_calls: [{ id: `mock-${visit.slides.length}`, type: "function", function: { name, arguments: JSON.stringify(args) } }],
  });
  if (triggers.includes("zoom")) {
    const plain = prev.blocks.find((b) => b.id === "summary") ? [{ id: "summary", variant: "benefits_plain" }] : [];
    return call("proposeSlide", {
      changes: plain,
      theme: { typeScale: Math.min(brand.ranges.typeScale[1], Math.round((prev.theme.typeScale + 0.1) * 100) / 100) },
      copyRegister: "plain",
      rationale: "You zoomed in, so the text is now larger and the description shorter and plainer.",
      hypothesis: { marker: "hesitation", expect: "down", withinSeconds: 30 },
    });
  }
  const m = visit.markers;
  const trustUp = prev.blocks.find((b) => b.id === "trust")?.order === 2;
  if (prev.template === "product" && !trustUp && ((m.trustNeed?.value ?? 0) >= 0.6 || (m.hesitation?.value ?? 0) >= 0.6)) {
    return call("proposeSlide", {
      need: "reassurance",
      changes: [{ id: "trust", order: 2, variant: "returns_warranty_first" }, { id: "buyBox", variant: "calm" }],
      rationale: "You checked returns and reviews, so returns, warranty and reviews now sit right under the photos.",
      hypothesis: { marker: "hesitation", expect: "down", withinSeconds: 30 },
    });
  }
  return call("hold", { reason: "mock: nothing to change" });
}
