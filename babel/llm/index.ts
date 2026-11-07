// The only module that calls a model (AGENTS rule 5). OpenAI-compatible: DeepSeek by default, any compatible
// endpoint through the same three env vars. Records usage for the cost meter. With no DEEPSEEK_API_KEY (or
// BABEL_LLM=mock) every call is answered by the caller's deterministic mock, so the store always runs.
import OpenAI from "openai";
import type { ChatCompletionMessage, ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

export type { ChatCompletionMessage, ChatCompletionMessageParam, ChatCompletionTool };

export type UsageEntry = {
  at: string; agent: string; model: string; mocked: boolean; ms: number;
  cacheHitTokens: number; cacheMissTokens: number; outputTokens: number; error?: string;
};

type LlmState = { client?: OpenAI; usage: UsageEntry[] };
const g = globalThis as unknown as { __babelLlm?: LlmState };
const state: LlmState = (g.__babelLlm ??= { usage: [] });

export const isMocked = () => !process.env.DEEPSEEK_API_KEY || process.env.BABEL_LLM === "mock";
export const modelName = () => (isMocked() ? "mock" : process.env.DEEPSEEK_MODEL ?? "");

function client(): OpenAI {
  return (state.client ??= new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    maxRetries: 0, // agents have their own time budget and fall back deterministically
  }));
}

export type ChatArgs = {
  agent: string;
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  signal?: AbortSignal;
  mock: () => ChatCompletionMessage;
};

export async function chat(args: ChatArgs): Promise<ChatCompletionMessage> {
  const started = Date.now();
  const model = process.env.DEEPSEEK_MODEL ?? "";
  const entry: UsageEntry = {
    at: new Date().toISOString(), agent: args.agent, model: modelName(), mocked: isMocked(),
    ms: 0, cacheHitTokens: 0, cacheMissTokens: 0, outputTokens: 0,
  };
  try {
    if (isMocked()) return args.mock();
    if (!model) throw new Error("DEEPSEEK_MODEL is not set (see .env.example)");
    const res = await client().chat.completions.create(
      { model, messages: args.messages, tools: args.tools, tool_choice: args.tools ? "auto" : undefined },
      { signal: args.signal },
    );
    // DeepSeek reports prefix-cache hits and misses next to the standard usage fields.
    const u = res.usage as (typeof res.usage & { prompt_cache_hit_tokens?: number; prompt_cache_miss_tokens?: number }) | undefined;
    entry.cacheHitTokens = u?.prompt_cache_hit_tokens ?? 0;
    entry.cacheMissTokens = u?.prompt_cache_miss_tokens ?? u?.prompt_tokens ?? 0;
    entry.outputTokens = u?.completion_tokens ?? 0;
    return res.choices[0].message;
  } catch (e) {
    entry.error = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    entry.ms = Date.now() - started;
    state.usage.push(entry);
  }
}

export const usageLog = (): readonly UsageEntry[] => state.usage;

// ---------------------------------------------------------------- cost meter
// Prices per 1M tokens in USD, from the provider's own pricing page, set by hand on the day. DeepSeek's pricing
// page did not return a price table on 2026-11-07, so nothing is hard-coded: unset = "price not set [VERIFY]".
export type Prices = { hit: number; miss: number; out: number; source: string } | null;
export function prices(): Prices {
  const n = (k: string) => (process.env[k] === undefined || process.env[k] === "" ? NaN : Number(process.env[k]));
  const hit = n("BABEL_PRICE_HIT_PER_M"), miss = n("BABEL_PRICE_MISS_PER_M"), out = n("BABEL_PRICE_OUT_PER_M");
  if ([hit, miss, out].some((x) => !Number.isFinite(x))) return null;
  return { hit, miss, out, source: process.env.BABEL_PRICE_SOURCE ?? "set in .env.local" };
}
export const costOf = (e: UsageEntry, p: NonNullable<Prices>) =>
  (e.cacheHitTokens * p.hit + e.cacheMissTokens * p.miss + e.outputTokens * p.out) / 1_000_000;
