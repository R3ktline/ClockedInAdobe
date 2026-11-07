// Demo buyer agent (SPEC §8): an LLM shops the store over A2A, one skill call per turn, and hands a shortlist back.
// Usage: npm run buyer-agent -- "quiet washing machine under 2500 lei"   (needs `npm run dev`; BABEL_URL overrides :3000)
// Mocked like every agent when DEEPSEEK_API_KEY is unset or BABEL_LLM=mock; the A2A calls are always real.
import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Role } from "@a2a-js/sdk";
import { ClientFactory } from "@a2a-js/sdk/client";
import { chat, isMocked, usageLog, type ChatCompletionMessage, type ChatCompletionMessageParam, type ChatCompletionTool } from "../babel/llm/index.ts";

const origin = process.env.BABEL_URL ?? "http://localhost:3000";
const goal = process.argv.slice(2).join(" ").trim().slice(0, 500) || "quiet washing machine under 2500 lei";
const MAX_CALLS = 8;
const SYSTEM_PROMPT = readFileSync(path.join(process.cwd(), "prompts", "buyer-agent.md"), "utf8");

type Json = Record<string, unknown>;
type Summary = { id: string; name: string; price: number; rating: number };

const client = await new ClientFactory().createFromUrl(origin).catch((e: unknown) => {
  console.error(`Could not read ${origin}/.well-known/agent-card.json (is \`npm run dev\` running?)\n${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
const card = await client.getAgentCard();
console.log(`Agent card: ${card.name}, A2A ${client.protocolVersion}`);
console.log(`Skills: ${card.skills.map((s) => s.id).join(", ")}`);
console.log(`LLM: ${isMocked() ? "mock" : process.env.DEEPSEEK_MODEL}`);
console.log(`Goal: ${goal}\n`);

// The card carries descriptions and examples, not arg schemas, so the model learns the args from the examples.
const tools: ChatCompletionTool[] = card.skills.map((s) => ({
  type: "function",
  function: {
    name: s.id,
    description: `${s.description} Example A2A data part: ${s.examples[0] ?? "{}"}`,
    parameters: { type: "object", additionalProperties: true },
  },
}));

async function send(skill: string, args: Json): Promise<Json> {
  const res = await client.sendMessage({
    tenant: "", configuration: undefined, metadata: undefined,
    message: {
      messageId: randomUUID(), contextId: "", taskId: "", role: Role.ROLE_USER, metadata: undefined, extensions: [], referenceTaskIds: [],
      parts: [{ content: { $case: "data", value: { skill, args } }, metadata: undefined, filename: "", mediaType: "" }],
    },
  });
  const parts = "parts" in res ? res.parts : res.status?.message?.parts ?? [];
  const data = parts.find((p) => p.content?.$case === "data")?.content;
  return data?.$case === "data" ? (data.value as Json) : { error: "The store answered without a data part" };
}

const brief = (r: Summary) => `${r.id.padEnd(12)} ${r.name.slice(0, 40).padEnd(40)} ${String(r.price).padStart(6)} RON  ★${r.rating}`;
function show(skill: string, reply: Json) {
  if (reply.error) return `  ✗ ${reply.error}`;
  const r = reply.result as Json;
  if (skill === "search_products") return [`  ${r.total} match(es)`, ...(r.results as Summary[]).map((x) => `  · ${brief(x)}`)].join("\n");
  if (skill === "get_product") return `  · ${brief(r as Summary)}`;
  if (skill === "compare_products") {
    const rows = (r.rows as { label: string; values: (string | null)[]; differs: boolean }[]).filter((x) => x.differs);
    return rows.map((x) => `  ${x.label.padEnd(24)} ${x.values.map((v) => String(v ?? "-").slice(0, 21).padEnd(22)).join("")}`).join("\n");
  }
  if (skill === "create_handoff_link") return `  → ${origin}${r.url}`;
  return `  ${JSON.stringify(r).slice(0, 300)}`;
}

// Deterministic shopper for mock mode: search, open the top hit, compare the top two, hand off.
const done: { skill: string; reply: Json }[] = [];
function mockTurn(): ChatCompletionMessage {
  const say = (content: string): ChatCompletionMessage => ({ role: "assistant", content, refusal: null });
  const call = (name: string, args: Json): ChatCompletionMessage => ({
    role: "assistant", content: null, refusal: null,
    tool_calls: [{ id: `mock-${done.length}`, type: "function", function: { name, arguments: JSON.stringify(args) } }],
  });
  const search = done.find((d) => d.skill === "search_products");
  const ids = ((search?.reply.result as Json | undefined)?.results as Summary[] | undefined ?? []).slice(0, 3).map((r) => r.id);
  const did = (skill: string) => done.some((d) => d.skill === skill);
  const maxPrice = Number(goal.match(/\d{3,}/)?.[0]) || undefined;
  if (!search) return call("search_products", { query: goal.replace(/\d+/g, " "), maxPrice });
  if (!ids.length) return say("Nothing in the store matches that goal.");
  if (!did("get_product")) return call("get_product", { id: ids[0] });
  if (ids.length > 1 && !did("compare_products")) return call("compare_products", { ids: ids.slice(0, 2) });
  if (!did("create_handoff_link")) return call("create_handoff_link", { ids: ids.slice(0, 2), note: `Top matches for "${goal}" (mock agent)` });
  return say("Here is your shortlist. Open the link to see the products in the store.");
}

const messages: ChatCompletionMessageParam[] = [
  { role: "system", content: SYSTEM_PROMPT },
  { role: "user", content: `<user_message>${goal}</user_message>` },
];
let handoff: string | undefined;

for (let turn = 0; turn <= MAX_CALLS; turn++) {
  const msg = await chat({ agent: "buyer-agent", messages, tools: done.length < MAX_CALLS ? tools : undefined, mock: mockTurn });
  messages.push(msg);
  const calls = (msg.tool_calls ?? []).filter((c) => c.type === "function");
  if (!calls.length) {
    console.log(`Agent: ${msg.content ?? "(no answer)"}`);
    break;
  }
  for (const c of calls) {
    let args: Json;
    try { args = JSON.parse(c.function.arguments || "{}"); } catch { args = {}; }
    if (args.args && typeof args.args === "object") args = args.args as Json; // model copied the {skill, args} example shape
    console.log(`[${done.length + 1}] ${c.function.name} ${JSON.stringify(args)}`);
    const reply = await send(c.function.name, args).catch((e: unknown): Json => ({ error: e instanceof Error ? e.message : String(e) }));
    console.log(show(c.function.name, reply));
    done.push({ skill: c.function.name, reply });
    if (c.function.name === "create_handoff_link" && !reply.error) handoff = `${origin}${(reply.result as Json).url}`;
    messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(reply).slice(0, 8000) });
  }
}

const u = usageLog();
console.log(`\n${done.length} A2A call(s), ${u.length} LLM call(s), tokens in ${u.reduce((s, e) => s + e.cacheHitTokens + e.cacheMissTokens, 0)} (cache hit ${u.reduce((s, e) => s + e.cacheHitTokens, 0)}), out ${u.reduce((s, e) => s + e.outputTokens, 0)}`);
console.log(handoff ? `Hand-off link: ${handoff}` : "No hand-off link was made.");
process.exit(handoff ? 0 : 1);
