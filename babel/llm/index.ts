// The only module that calls DeepSeek (AGENTS.md rule 5). Records usage for the cost meter.
// With no DEEPSEEK_API_KEY (or BABEL_LLM=mock) every call is answered by the caller's mock.
import OpenAI from "openai";
import { loadAll, put } from "@/babel/session/db";
import type { ChatCompletionMessage, ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

export type { ChatCompletionMessage, ChatCompletionMessageParam, ChatCompletionTool };

export type UsageEntry = {
  at: string;
  agent: string;
  model: string;
  mocked: boolean;
  ms: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  outputTokens: number;
  error?: string;
};

type LlmState = { client?: OpenAI; usage: UsageEntry[] };
const g = globalThis as unknown as { __babelLlm?: LlmState };
// The usage log is the cost meter's source, so it is kept in the database and survives a restart.
const state: LlmState = (g.__babelLlm ??= { usage: loadAll<UsageEntry>("llm_usage").map(([, u]) => u) });

export const isMocked = () => !process.env.DEEPSEEK_API_KEY || process.env.BABEL_LLM === "mock";

function client(): OpenAI {
  return (state.client ??= new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    maxRetries: 0, // agents have their own time budget and fall back to "hold"
  }));
}

export type ChatArgs = {
  agent: string;
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  signal?: AbortSignal;
  mock: () => ChatCompletionMessage; // deterministic answer used when mocked
};

export async function chat(args: ChatArgs): Promise<ChatCompletionMessage> {
  const started = Date.now();
  const model = process.env.DEEPSEEK_MODEL ?? "";
  const entry: UsageEntry = {
    at: new Date().toISOString(), agent: args.agent, model: isMocked() ? "mock" : model,
    mocked: isMocked(), ms: 0, cacheHitTokens: 0, cacheMissTokens: 0, outputTokens: 0,
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
    put("llm_usage", [[`${entry.at}-${state.usage.length}`, entry]]);
  }
}

export const usageLog = (): readonly UsageEntry[] => state.usage;
