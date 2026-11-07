// Catalog tools shared by buyer agents over A2A and MCP (SPEC §8). Read-only, no LLM, no personal data:
// every price, stock and promotion comes straight from the catalog, the same one humans see.
import { z } from "zod";
import { Category, type Product } from "@/babel/schema";
import { catalog, productById } from "@/data/catalog";

const text = z.string().trim().max(500); // GUARDRAILS input cap
const id = z.string().max(64);

const summary = (p: Product, store: string) => ({
  id: p.id,
  name: p.name,
  brand: p.brand,
  category: p.category,
  price: p.price,
  currency: "RON",
  promotion: p.promotion ?? null,
  inStock: p.stock > 0,
  stock: p.stock,
  rating: p.rating,
  reviewCount: p.reviewCount,
  deliveryDays: p.policies.deliveryDays,
  description: p.copy.technical,
  url: `/${store}/p/${p.id}`,
});

const searchInput = z.object({
  query: text.optional().describe("Words to match in name, brand, description or specs"),
  category: Category.optional(),
  maxPrice: z.number().positive().optional().describe("RON"),
  minPrice: z.number().min(0).optional().describe("RON"),
  minRating: z.number().min(0).max(5).optional(),
  inStockOnly: z.boolean().optional(),
  sort: z.enum(["relevance", "price_asc", "price_desc", "rating"]).optional(),
  limit: z.number().int().min(1).max(12).optional().describe("Default 6, max 12"),
});

const STOP = new Set(["and", "the", "for", "with", "under", "over", "your", "you", "lei", "ron", "want", "need", "some", "any"]);

function searchProducts(a: z.infer<typeof searchInput>, store: string) {
  const words = (a.query ?? "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !STOP.has(w));
  const hay = (p: Product) =>
    [p.name, p.brand, p.category, p.copy.technical, ...p.specs.map((s) => `${s.label} ${s.value}`)].join(" ").toLowerCase();
  const scored = catalog
    .filter((p) => (!a.category || p.category === a.category)
      && (a.maxPrice === undefined || p.price <= a.maxPrice)
      && (a.minPrice === undefined || p.price >= a.minPrice)
      && (a.minRating === undefined || p.rating >= a.minRating)
      && (!a.inStockOnly || p.stock > 0))
    // Name hits count double, so "washing machine" beats a toy that is merely washing-machine safe.
    .map((p) => ({ p, score: words.filter((w) => hay(p).includes(w)).length + 2 * words.filter((w) => p.name.toLowerCase().includes(w)).length }))
    .filter((x) => !words.length || x.score > 0);
  const by = {
    relevance: (x: (typeof scored)[0], y: (typeof scored)[0]) => y.score - x.score || y.p.rating - x.p.rating,
    price_asc: (x: (typeof scored)[0], y: (typeof scored)[0]) => x.p.price - y.p.price,
    price_desc: (x: (typeof scored)[0], y: (typeof scored)[0]) => y.p.price - x.p.price,
    rating: (x: (typeof scored)[0], y: (typeof scored)[0]) => y.p.rating - x.p.rating,
  }[a.sort ?? "relevance"];
  const results = scored.sort(by).slice(0, a.limit ?? 6).map((x) => summary(x.p, store));
  return { total: scored.length, results };
}

const getInput = z.object({ id });

function getProduct({ id }: z.infer<typeof getInput>, store: string) {
  const p = productById(id);
  if (!p) throw new ToolError(`No product with id "${id}"`);
  return {
    ...summary(p, store),
    specs: p.specs,
    benefits: p.benefits,
    reviewSummary: p.reviewSummary,
    policies: p.policies,
    reviewsNote: "Synthetic demo data (simulated).",
  };
}

const compareInput = z.object({ ids: z.array(id).min(2).max(4) });

function compareProducts({ ids }: z.infer<typeof compareInput>, store: string) {
  const ps = ids.map((i) => productById(i) ?? (() => { throw new ToolError(`No product with id "${i}"`); })());
  const keys = [...new Map(ps.flatMap((p) => p.specs.map((s) => [s.key, s.label] as const))).entries()];
  const rows = [
    { key: "price", label: "Price (RON)", values: ps.map((p) => String(p.price)) },
    { key: "rating", label: "Rating", values: ps.map((p) => String(p.rating)) },
    ...keys.map(([key, label]) => ({ key, label, values: ps.map((p) => p.specs.find((s) => s.key === key)?.value ?? null) })),
  ].map((r) => ({ ...r, differs: new Set(r.values).size > 1 }));
  return { products: ps.map((p) => summary(p, store)), rows };
}

function storePolicies() {
  const range = (f: (p: Product) => number) => {
    const v = catalog.map(f);
    return { min: Math.min(...v), max: Math.max(...v) };
  };
  return {
    note: "Policies are set per product; get_product returns the exact ones. Ranges across the catalog:",
    returnDays: range((p) => p.policies.returnDays),
    warrantyMonths: range((p) => p.policies.warrantyMonths),
    deliveryDays: range((p) => p.policies.deliveryDays),
    pricing: "Same prices and promotions for every shopper and every agent. No negotiation.",
    currency: "RON",
  };
}

const handoffInput = z.object({
  ids: z.array(id).min(1).max(6),
  note: text.optional().describe("Shown to the shopper as the agent's note"),
});

// On globalThis (like babel/session) so a page and a route bundled apart see the same map.
// shortcut: in-memory, lost on restart and not shared across server instances; persist it if hand-offs must survive.
const g = globalThis as unknown as { __babelHandoffs?: Map<string, { store: string; ids: string[]; note?: string; createdAt: string }> };
const handoffs = (g.__babelHandoffs ??= new Map());
export const getHandoff = (hid: string) => handoffs.get(hid);

function createHandoff(a: z.infer<typeof handoffInput>, store: string) {
  const missing = a.ids.filter((i) => !productById(i));
  if (missing.length) throw new ToolError(`Unknown product ids: ${missing.join(", ")}`);
  const hid = crypto.randomUUID().slice(0, 8);
  handoffs.set(hid, { store, ids: a.ids, note: a.note, createdAt: new Date().toISOString() });
  return {
    handoffId: hid,
    url: `/${store}/h/${hid}`, // the shortlist page, shown in the shopper's own view, same prices

    items: a.ids.map((i) => ({ id: i, url: `/${store}/p/${i}` })),
    message: "Give this link to the shopper. The store shows it in the view that suits them.",
  };
}

export class ToolError extends Error {}

type Tool<S extends z.ZodObject> = {
  description: string;
  input: S;
  run: (args: z.infer<S>, store: string) => unknown;
};
const tool = <S extends z.ZodObject>(t: Tool<S>) => t as unknown as Tool<z.ZodObject>;

export const tools = {
  search_products: tool({ description: "Search the store's catalog. Returns up to 12 products with catalog prices in RON.", input: searchInput, run: searchProducts }),
  get_product: tool({ description: "Full facts for one product: specs, benefits, review summary, return/warranty/delivery policy.", input: getInput, run: getProduct }),
  compare_products: tool({ description: "Spec matrix for 2-4 products; each row says whether the values differ.", input: compareInput, run: compareProducts }),
  get_store_policies: tool({ description: "Returns, warranty, delivery and pricing rules for the store.", input: z.object({}), run: storePolicies }),
  create_handoff_link: tool({ description: "Make a link that hands a shortlist back to the human shopper.", input: handoffInput, run: createHandoff }),
};
export type ToolName = keyof typeof tools;

/** Validate untrusted args and run a tool. Throws ToolError on bad input or unknown ids. */
export function callTool(name: string, args: unknown, store = "taraba") {
  const t = tools[name as ToolName];
  if (!t) throw new ToolError(`Unknown tool "${name}". Available: ${Object.keys(tools).join(", ")}`);
  const parsed = t.input.safeParse(args ?? {});
  if (!parsed.success) throw new ToolError(`Invalid arguments: ${z.prettifyError(parsed.error)}`);
  return t.run(parsed.data, store);
}

// shortcut: per-process fixed window, resets on restart; use a shared store (e.g. Redis) behind more than one instance.
const hits = new Map<string, { n: number; until: number }>();
export function rateLimited(key: string, max = 60, windowMs = 60_000) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.until < now) { hits.set(key, { n: 1, until: now + windowMs }); return false; }
  return ++h.n > max;
}
export const clientKey = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
