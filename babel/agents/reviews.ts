// Review summariser: DeepSeek chooses WHICH of a product's reviews best sum up what buyers say and writes a
// short summary. The chosen reviews are rendered verbatim from the catalog. Ids and the summary are
// validated in code; any failure falls back to a deterministic pick with no summary (rule 11).
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { chat, isMocked, type ChatCompletionMessage } from "@/babel/llm";
import type { Product } from "@/babel/schema";

const SYSTEM_PROMPT = readFileSync(path.join(process.cwd(), "prompts", "reviews.md"), "utf8");
const MAX_PICKS = 3;
const BUDGET_MS = Number(process.env.BABEL_REVIEWS_BUDGET_MS ?? 6_000);

const Pick = z.object({ ids: z.array(z.string()).min(1).max(MAX_PICKS), summary: z.string().max(320).optional() });
const TOOLS = [{
  type: "function" as const,
  function: {
    name: "pickReviews",
    description: "Pick up to 3 review ids that give the fairest picture, and write a short summary of what buyers say.",
    parameters: {
      type: "object",
      properties: { ids: { type: "array", items: { type: "string" }, maxItems: MAX_PICKS }, summary: { type: "string", maxLength: 320 } },
      required: ["ids", "summary"],
    },
  },
}];

export type ReviewPicks = { indexes: number[]; summary?: string; source: "model" | "fallback"; mocked: boolean };

// The one piece of model-written text on a product page (a deliberate exception to AGENTS.md rule 2, see
// DECISIONS). It may only describe the reviews: no digits or money/percent signs, so it cannot state a price,
// stock, rating or delivery claim. Anything else is dropped and the page shows the picked reviews alone.
export const safeSummary = (s: string | undefined) => {
  const t = s?.replace(/\s+/g, " ").trim();
  return t && t.length >= 20 && !/[\d€$£%<>]/.test(t) ? t : undefined;
};

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
        tool_calls: [{ id: "mock-reviews", type: "function", function: { name: "pickReviews", arguments: JSON.stringify({ ids: fallbackPicks(product.reviews).map((i) => `r${i}`), summary: mockSummary(product) }) } }],
      }),
    });
    const call = msg.tool_calls?.find((c) => c.type === "function" && c.function.name === "pickReviews");
    const args = call && call.type === "function" ? Pick.safeParse(safeJson(call.function.arguments)) : null;
    if (!args?.success) return fallback();
    const indexes = [...new Set(args.data.ids.map((id) => /^r(\d+)$/.exec(id)?.[1]).map((n) => (n === undefined ? -1 : Number(n))))]
      .filter((i) => i >= 0 && i < product.reviews.length);
    return indexes.length ? { indexes, summary: safeSummary(args.data.summary), source: "model", mocked } : fallback();
  } catch {
    return fallback();
  } finally {
    clearTimeout(timer);
  }
}

// Offline stand-in: restates the catalog's own pros and cons.
const mockSummary = (p: Product) =>
  `Buyers mostly praise ${p.reviewSummary.pros.join(", ")}. The main complaints are ${p.reviewSummary.cons.join(", ") || "few"}.`;

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return undefined; }
}
