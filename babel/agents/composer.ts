// The Composer: builds a whole new page for a typed request. It searches the catalog through the same read-only
// tools buyer agents use, then proposes a ComposedPage; code validates it and hands errors back for repair.
// Any failure (no key, timeout, invalid after repairs) returns the deterministic fallback page (rule 11).
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { chat, isMocked, type ChatCompletionMessage, type ChatCompletionMessageParam, type ChatCompletionTool } from "@/babel/llm";
import { validateComposed } from "@/babel/guardrails/validateComposed";
import { ComposedPage, type BrandKit, type ComposedElement } from "@/babel/schema";
import { callTool, tools, ToolError } from "@/babel/tools";
import { catalog, productById } from "@/data/catalog";
import { translate } from "@/lib/i18n/dictionaries";
import { DEFAULT_LANG, LANGS, type Lang } from "@/lib/i18n/locales";

const SYSTEM_PROMPT = readFileSync(path.join(process.cwd(), "prompts", "composer.md"), "utf8");
const MAX_ROUNDS = 8;
const BUDGET_MS = Number(process.env.BABEL_COMPOSER_BUDGET_MS ?? 30_000);
const CATALOG_TOOLS = ["search_products", "get_product", "compare_products"] as const;

const { $schema: _s, ...pageSchema } = z.toJSONSchema(ComposedPage.omit({ source: true })) as Record<string, unknown>;
const TOOLS: ChatCompletionTool[] = [
  ...CATALOG_TOOLS.map((name) => {
    const { $schema: _d, ...parameters } = z.toJSONSchema(tools[name].input) as Record<string, unknown>;
    return { type: "function" as const, function: { name, description: tools[name].description, parameters } };
  }),
  { type: "function", function: { name: "composePage", description: "Show the finished page. Returns validator errors if it is not allowed.", parameters: pageSchema } },
];

export type ComposeStep = { tool: string; args: unknown; verdict: string; ms: number };
export type ComposeOutcome = { page: ComposedPage; steps: ComposeStep[]; mocked: boolean; ms: number; reason?: string };

type Search = { total: number; results: { id: string }[] };

/** The page plain code makes from the request: a keyword search shown as a grid. Instant, no model. */
export function fallbackPage(request: string, lang: Lang = DEFAULT_LANG): ComposedPage {
  const found = (callTool("search_products", { query: request.slice(0, 500), limit: 8 }) as Search).results.map((r) => r.id);
  const ids = found.length ? found : [...catalog].sort((a, b) => b.rating - a.rating).slice(0, 6).map((p) => p.id);
  const elements: ComposedElement[] = [
    ...(found.length ? [] : [{ type: "note" as const, text: translate(lang, "ai.fallbackNone") }]),
    { type: "products", ids, layout: "grid" },
  ];
  return { title: translate(lang, "ai.fallbackTitle", { q: request.slice(0, 70) }), elements, rationale: translate(lang, "ai.fallbackRationale"), source: "fallback" };
}

export async function composePage(request: string, brand: BrandKit, lang: Lang = DEFAULT_LANG): Promise<ComposeOutcome> {
  const started = Date.now();
  const steps: ComposeStep[] = [];
  const done = (page: ComposedPage, reason?: string): ComposeOutcome => ({ page, steps, mocked: isMocked(), ms: Date.now() - started, reason });
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Write the title, headings, notes and rationale in ${LANGS.find((l) => l.code === lang)!.name}.
<user_message>\n${request.replace(/<\/?user_message>/gi, "")}\n</user_message>` },
  ];
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), BUDGET_MS);
  try {
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const msg = await chat({ agent: "composer", messages, tools: TOOLS, signal: abort.signal, mock: () => mockCompose(request, round, lang) });
      messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
      const calls = (msg.tool_calls ?? []).filter((c) => c.type === "function");
      if (!calls.length) return done(fallbackPage(request, lang), "the model answered without a tool call");
      for (const call of calls) {
        const t0 = Date.now();
        const args = safeJson(call.function.arguments);
        const reply = (content: unknown, verdict: string) => {
          steps.push({ tool: call.function.name, args, verdict, ms: Date.now() - t0 });
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(content) });
        };
        if (call.function.name === "composePage") {
          const r = validateComposed({ ...(args as object), source: "agent" }, { request, byId: productById, brand });
          if (r.ok) { steps.push({ tool: "composePage", args, verdict: "accepted", ms: Date.now() - t0 }); return done(r.page); }
          reply({ ok: false, errors: r.errors }, `rejected: ${r.errors.join("; ")}`);
        } else if ((CATALOG_TOOLS as readonly string[]).includes(call.function.name)) {
          try {
            const out = callTool(call.function.name, args);
            reply(out, summarise(call.function.name, out));
          } catch (e) {
            if (!(e instanceof ToolError)) throw e;
            reply({ error: e.message }, `error: ${e.message}`);
          }
        } else reply({ error: `unknown tool ${call.function.name}` }, "unknown tool");
      }
    }
    return done(fallbackPage(request, lang), "no valid page after repairs");
  } catch (e) {
    return done(fallbackPage(request, lang), abort.signal.aborted ? "timeout" : `llm error: ${e instanceof Error ? e.message : e}`);
  } finally {
    clearTimeout(timer);
  }
}

const summarise = (name: string, out: unknown) =>
  name === "search_products" ? `${(out as Search).results.length} of ${(out as Search).total} products` : "ok";

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return undefined; }
}

// Offline stand-in: one search, then the keyword-grid page as its answer. It cannot read what the request is about,
// which is the point: only the live model builds the comparison, picks the reviews and writes the headings.
function mockCompose(request: string, round: number, lang: Lang): ChatCompletionMessage {
  const call = (name: string, args: unknown): ChatCompletionMessage => ({
    role: "assistant", content: null, refusal: null,
    tool_calls: [{ id: `mock-compose-${round}`, type: "function", function: { name, arguments: JSON.stringify(args) } }],
  });
  if (round === 1) return call("search_products", { query: request.slice(0, 500), limit: 8 });
  const { source: _src, ...page } = fallbackPage(request, lang);
  return call("composePage", { ...page, rationale: translate(lang, "ai.mockRationale") });
}
