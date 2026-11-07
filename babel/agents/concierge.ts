// The Concierge (SPEC §6.2): the shopper's chat. Input guard first (refusals by code, not a model), then catalog
// tools, then one `respond` with a 1-2 sentence reply and an optional view change for the open page. The reply is
// policy-checked and grounded in the tool results; a failing reply is replaced by one built in code.
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { chat, isMocked, modelName, type ChatCompletionMessage, type ChatCompletionMessageParam, type ChatCompletionTool } from "@/babel/llm";
import { ExplicitChange, type Product, type View } from "@/babel/schema";
import { guardInput } from "@/babel/guardrails/input";
import { checkText } from "@/babel/guardrails/policy";
import { checkGrounding } from "@/babel/guardrails/grounding";
import { callTool, ToolError, tools } from "@/babel/tools";
import { changeOpenPage, clock, onScreen, type StoreCfg, type TraceEntry, type Visit } from "@/babel/session";
import { productById } from "@/data/catalog";

const SYSTEM_PROMPT = readFileSync(path.join(process.cwd(), "prompts", "concierge.md"), "utf8");
const BUDGET_MS = Number(process.env.BABEL_CONCIERGE_BUDGET_MS ?? 15_000);
const MAX_ROUNDS = 5, MAX_LOOKUPS = 3;
const READ_TOOLS = ["search_products", "get_product", "compare_products", "get_store_policies"] as const;

const schema = (s: z.ZodType) => { const { $schema: _d, ...rest } = z.toJSONSchema(s) as Record<string, unknown>; return rest; };
const Respond = z.object({ reply: z.string().min(1).max(400), change: ExplicitChange.optional() });
const TOOLS: ChatCompletionTool[] = [
  ...READ_TOOLS.map((name) => ({ type: "function" as const, function: { name, description: tools[name].description, parameters: schema(tools[name].input) } })),
  { type: "function", function: { name: "respond", description: "Your final answer to the shopper, with an optional change to the open page.", parameters: schema(Respond) } },
];

export type ConciergeResult = {
  reply: string;
  view?: View;
  changes?: string[];
  why?: string[];
  refused?: string;
  replaced?: string[];  // why the model's own reply was not shown
  llm: NonNullable<TraceEntry["llm"]>;
  mocked: boolean;
};

const lei = (n: number) => `${Math.round(n)} lei`;
const safeJson = (s: string) => { try { return JSON.parse(s) as Record<string, unknown>; } catch { return undefined; } };

/** A reply built in code from what the tools returned: always true, sometimes plain. */
function fallbackReply(results: unknown[]): string {
  for (const r of [...results].reverse()) {
    const rr = r as { results?: { name: string; price: number }[]; name?: string; price?: number; policies?: Product["policies"] };
    if (rr?.results?.length) return `I found ${rr.results.slice(0, 3).map((p) => `${p.name} (${lei(p.price)})`).join(", ")}.`;
    if (rr?.name && rr.policies) return `${rr.name}: ${rr.policies.returnDays} days to return, ${rr.policies.warrantyMonths} months warranty, delivery in ${rr.policies.deliveryDays} days.`;
  }
  return "I couldn't answer that reliably from the catalog. Try asking about one product or one change to the page.";
}

export async function runConcierge(v: Visit, cfg: StoreCfg, pageId: string, message: string): Promise<ConciergeResult> {
  const llm: ConciergeResult["llm"] = { model: modelName(), input: "", rounds: [] };
  const page = v.pages.find((p) => p.id === pageId);
  const at = clock(v);
  const guarded = guardInput(message);
  if (!guarded.ok) {
    v.trace.push({ at, kind: "guard", page: page?.index, text: `chat refused by the input guard (${guarded.refuse})` });
    return { reply: guarded.reply, refused: guarded.refuse, llm, mocked: isMocked() };
  }
  if (!page) return { reply: "Please reload the page and ask again.", llm, mocked: isMocked() };
  const shown = onScreen(page);
  const product = page.productId ? productById(page.productId) : undefined;
  const input = JSON.stringify({
    page: { type: page.template, product: product && { id: product.id, name: product.name, category: product.category } },
    onScreen: { dialect: shown.persona.dialect, need: shown.persona.need, skin: shown.skin, copyRegister: shown.copyRegister, typeScale: shown.theme.typeScale, blocks: shown.blocks.map(({ id, variant, collapsed }) => ({ id, variant, ...(collapsed ? { collapsed } : {}) })) },
    personalDetailRemoved: guarded.removedPersonal || undefined,
  });
  llm.input = `${input}\n<user_message>${guarded.clean}</user_message>`;
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `STORE VOICE ${JSON.stringify(cfg.brand.voice)}\nREGISTRY for this page type ${JSON.stringify(cfg.registry[page.template])}` },
    { role: "user", content: `<data>\n${input}\n</data>\n<user_message>\n${guarded.clean.replace(/<\/?[a-z_]+>/gi, "")}\n</user_message>` },
  ];
  const results: unknown[] = [];
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), BUDGET_MS);
  let lookups = 0;
  try {
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const t0 = Date.now();
      const msg = await chat({ agent: "concierge", messages, tools: TOOLS, signal: abort.signal, mock: () => mockTurn(guarded.clean, page.productId, results, round) });
      messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
      const calls = (msg.tool_calls ?? []).filter((c) => c.type === "function");
      const said = (msg.content ?? "").slice(0, 1000);
      const log = (verdict: string, call?: { name: string; args: unknown }) => llm.rounds.push({ said, call, verdict, ms: Date.now() - t0 });
      if (!calls.length) {
        // A plain-text answer is treated as a reply with no change.
        log("text answer");
        return finish(v, cfg, page.id, { reply: said || fallbackReply(results) }, results, llm, at);
      }
      const [call, ...extra] = calls;
      const args = safeJson(call.function.arguments);
      for (const c of extra) messages.push({ role: "tool", tool_call_id: c.id, content: "ignored: one call per turn" });
      if (call.function.name === "respond") {
        const r = Respond.safeParse(args);
        if (!r.success) { log("respond rejected (schema)", { name: "respond", args }); messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ ok: false, errors: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }) }); continue; }
        log("respond", { name: "respond", args });
        return finish(v, cfg, page.id, r.data, results, llm, at);
      }
      let content: unknown;
      if (!(READ_TOOLS as readonly string[]).includes(call.function.name)) content = { error: "unknown tool" };
      else if (++lookups > MAX_LOOKUPS) content = { error: "no more lookups; respond now" };
      else {
        try { content = callTool(call.function.name, args ?? {}, v.store); results.push(content); }
        catch (e) { content = { error: e instanceof ToolError ? e.message : "tool failed" }; }
      }
      log("lookup", { name: call.function.name, args });
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(content).slice(0, 6000) });
    }
    return finish(v, cfg, page.id, { reply: fallbackReply(results) }, results, llm, at);
  } catch (e) {
    const reason = abort.signal.aborted ? "timeout" : `llm error: ${e instanceof Error ? e.message : String(e)}`;
    llm.rounds.push({ said: "", verdict: reason, ms: 0 });
    v.trace.push({ at, kind: "guard", page: page.index, text: `chat: ${reason}`, llm });
    return { reply: "I can't reach my assistant just now, so the page stays as it is. Please try again in a moment.", llm, mocked: isMocked() };
  } finally {
    clearTimeout(timer);
  }
}

function finish(v: Visit, cfg: StoreCfg, pageId: string, r: z.infer<typeof Respond>, results: unknown[], llm: ConciergeResult["llm"], at: number): ConciergeResult {
  const problems = [...checkText(r.reply, "reply", cfg.brand), ...checkGrounding(r.reply, results)];
  let reply = problems.length ? fallbackReply(results) : r.reply;
  let view: View | undefined, changes: string[] | undefined, why: string[] | undefined;
  if (r.change && Object.keys(r.change).length) {
    const done = changeOpenPage(v, pageId, cfg, { action: "explicit", change: r.change, via: "chat" });
    if (done.ok) ({ view, changes, why } = done);
    else reply = `${reply} I couldn't change the page that way.`;
  }
  v.trace.push({ at, kind: problems.length ? "guard" : "explicit", text: problems.length ? `chat reply replaced: ${problems.join("; ")}` : `chat answered${view ? " and changed the page" : ""}`, llm, diff: changes });
  return { reply, view, changes, why, replaced: problems.length ? problems : undefined, llm, mocked: isMocked() };
}

// ---------------------------------------------------------------- deterministic stand-in (no key)
function mockTurn(text: string, productId: string | undefined, results: unknown[], round: number): ChatCompletionMessage {
  const call = (name: string, args: unknown): ChatCompletionMessage => ({
    role: "assistant", content: null, refusal: null,
    tool_calls: [{ id: `mock-c-${round}`, type: "function", function: { name, arguments: JSON.stringify(args) } }],
  });
  const t = text.toLowerCase();
  const respond = (reply: string, change?: z.infer<typeof ExplicitChange>) => call("respond", { reply, ...(change ? { change } : {}) });
  if (/simpl|easier|bigger text|larger text|hard to read|plain/.test(t)) return respond("I made the page simpler, with larger text and plain words.", { dialect: "guided" });
  if (/smaller text|less big/.test(t)) return respond("I made the text a little smaller.", { typeScaleStep: -1 });
  if (/(more|all|full) (detail|spec)|technical|everything/.test(t)) return respond("The page now shows every specification and a comparison.", { dialect: "dense", need: "specs" });
  if (/(bigger|more|larger) (photo|picture|image)/.test(t)) return respond("The page now leads with bigger pictures.", { dialect: "visual", need: "inspiration" });
  if (/\bdark\b/.test(t)) return respond("I switched the page to the dark style.", { skin: "alphadark" });
  if (/standard|normal|usual|original/.test(t)) return respond("I put the page back to the store's usual layout.", { dialect: "standard", need: "balanced", skin: "none" });
  if (/return|warrant|refund|deliver/.test(t) && productId) {
    if (!results.length) return call("get_product", { id: productId });
    const p = results[0] as { name: string; policies: Product["policies"] };
    return respond(`${p.name}: ${p.policies.returnDays} days to return it and ${p.policies.warrantyMonths} months of warranty. Returns and warranty now come first on the page.`, { need: "reassurance" });
  }
  if (/compare|differen|vs\b/.test(t) && productId) return respond("I added a comparison with similar products to the page.", { changes: [{ id: "compare", variant: "similar" }] });
  if (!results.length) {
    const max = Number(t.match(/(\d{2,6})\s*(lei|ron)?/)?.[1]) || undefined;
    return call("search_products", { query: t.replace(/\d+/g, " ").slice(0, 200), ...(max ? { maxPrice: max } : {}), limit: 3 });
  }
  const r = results[0] as { results?: { name: string; price: number }[] };
  if (!r.results?.length) return respond("I couldn't find a product in this store that matches that.");
  return respond(`I found ${r.results.slice(0, 3).map((p) => `${p.name} (${lei(p.price)})`).join(", ")}.`);
}
