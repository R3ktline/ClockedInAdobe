// Review picker: DeepSeek chooses WHICH of a product's reviews best summarise what buyers say. It writes
// nothing: the store renders the chosen reviews verbatim from the catalog (AGENTS.md rule 2). Ids are
// validated in code; any failure falls back to a deterministic pick (rule 11).
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { chat, isMocked, type ChatCompletionMessage } from "@/babel/llm";
import type { Product } from "@/babel/schema";

const SYSTEM_PROMPT = readFileSync(path.join(process.cwd(), "prompts", "reviews.md"), "utf8");
const MAX_PICKS = 3;
const BUDGET_MS = Number(process.env.BABEL_REVIEWS_BUDGET_MS ?? 6_000);

const Pick = z.object({ ids: z.array(z.string()).min(1).max(MAX_PICKS) });
const TOOLS = [{
  type: "function" as const,
  function: {
    name: "pickReviews",
    description: "Pick up to 3 review ids that give the fairest summary.",
    parameters: { type: "object", properties: { ids: { type: "array", items: { type: "string" }, maxItems: MAX_PICKS } }, required: ["ids"] },
  },
}];

export type ReviewPicks = { indexes: number[]; source: "model" | "fallback"; mocked: boolean };

// Lowest-rated first (the criticism), then the highest-rated, de-duplicated.
export function fallbackPicks(reviews: Product["reviews"]): number[] {
  const order = reviews.map((r, i) => ({ r, i }));
  const low = [...order].sort((a, b) => a.r.rating - b.r.rating || a.i - b.i)[0];
  const high = [...order].sort((a, b) => b.r.rating - a.r.rating || a.i - b.i);
  return [...new Set([low, ...high].filter(Boolean).map((x) => x.i))].slice(0, MAX_PICKS);
}

export async function pickReviews(product: Product): Promise<ReviewPicks> {
  const mocked = isMocked();
  const fallback = (): ReviewPicks => ({ indexes: fallbackPicks(product.reviews), source: "fallback", mocked });
  if (!product.reviews.length) return { indexes: [], source: "fallback", mocked };
  const data = product.reviews.map((r, i) => ({ id: `r${i}`, rating: r.rating, title: r.title, text: r.text }));
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), BUDGET_MS);
  try {
    const msg = await chat({
      agent: "reviews", tools: TOOLS, signal: abort.signal,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: `<data>\n${JSON.stringify(data)}\n</data>` }],
      mock: (): ChatCompletionMessage => ({
        role: "assistant", content: null, refusal: null,
        tool_calls: [{ id: "mock-reviews", type: "function", function: { name: "pickReviews", arguments: JSON.stringify({ ids: fallbackPicks(product.reviews).map((i) => `r${i}`) }) } }],
      }),
    });
    const call = msg.tool_calls?.find((c) => c.type === "function" && c.function.name === "pickReviews");
    const args = call && call.type === "function" ? Pick.safeParse(safeJson(call.function.arguments)) : null;
    if (!args?.success) return fallback();
    const indexes = [...new Set(args.data.ids.map((id) => /^r(\d+)$/.exec(id)?.[1]).map((n) => (n === undefined ? -1 : Number(n))))]
      .filter((i) => i >= 0 && i < product.reviews.length);
    return indexes.length ? { indexes, source: "model", mocked } : fallback();
  } catch {
    return fallback();
  } finally {
    clearTimeout(timer);
  }
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return undefined; }
}
