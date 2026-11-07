// A2A agent for the store (SPEC §8): Agent Card + an executor over babel/tools. No LLM: a structured call is a
// data part {skill, args}; plain text is treated as a search query (untrusted, only ever matched against the catalog).
import { randomUUID } from "node:crypto";
import { Role, type AgentCard, type Message, type Part } from "@a2a-js/sdk";
import { AgentEvent, DefaultRequestHandler, InMemoryTaskStore, type AgentExecutor } from "@a2a-js/sdk/server";
import { callTool, ToolError, tools } from "@/babel/tools";

const examples: Record<string, string[]> = {
  search_products: ['{"skill":"search_products","args":{"query":"washing machine","maxPrice":2500}}', "quiet washing machine under 2500 lei"],
  get_product: ['{"skill":"get_product","args":{"id":"home-wm-01"}}'],
  compare_products: ['{"skill":"compare_products","args":{"ids":["home-wm-01","home-wm-02"]}}'],
  get_store_policies: ['{"skill":"get_store_policies"}'],
  create_handoff_link: ['{"skill":"create_handoff_link","args":{"ids":["home-wm-01"],"note":"Quietest one in budget"}}'],
};

export const agentCard = (origin: string): AgentCard => ({
  name: "Taraba shopping agent (Babel)",
  description: "Read-only access to the Taraba catalog (synthetic demo store). Same prices and promotions as human shoppers; no negotiation. "
    + "Send a data part {skill, args} for a structured call, or plain text to search.",
  supportedInterfaces: [{ url: `${origin}/api/a2a`, protocolBinding: "JSONRPC", tenant: "", protocolVersion: "1.0" }],
  provider: { organization: "Babel (hackathon demo)", url: origin },
  version: "0.1.0",
  capabilities: { streaming: false, pushNotifications: false, extensions: [] },
  securitySchemes: {},
  securityRequirements: [],
  defaultInputModes: ["application/json", "text/plain"],
  defaultOutputModes: ["application/json"],
  skills: Object.entries(tools).map(([id, t]) => ({
    id, name: id, description: t.description, tags: ["shopping", "catalog"], examples: examples[id] ?? [],
    inputModes: ["application/json"], outputModes: ["application/json"], securityRequirements: [],
  })),
  signatures: [],
});

const part = (content: Part["content"]): Part => ({ content, metadata: undefined, filename: "", mediaType: "" });

function answer(parts: Part[]): Part[] {
  const data = parts.find((p) => p.content?.$case === "data")?.content?.value as { skill?: unknown; args?: unknown } | undefined;
  const text = parts.map((p) => (p.content?.$case === "text" ? p.content.value : "")).join(" ").trim();
  try {
    if (data?.skill) return [part({ $case: "data", value: { skill: data.skill, result: callTool(String(data.skill), data.args) } })];
    if (text) return [part({ $case: "data", value: { skill: "search_products", result: callTool("search_products", { query: text.slice(0, 500) }) } })];
    throw new ToolError(`Send a data part {skill, args}. Skills: ${Object.keys(tools).join(", ")}`);
  } catch (e) {
    if (!(e instanceof ToolError)) throw e;
    return [part({ $case: "data", value: { error: e.message } })];
  }
}

const executor: AgentExecutor = {
  async execute(ctx, bus) {
    const reply: Message = {
      messageId: randomUUID(), contextId: ctx.contextId, taskId: "", role: Role.ROLE_AGENT,
      parts: answer(ctx.userMessage.parts), metadata: { generatedBy: "Babel agent gateway (no LLM)" }, extensions: [], referenceTaskIds: [],
    };
    bus.publish(AgentEvent.message(reply));
    bus.finished();
  },
  async cancelTask() {},
};

const handlers = new Map<string, DefaultRequestHandler>();
export function requestHandler(origin: string) {
  if (!handlers.has(origin)) handlers.set(origin, new DefaultRequestHandler(agentCard(origin), new InMemoryTaskStore(), executor));
  return handlers.get(origin)!;
}
