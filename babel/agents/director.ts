// The Director (SPEC §6.1): observes markers, bets on a hypothesis, proposes one slide through a
// tool, repairs its own proposal from validator errors, or holds. Foundation version: tools are
// proposeSlide and hold; getMarkerEvidence, getRegistry, getBrandKit and getProductFacts come in Phase 2.
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { chat, isMocked, type ChatCompletionMessage, type ChatCompletionMessageParam, type ChatCompletionTool } from "@/babel/llm";
import { validateSlide, type ValidateResult } from "@/babel/guardrails/validateSlide";
import { changedBlocks } from "@/babel/schema/diff";
import { markerKinds } from "@/babel/markers";
import { buildSlide, moveBlock } from "@/babel/persona";
import { Gap, SlideProposal, Understood, type BlockId, type BrandKit, type Registry, type Slide } from "@/babel/schema";
import { checkUnderstood, replyFrom } from "@/babel/agents/understanding";
import { elapsed, shopperSummary, type Trigger, type Visit } from "@/babel/session";

// What the shopper reads when the agent could not produce a checked answer. Never a guess.
const NOT_UNDERSTOOD = "I could not work out how to change the page for that, so it stays as it is. Try asking for one change at a time.";
const UNREACHABLE = "I could not reach my assistant just now, so the page stays as it is. Please try again in a moment.";
const MAX_ROUNDS = 3;
const BUDGET_MS = Number(process.env.BABEL_DIRECTOR_BUDGET_MS ?? 6_000); // raise for slow free models

const SYSTEM_PROMPT = readFileSync(path.join(process.cwd(), "prompts", "director.md"), "utf8");

const { $schema: _drop, ...proposalSchema } = z.toJSONSchema(SlideProposal) as Record<string, unknown>;
const { $schema: _d, ...gapsSchema } = z.toJSONSchema(z.array(Gap).max(2)) as Record<string, unknown>;
const { $schema: _u, ...understoodSchema } = z.toJSONSchema(Understood) as Record<string, unknown>;
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
      parameters: { type: "object", properties: { reason: { type: "string" }, gaps: gapsSchema, understood: understoodSchema }, required: ["reason"] },
    },
  },
];

// The two system messages every Director call starts with; the debug panel shows them as sent.
export const staticContext = (registry: Registry, brand: BrandKit, template: Slide["template"]) => [
  SYSTEM_PROMPT,
  `REGISTRY\n${JSON.stringify(registry[template])}\n\nBRAND RANGES\n${JSON.stringify(brand.ranges)}`,
];

export type DirectorOutcome = {
  decision: "slide" | "hold";
  understood?: Understood; // a typed request, split into wishes and checked against the slide
  reply?: string;          // what the shopper reads, built from `understood`
  gaps: Gap[]; // variants the registry lacks that the model asked for (saved for a human to build)
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

// `message` is what the shopper typed in the chatbox (untrusted text, passed in <user_message>).
// `opts.big`: curtain mode, the shopper asked in chat, so the slide may change the whole page (kind "explicit").
export async function runDirector(visit: Visit, registry: Registry, brand: BrandKit, triggers: Trigger[] = [], message?: string, opts: { big?: boolean } = {}): Promise<DirectorOutcome> {
  const started = Date.now();
  const prev = visit.slides.at(-1)!;
  const kind: Slide["kind"] = opts.big && message ? "explicit" : visit.returning && prev.index === 0 ? "major" : "minor";
  // Blocks the previous change touched are off limits for one slide (they must settle).
  const beforeLast = visit.slides.at(-2);
  const lastChanged = prev.kind === "minor" || prev.kind === "explicit"
    ? (beforeLast ? changedBlocks(beforeLast.blocks, prev.blocks) : changedBlocks(visit.slides[0]?.blocks ?? prev.blocks, prev.blocks))
    : [];
  const input = JSON.stringify(observation(visit, prev, kind, triggers, lastChanged), null, 1);
  const transcript: LlmTranscript = { model: isMocked() ? "mock" : process.env.DEEPSEEK_MODEL ?? "", input, rounds: [] };
  const out: DirectorOutcome = { decision: "hold", gaps: [], clamps: [], errors: [], rounds: 0, ms: 0, mocked: isMocked(), transcript };
  const done = (o: Partial<DirectorOutcome>) => ({ ...out, ...o, ms: Date.now() - started });

  // Static parts first so DeepSeek's prefix cache can reuse them (GUARDRAILS §5).
  const messages: ChatCompletionMessageParam[] = [
    ...staticContext(registry, brand, prev.template).map((content) => ({ role: "system" as const, content })),
    { role: "user", content: `<data>\n${input}\n</data>${message ? `\n<user_message>\n${message.replace(/<\/?user_message>/gi, "")}\n</user_message>` : ""}` },
  ];

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), BUDGET_MS);
  try {
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      out.rounds = round;
      const roundStart = Date.now();
      const msg = await chat({ agent: "director", messages, tools: TOOLS, signal: abort.signal, mock: () => mockDecision(visit, prev, triggers, brand, message, lastChanged, kind === "explicit" ? registry : undefined) });
      messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
      const calls = (msg.tool_calls ?? []).filter((c) => c.type === "function");
      const said = (msg.content ?? "").slice(0, 2000);
      const log = (verdict: string, call?: { name: string; args: unknown }) =>
        transcript.rounds.push({ said, call, verdict, ms: Date.now() - roundStart });
      if (!calls.length) { log("no tool call → hold"); return done({ reason: "no tool call", ...(message ? { reply: NOT_UNDERSTOOD } : {}) }); }

      const [call, ...extra] = calls;
      const shown = { name: call.function.name, args: safeJson(call.function.arguments) ?? call.function.arguments };
      for (const c of extra) messages.push({ role: "tool", tool_call_id: c.id, content: "ignored: one call per turn" });
      if (call.function.name === "hold") {
        const args = safeJson(call.function.arguments);
        out.gaps = z.array(Gap).max(2).catch([]).parse(args?.gaps ?? []);
        const understood = Understood.safeParse(args?.understood).data;
        if (message) { // a typed request: the wishes must be listed and consistent with holding
          const errs = checkUnderstood({ understood, prev, registry });
          if (errs.length) {
            log(`rejected: ${errs.join("; ")}`, shown);
            out.errors.push(errs);
            messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ ok: false, errors: errs }) });
            continue;
          }
        }
        log("hold", shown);
        return done({ reason: String(args?.reason ?? "hold"), ...(message ? { understood, reply: replyFrom(understood) } : {}) });
      }

      const parsed = SlideProposal.safeParse(safeJson(call.function.arguments));
      let result: ValidateResult = parsed.success
        // The validator also refuses these unless the shopper asks in their own words.
        ? validateSlide({ slide: applyProposal(prev, parsed.data, kind), prev, lastChanged: message ? [] : lastChanged, registry, brand, returning: visit.returning })
        : { ok: false as const, clamps: [], errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
      // Interpret first, then check: what the model says it understood must be what the slide does.
      if (parsed.success && result.ok && message) {
        const errs = checkUnderstood({ understood: parsed.data.understood, prev, registry, proposal: parsed.data, slide: result.slide });
        if (errs.length) result = { ok: false, clamps: result.clamps, errors: errs };
      }
      if (parsed.success) out.gaps = parsed.data.gaps ?? [];
      out.clamps.push(...result.clamps);
      log(result.ok ? `accepted${result.clamps.length ? ` (clamped: ${result.clamps.join("; ")})` : ""}` : `rejected: ${result.errors.join("; ")}`, shown);
      if (result.ok) return done({ decision: "slide", slide: result.slide, ...(message && parsed.success ? { understood: parsed.data.understood, reply: replyFrom(parsed.data.understood) } : {}) });
      out.errors.push(result.errors);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ ok: false, errors: result.errors }) });
    }
    return done({ reason: "no valid slide after repairs", ...(message ? { reply: NOT_UNDERSTOOD } : {}) });
  } catch (e) {
    const reason = abort.signal.aborted ? "timeout" : `llm error: ${e instanceof Error ? e.message : e}`;
    transcript.rounds.push({ said: "", verdict: `${reason} → hold`, ms: Date.now() - started });
    return done({ reason, ...(message ? { reply: UNREACHABLE } : {}) });
  } finally {
    clearTimeout(timer);
  }
}

function observation(visit: Visit, prev: Slide, kind: Slide["kind"], triggers: Trigger[], lastChanged: BlockId[]) {
  const lastScored = visit.trace.filter((t) => t.kind === "result").at(-1);
  return {
    page: prev.template,
    allowedSlideKind: kind,
    triggers,
    pageZoom: visit.zoom,
    markers: visit.markers,
    markerKinds: markerKinds(),
    shopperModel: shopperSummary(visit),
    // Your previous slide just changed these; the validator refuses to touch them again this turn.
    coolingDown: lastChanged.length ? lastChanged : undefined,
    currentSlide: {
      persona: prev.persona, theme: prev.theme, copyRegister: prev.copyRegister,
      blocks: prev.blocks.map(({ id, variant, order, collapsed }) => ({ id, variant, order, collapsed })),
      keep: prev.keep, hypothesis: prev.hypothesis,
    },
    // What the shopper just did, newest last, so the agent can react to specific behaviour and not only to scores.
    recentEvents: visit.events.slice(-15).map((e) => ({ type: e.type, block: e.blockId, value: e.value, secondsAgo: Math.max(0, Math.round((elapsed(visit) - e.t) / 1000)) })),
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
    trigger: kind === "major" ? "revisit" : kind === "explicit" ? "chat" : "markers",
    persona: {
      dialect: kind !== "minor" ? (p.dialect ?? prev.persona.dialect) : prev.persona.dialect,
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
function mockDecision(visit: Visit, prev: Slide, triggers: Trigger[], brand: BrandKit, message = "", coolingDown: BlockId[] = [], bigRegistry?: Registry): ChatCompletionMessage {
  const cooling = (id: BlockId) => coolingDown.includes(id);
  const call = (name: string, args: unknown): ChatCompletionMessage => ({
    role: "assistant", content: null, refusal: null,
    tool_calls: [{ id: `mock-${visit.slides.length}`, type: "function", function: { name, arguments: JSON.stringify(args) } }],
  });
  const asked = (re: RegExp) => triggers.includes("chat") && re.test(message);
  if (bigRegistry && triggers.includes("chat")) return mockBig(call, prev, message, brand, bigRegistry);
  if ((triggers.includes("zoom") || asked(/bigger|larger|small text|hard to read|simpl|plain/i)) && !cooling("summary")) {
    const plain = prev.blocks.find((b) => b.id === "summary") ? [{ id: "summary", variant: "benefits_plain" }] : [];
    return call("proposeSlide", {
      changes: plain,
      theme: { typeScale: Math.min(brand.ranges.typeScale[1], Math.round((prev.theme.typeScale + 0.1) * 100) / 100) },
      copyRegister: "plain",
      ...(message ? { understood: [{ wanted: "larger, simpler text", status: "do", how: "a slightly larger type size and a plainer description", sets: plain.map((c) => ({ block: c.id, variant: c.variant })) }] } : {}),
      rationale: "You zoomed in, so the text is now larger and the description shorter and plainer.",
      hypothesis: { marker: "hesitation", expect: "down", withinSeconds: 30 },
    });
  }
  if (asked(/compare|side by side|video|360/i)) {
    return call("hold", {
      reason: "mock: no registered variant does that",
      understood: [{ wanted: "a side-by-side comparison", status: "cannot", how: "no layout on this page does that" }],
      gaps: [{ block: "gallery", wanted: "A side-by-side comparison with similar products", why: `The shopper asked: "${message.slice(0, 100)}"` }],
    });
  }
  const m = visit.markers;
  // Like the live Director, the mock also follows the signal model's read when it is confident and
  // differs from what is on screen (minor slide: ≤ 4 blocks; the dialect may change).
  const model = shopperSummary(visit)?.suggested;
  const modelSays = (need: string) => !!model && model.need === need && model.confidence >= 0.55 && prev.persona.need !== need;
  const trustUp = prev.blocks.find((b) => b.id === "trust")?.order === 2;
  const markersSayTrust = (m.trustNeed?.value ?? 0) >= 0.6 || (m.hesitation?.value ?? 0) >= 0.6;
  const wantsTrust = asked(/return|warrant|refund|guarantee|review/i);
  if (prev.template === "product" && !trustUp && (wantsTrust || markersSayTrust || modelSays("reassurance"))) {
    return call("proposeSlide", {
      need: "reassurance",
      ...(message ? { understood: [{ wanted: "returns and reviews up front", status: "do", sets: [{ block: "trust", variant: "returns_warranty_first" }, { block: "buyBox", variant: "calm" }] }] } : {}),
      changes: [{ id: "trust", order: 2, variant: "returns_warranty_first" }, { id: "buyBox", variant: "calm" }],
      rationale: wantsTrust ? "You asked about returns and reviews, so returns, warranty and reviews now sit right under the photos."
        : "You checked returns and reviews, so returns, warranty and reviews now sit right under the photos.",
      hypothesis: { marker: "hesitation", expect: "down", withinSeconds: 30 },
    });
  }
  const specsUp = prev.blocks.find((b) => b.id === "specs");
  if (prev.template === "product" && specsUp && specsUp.variant !== "table_full" && modelSays("specs")) {
    return call("proposeSlide", {
      need: "specs",
      ...(message ? { understood: [{ wanted: "the full specifications up front", status: "do", sets: [{ block: "specs", variant: "table_full" }] }] } : {}),
      changes: [{ id: "specs", order: 2, variant: "table_full" }],
      rationale: "You opened the details and read them, so all the specifications are now open, right under the photos.",
      hypothesis: { marker: "infoAppetite", expect: "up", withinSeconds: 30 },
    });
  }
  // Layout: the section the shopper looked at last goes right next to the photos (two blocks: the photos
  // narrow, that section beside them), unless it is already there.
  const SIDE = { trust: "side_reviews", specs: "side_key", buyBox: "side_standard" } as const;
  const looked = visit.events.slice(-15).reverse()
    .map((e) => (e.type === "review_open" || e.type === "policy_open" ? "trust" : e.type === "block_open" || e.type === "block_dwell" ? e.blockId : undefined))
    .find((id): id is keyof typeof SIDE => !!id && id in SIDE);
  const gallery = prev.blocks.find((b) => b.id === "gallery");
  const target = looked && prev.blocks.find((b) => b.id === looked);
  if (prev.template === "product" && looked && target && gallery && !target.variant.startsWith("side_") && !target.collapsed && !cooling("gallery") && !cooling(looked)) {
    return call("proposeSlide", {
      changes: [{ id: "gallery", variant: "side_large" }, { id: looked, variant: SIDE[looked], order: gallery.order + 1 }],
      rationale: `You looked at the ${{ trust: "reviews", specs: "details", buyBox: "price" }[looked]}, so that section now sits next to the photos.`,
      hypothesis: { marker: looked === "specs" ? "infoAppetite" : "hesitation", expect: looked === "specs" ? "up" : "down", withinSeconds: 30 },
    });
  }
  return call("hold", {
    reason: "mock: nothing to change",
    ...(message ? { understood: [{ wanted: message.slice(0, 80), status: "cannot", how: "the offline stand-in did not recognise that request" }] } : {}),
  });
}

// Offline stand-in for the big-change chat path. It reads the words, splits the request into wishes, decides each
// one against the REGISTRY (do / already / cannot) and assembles one proposal. A live model does this properly;
// this only keeps the pipeline testable without a key, and it must never do the opposite of what was asked.
function mockBig(call: (name: string, args: unknown) => ChatCompletionMessage, prev: Slide, message: string, brand: BrandKit, registry: Registry): ChatCompletionMessage {
  type Part = { wanted: string; status: "do" | "already" | "cannot"; how?: string; sets?: { block: string; variant: string }[] };
  const parts: Part[] = [];
  const spec = registry[prev.template] ?? {};
  const has = (b: string) => !!(spec as Record<string, unknown>)[b];
  const nowVariant = (b: string) => prev.blocks.find((x) => x.id === b)?.variant;
  const forced: Record<string, string> = {}; // block -> variant a photo wish insists on
  const lookForced: Record<string, string> = {}; // variants a look wish needs beyond what the dialect picks
  let look: { dialect: Slide["persona"]["dialect"]; need: Slide["persona"]["need"] } | null = null;
  let needOnly: Slide["persona"]["need"] | null = null; // a need without a new look: keep the page the shopper has

  const smaller = /(smaller|less|fewer|tiny|reduce|shrink).{0,20}(photo|picture|image)|(photo|picture|image).{0,20}(smaller|less|fewer|tiny|shrink)/i.test(message);
  const bigger = !smaller && /(bigger|larger|more|show).{0,15}(photo|picture|image)|(photo|picture|image).{0,15}(bigger|larger)/i.test(message);
  const sort = /\b(sort|rank|order by|cheapest first|best rated)\b/i.test(message);
  const simpler = /simpl|plain|easy|larger text|bigger text|read|clear/i.test(message);
  const details = /spec|detail|technical|everything/i.test(message);
  const trust = /return|warrant|refund|trust|review|safe/i.test(message) && !sort;

  if (smaller) {
    if (has("gallery")) {
      if (nowVariant("gallery") === "side_large") parts.push({ wanted: "photos smaller", status: "already", sets: [{ block: "gallery", variant: "side_large" }] });
      else if (nowVariant("gallery") === "grid_thumbs") parts.push({ wanted: "photos smaller", status: "cannot", how: "the only smaller layout puts the photo at half width beside another section, which this stand-in does not set up" });
      else { forced.gallery = "grid_thumbs"; parts.push({ wanted: "photos smaller", status: "do", how: "back to thumbnails beside one main picture", sets: [{ block: "gallery", variant: "grid_thumbs" }] }); }
    } else parts.push({ wanted: "photos smaller", status: "cannot", how: "this page has no photo-size setting; product pages do" });
  }
  if (bigger) {
    if (has("gallery")) {
      if (nowVariant("gallery") === "single_large") parts.push({ wanted: "photos bigger", status: "already", sets: [{ block: "gallery", variant: "single_large" }] });
      else { forced.gallery = "single_large"; parts.push({ wanted: "photos bigger", status: "do", how: "one large picture, no thumbnails", sets: [{ block: "gallery", variant: "single_large" }] }); }
    } else if (has("productList")) {
      if (nowVariant("productList") === "bento_visual") parts.push({ wanted: "photos bigger", status: "already", sets: [{ block: "productList", variant: "bento_visual" }] });
      else { forced.productList = "bento_visual"; parts.push({ wanted: "photos bigger", status: "do", how: "an image-first mosaic, which has no star rating", sets: [{ block: "productList", variant: "bento_visual" }] }); }
    }
  }
  if (sort) {
    parts.push({ wanted: "products sorted by reviews", status: "cannot", how: "this page has no sorting" });
  }
  if (simpler) look = { dialect: "guided", need: "quick" }, parts.push({ wanted: "a simpler page with larger text", status: "do", how: "larger text, plainer words, one clear next step" });
  else if (details) look = { dialect: "dense", need: "specs" }, parts.push({ wanted: "the full details up front", status: "do", how: "compact layout with every specification" });
  else if (trust) {
    needOnly = "reassurance";
    lookForced.trust = "returns_warranty_first";
    if (has("buyBox")) lookForced.buyBox = "calm";
    parts.push({ wanted: "returns and reviews up front", status: "do", how: "returns, warranty and reviews right under the photos" });
  }

  if (!parts.length) {
    return call("hold", { reason: "mock: not recognised", understood: [{ wanted: message.slice(0, 80), status: "cannot", how: "the offline stand-in did not recognise that request" }] });
  }

  const doing = parts.filter((x) => x.status === "do");
  const gaps = parts.some((x) => x.status === "cannot" && /sort/i.test(x.wanted))
    ? [{ block: "productList", wanted: "Sort products by reviews or rating", why: `The shopper asked: "${message.slice(0, 100)}"` }] : [];
  if (!doing.length) return call("hold", { reason: `mock: ${parts.map((x) => `${x.wanted} ${x.status}`).join(", ")}`, understood: parts, gaps });

  // Start from the look's slide when a look was asked for, otherwise from what is on screen; photo wishes win.
  const base = look ? buildSlide({ persona: { ...look, confidence: 0.7 }, template: prev.template, registry, brand })
    : needOnly && has("trust") ? { ...prev, blocks: moveBlock(prev.blocks, "trust", 2) } : prev;
  const wanted = base.blocks.map((b) => ({ ...b, variant: forced[b.id] ?? lookForced[b.id] ?? b.variant }));
  const changes = wanted
    .filter((b) => { const o = prev.blocks.find((x) => x.id === b.id); return !o || o.variant !== b.variant || o.order !== b.order; })
    .map((b) => ({ id: b.id, variant: b.variant, order: b.order }));
  const lookSets = look || needOnly ? changes.filter((c) => !(c.id in forced)).map((c) => ({ block: c.id, variant: c.variant })) : [];
  const withSets = parts.map((x) => (x.status === "do" && !x.sets ? { ...x, sets: lookSets } : x));
  return call("proposeSlide", {
    ...(look ? { dialect: look.dialect, need: look.need, theme: base.theme, copyRegister: base.copyRegister } : needOnly ? { need: needOnly } : {}),
    changes, understood: withSets, gaps,
    rationale: "Changed what you asked for and said what I could not do.",
    hypothesis: { marker: "hesitation", expect: "down", withinSeconds: 30 },
  });
}
