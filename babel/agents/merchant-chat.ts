// Merchant chat: the merchant writes what they want changed on the page they picked in the panel; the agent
// answers in plain words and can apply it as the store's starting view, or undo an active default. It may only
// pick changes the Director actually measured on that page type (candidates from ./insights) — it cannot invent
// a change (AGENTS.md rule 1). Same hard gates everywhere: zod → measured candidates → validator → at most 4
// blocks, one per block → banned wording (GUARDRAILS §3). A person's explicit request lowers only the
// statistical bar (BABEL_MERCHANT_MIN_VISITS, default 1) never the validation bar; everything else the analyst
// gate (BABEL_INSIGHTS_MIN_*) still marks as `backed` in the data the model sees.
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { chat, isMocked, type ChatCompletionMessage, type ChatCompletionTool } from "@/babel/llm";
import { changedBlocks, validateSlide } from "@/babel/guardrails/validateSlide";
import { buildSlide, NEUTRAL_PERSONA } from "@/babel/persona";
import type { BrandKit, Registry, Template } from "@/babel/schema";
import type { Visit } from "@/babel/session";
import { activeDefaults, addDefault, revertDefault, withDefaults, type StoreDefault } from "@/babel/session/defaults";
import { aggregate, BANNED, evidenceLine, say, type Group } from "./insights";

const SYSTEM_PROMPT = readFileSync(path.join(process.cwd(), "prompts", "merchant-chat.md"), "utf8");
const BUDGET_MS = Number(process.env.BABEL_MERCHANT_BUDGET_MS ?? 15_000);
const MAX_BLOCKS = 4; // same size as a minor slide's change budget

// The bar an explicitly requested change must clear before it is applied at all. Far below the analyst's
// share-of-sessions gate on purpose: the merchant is a human deciding in the loop, not a running shopper.
// The data also labels which candidates are `backed` by the full insight bar, so the model can be honest.
const floor = () => Number(process.env.BABEL_MERCHANT_MIN_VISITS ?? 1);
const insightBar = () => ({
  minVisits: Number(process.env.BABEL_INSIGHTS_MIN_VISITS ?? 3),
  minShare: Number(process.env.BABEL_INSIGHTS_MIN_SHARE ?? 0.4),
});

const Propose = z.object({ keys: z.array(z.string()).min(1).max(MAX_BLOCKS), rationale: z.string().min(1).max(300) });
const Revert = z.object({ ids: z.array(z.string().min(1)).min(1).max(MAX_BLOCKS), rationale: z.string().min(1).max(300) });
const Reply = z.object({ said: z.string().min(1).max(500) });

const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "proposeDefault",
      description: "Make these measured changes the starting view for this page type, from the next visit.",
      parameters: {
        type: "object",
        properties: { keys: { type: "array", items: { type: "string" }, maxItems: MAX_BLOCKS }, rationale: { type: "string", maxLength: 300 } },
        required: ["keys", "rationale"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "revertDefault",
      description: "Undo active store defaults on this page type, by id from `startingView`.",
      parameters: {
        type: "object",
        properties: { ids: { type: "array", items: { type: "string" }, maxItems: MAX_BLOCKS }, rationale: { type: "string", maxLength: 300 } },
        required: ["ids", "rationale"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reply",
      description: "Change nothing and answer the merchant in plain words.",
      parameters: { type: "object", properties: { said: { type: "string", maxLength: 500 } }, required: ["said"] },
    },
  },
];

export type MerchantChatCfg = { registry: Registry; brand: BrandKit };

export type MerchantChatResult = {
  store?: string;
  template?: Template;
  outcome: "applied" | "reverted" | "answer" | "hold";
  said: string; // plain words for the merchant
  applied?: StoreDefault;
  reverted?: string[];
  evidence: string[];
};

const hold = (store?: string, template?: Template, said = "Nothing changed."): MerchantChatResult => ({ store, template, outcome: "hold", said, evidence: [] });

const safeJson = (s: string): unknown => {
  try { return JSON.parse(s); } catch { return undefined; }
};

export async function merchantChat(args: { text: string; visitId?: string; visits: Visit[]; cfg?: MerchantChatCfg }): Promise<MerchantChatResult> {
  const visit = (args.visitId ? args.visits.find((v) => v.id === args.visitId) : undefined) ?? args.visits[0];
  if (!visit) return { outcome: "answer", said: "No shopper sessions yet — replay one of the ghost shoppers first, then ask me about the page.", evidence: [] };
  const cfg = args.cfg;
  if (!cfg) return { store: visit.store, template: visit.template, outcome: "answer", said: `I do not know the layout of ${visit.store} yet.`, evidence: [] };

  const group = aggregate(args.visits).find((g) => g.store === visit.store && g.template === visit.template);
  const active = activeDefaults(visit.store, visit.template);
  const covered = new Set(active.flatMap((d) => d.changes.map((c) => c.id)));
  const persona = visit.slides.at(-1)?.persona;
  const bar = insightBar();
  const candidates = (group?.candidates ?? [])
    .filter((c) => c.visits >= floor())
    .map((c) => ({
      key: c.key,
      block: c.change.id,
      change: say(c.change),
      sessions: c.visits,
      share: Math.round(c.share * 100) / 100,
      betsMet: `${c.met}/${c.scored}`,
      pressedBack: `${c.undone}/${c.slides}`,
      backed: c.visits >= bar.minVisits && c.share >= bar.minShare,
      alreadyStarting: covered.has(c.change.id),
    }));

  const data = {
    page: visit.template,
    store: visit.store,
    simulated: group?.simulated ?? true,
    view: { dialect: persona?.dialect, need: persona?.need, markers: Object.entries(visit.markers).sort((a, b) => b[1].value - a[1].value).slice(0, 3).map(([id, m]) => `${id} ${Math.round(m.value * 100) / 100}`) },
    startingView: active.map((d) => ({ id: d.id, changes: d.changes.map(say), rationale: d.rationale })),
    candidates,
  };

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), BUDGET_MS);
  let msg: ChatCompletionMessage;
  try {
    msg = await chat({
      agent: "merchant-chat", tools: TOOLS, signal: abort.signal,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `<user_message>\n${args.text}\n</user_message>\n<data>\n${JSON.stringify(data, null, 1)}\n</data>` },
      ],
      mock: () => mockAnswer(args.text, group, active, covered, visit.template, visit.store),
    });
  } catch {
    return hold(visit.store, visit.template, abort.signal.aborted ? "The agent ran out of time, so nothing changed." : "The agent could not answer right now, so nothing changed.");
  } finally {
    clearTimeout(timer);
  }

  const call = msg.tool_calls?.find((c) => c.type === "function");
  if (!call || call.type !== "function") return hold(visit.store, visit.template, "The agent answered without a decision, so nothing changed.");
  const raw = safeJson(call.function.arguments);

  if (call.function.name === "reply") {
    const r = Reply.safeParse(raw);
    return r.success
      ? { store: visit.store, template: visit.template, outcome: "answer", said: r.data.said, evidence: [] }
      : hold(visit.store, visit.template, "The agent's answer was out of shape, so nothing changed.");
  }

  if (call.function.name === "revertDefault") {
    const r = Revert.safeParse(raw);
    if (!r.success) return hold(visit.store, visit.template, "The undo request was malformed, so nothing changed.");
    if (BANNED.test(r.data.rationale)) return hold(visit.store, visit.template, "The answer used wording the store cannot send, so nothing changed.");
    const targets = [...new Set(r.data.ids)].filter((id) => active.some((d) => d.id === id && d.store === visit.store && d.template === visit.template));
    const evidence = targets.flatMap((id) => active.find((d) => d.id === id)?.evidence ?? []);
    const reverted = targets.filter((id) => revertDefault(id));
    if (!reverted.length) return hold(visit.store, visit.template, "Those ids were not active on this page type, so nothing changed.");
    return { store: visit.store, template: visit.template, outcome: "reverted", said: r.data.rationale, reverted, evidence };
  }

  if (call.function.name === "proposeDefault") {
    const p = Propose.safeParse(raw);
    if (!p.success) return hold(visit.store, visit.template, "The proposal was malformed, so nothing changed.");
    if (BANNED.test(p.data.rationale)) return hold(visit.store, visit.template, "The proposal used wording the store cannot send, so nothing changed.");
    if (!group) return hold(visit.store, visit.template, "Nothing has been measured on this page type yet, so there is nothing to apply.");
    const picked = [...new Set(p.data.keys)].map((k) => group.candidates.find((c) => c.key === k));
    if (picked.some((c) => !c)) return hold(visit.store, visit.template, "The agent proposed a change nobody measured, so nothing changed.");
    const pickedCands = picked as NonNullable<(typeof picked)[number]>[];
    if (pickedCands.some((c) => c.visits < floor())) return hold(visit.store, visit.template, "The change was not there enough for even the merchant bar, so nothing changed.");
    if (new Set(pickedCands.map((c) => c.change.id)).size !== pickedCands.length) return hold(visit.store, visit.template, "The agent picked two changes for the same block, so nothing changed.");
    if (pickedCands.some((c) => covered.has(c.change.id))) return hold(visit.store, visit.template, "That block already is the starting view, so nothing changed.");

    const trial: StoreDefault = {
      id: "", store: visit.store, template: visit.template,
      changes: pickedCands.map((c) => c.change),
      rationale: p.data.rationale, evidence: [], simulated: group.simulated, mocked: isMocked(), at: 0, active: true,
    };
    const neutral = buildSlide({ persona: NEUTRAL_PERSONA, template: visit.template, registry: cfg.registry, brand: cfg.brand });
    const checked = validateSlide({ slide: withDefaults(neutral, [trial]), registry: cfg.registry, brand: cfg.brand, returning: false });
    if (!checked.ok) return hold(visit.store, visit.template, `The layout would not validate (${checked.errors.join("; ")}), so nothing changed.`);
    if (changedBlocks(neutral.blocks, checked.slide.blocks).length > MAX_BLOCKS) return hold(visit.store, visit.template, "It would change more than 4 blocks, so nothing changed.");

    const applied = addDefault({ ...trial, evidence: pickedCands.map((c) => evidenceLine(group, c)) });
    return { store: visit.store, template: visit.template, outcome: "applied", said: p.data.rationale, applied, evidence: applied.evidence };
  }

  return hold(visit.store, visit.template, "The agent used an unknown action, so nothing changed.");
}

// Deterministic stand-in without an API key: undo on request, otherwise the most measured candidate,
// or an honest "nothing measured" answer. Goes through the same validation as the real answer.
function mockAnswer(text: string, group: Group | undefined, active: StoreDefault[], covered: Set<string>, template: Template, store: string): ChatCompletionMessage {
  const tool = (name: string, args: Record<string, unknown>): ChatCompletionMessage => ({
    role: "assistant", content: null, refusal: null,
    tool_calls: [{ id: "mock-merchant-chat", type: "function", function: { name, arguments: JSON.stringify(args) } }],
  });
  const sessions = group ? `${group.sessions} ${group.simulated ? "simulated " : ""}sessions` : "no sessions";

  if (/\b(revert|undo|restore|take (it|that|them) back)\b/i.test(text) && active.length) {
    const newest = active[active.length - 1]; // activeDefaults keeps insertion order: newest last
    return tool("revertDefault", { ids: [newest.id], rationale: `Undone: ${newest.rationale} It is no longer the starting view for ${template} pages in ${store}.` });
  }
  const pick = (group?.candidates ?? [])
    .filter((c) => c.visits >= floor() && !covered.has(c.change.id))
    .sort((a, b) => b.visits - a.visits || a.key.localeCompare(b.key))[0];
  if (pick) {
    return tool("proposeDefault", {
      keys: [pick.key],
      rationale: `${pick.visits} of ${sessions} ended up with ${pick.change.id} ${say(pick.change)} — since you asked for it, that becomes the starting view from the next visit.`,
    });
  }
  return tool("reply", {
    said: `I have nothing measured on ${template} pages yet that I can confidently change (${sessions}, none changed this page). Ask again after a few more shoppers run, or name the page part differently.`,
  });
}
