// Insights (SPEC §6.3): looks across ALL shoppers for changes the Director keeps making and that keep working,
// and proposes them as the store's starting view. Code does the counting and the gating; the model only
// chooses among candidates that already passed the gate (so it cannot invent a change) and writes the reason.
// A chosen default is validated again here and when it is applied (app/api/visit), and the merchant can revert it.
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { chat, isMocked, type ChatCompletionMessage, type ChatCompletionTool } from "@/babel/llm";
import { changedBlocks, validateSlide } from "@/babel/guardrails/validateSlide";
import { movedBlocks } from "@/babel/schema/diff";
import { buildSlide, NEUTRAL_PERSONA } from "@/babel/persona";
import type { BrandKit, Registry, Template } from "@/babel/schema";
import { listVisits, type Visit } from "@/babel/session";
import { activeDefaults, addDefault, withDefaults, type DefaultChange, type StoreDefault } from "@/babel/session/defaults";

const SYSTEM_PROMPT = readFileSync(path.join(process.cwd(), "prompts", "insights.md"), "utf8");
const BUDGET_MS = Number(process.env.BABEL_INSIGHTS_BUDGET_MS ?? 15_000);
const MAX_BLOCKS = 2; // same size as a minor slide's change budget
// Held back from the model's wording (GUARDRAILS §3, rule 8): no pressure tactics, no people-labels.
const BANNED = /\b(discount|sale|% off|countdown|hurry|limited stock|scarcity|urgen\w*|elderly|senior|young|older|boomer|gen z|millennial)\b/i;

// The bar a change must clear before the model sees it. Read per call so tests and demos can lower it.
const bar = () => ({
  minVisits: Number(process.env.BABEL_INSIGHTS_MIN_VISITS ?? 3),
  minShare: Number(process.env.BABEL_INSIGHTS_MIN_SHARE ?? 0.4),
});

export type Candidate = {
  key: string;
  change: DefaultChange; // order = the position most sessions moved it to, only if at least half of them moved it
  orders: number[];
  visits: number;  // sessions where the Director made this change
  share: number;   // visits / sessions on this page type
  slides: number;  // times it was made
  scored: number;  // times its bet was checked
  met: number;     // ... and came true
  undone: number;  // times the shopper pressed back while it was showing
};
export type Group = { store: string; template: Template; sessions: number; simulated: boolean; candidates: Candidate[] };

// Position is not part of the key: the same variant at slightly different positions is the same change.
const keyOf = (c: DefaultChange) => `${c.id}|${c.variant ?? "move"}${c.collapsed === undefined ? "" : c.collapsed ? "|collapsed" : "|expanded"}`;
const modal = (xs: number[]) => [...xs].sort((a, b) => xs.filter((x) => x === b).length - xs.filter((x) => x === a).length || a - b)[0];

// Count, per store and page type, which block changes the Director made across consented sessions.
export function aggregate(visits: Visit[]): Group[] {
  const groups = new Map<string, { g: Group; tally: Map<string, Candidate> }>();
  for (const v of visits) {
    if (!v.partner.consent.personalization) continue;
    const id = `${v.store}/${v.template}`;
    const entry = groups.get(id) ?? { g: { store: v.store, template: v.template, sessions: 0, simulated: true, candidates: [] }, tally: new Map() };
    groups.set(id, entry);
    entry.g.sessions++;
    entry.g.simulated &&= !!v.visitorId?.startsWith("ghost:");
    const seen = new Set<string>();
    for (const s of v.slides) {
      const parent = v.slides.find((x) => x.id === s.parentId);
      if (s.source !== "director" || !parent) continue;
      const result = v.trace.find((t) => t.kind === "result" && t.slideIndex === s.index);
      const from = v.slideAt[s.id]?.t ?? 0;
      const next = v.slides.find((x) => x.index === s.index + 1);
      const to = next ? v.slideAt[next.id]?.t ?? Infinity : Infinity;
      const undone = v.events.some((e) => e.type === "slide_prev" && e.t >= from && e.t < to);
      const moved = movedBlocks(parent.blocks, s.blocks);
      for (const bid of changedBlocks(parent.blocks, s.blocks)) {
        const b = s.blocks.find((x) => x.id === bid)!;
        const was = parent.blocks.find((x) => x.id === bid);
        const change: DefaultChange = {
          id: b.id,
          ...(was?.variant !== b.variant ? { variant: b.variant } : {}),
          ...(!!was?.collapsed !== !!b.collapsed ? { collapsed: !!b.collapsed } : {}),
        };
        const key = keyOf(change);
        const c = entry.tally.get(key) ?? { key, change, orders: [], visits: 0, share: 0, slides: 0, scored: 0, met: 0, undone: 0 };
        entry.tally.set(key, c);
        if (moved.has(bid)) c.orders.push(b.order);
        if (!seen.has(key)) { seen.add(key); c.visits++; }
        c.slides++;
        if (result) { c.scored++; if (result.met) c.met++; }
        if (undone) c.undone++;
      }
    }
  }
  return [...groups.values()].map(({ g, tally }) => ({
    ...g,
    candidates: [...tally.values()].map((c) => ({
      ...c, share: c.visits / g.sessions,
      change: c.orders.length * 2 >= c.slides ? { ...c.change, order: modal(c.orders) } : c.change,
    })),
  }));
}

// Frequent, not often undone, and not disproved by its own bet; and not already a default.
export function eligible(g: Group): Candidate[] {
  const { minVisits, minShare } = bar();
  const live = new Set(activeDefaults(g.store, g.template).flatMap((d) => d.changes.map(keyOf)));
  return g.candidates
    .filter((c) => c.visits >= minVisits && c.share >= minShare && !live.has(c.key))
    .filter((c) => c.undone / c.slides <= 1 / 3 && (c.scored === 0 || c.met / c.scored >= 0.5))
    .sort((a, b) => b.visits - a.visits || b.met - a.met);
}

const say = (c: DefaultChange) =>
  [c.variant && `"${c.variant.replaceAll("_", " ")}"`, c.collapsed !== undefined && (c.collapsed ? "collapsed" : "expanded"), c.order && `at position ${c.order}`]
    .filter(Boolean).join(" ") || "moved";
const evidenceLine = (g: Group, c: Candidate) =>
  `${c.visits} of ${g.sessions} sessions ended up with ${c.change.id}: ${say(c.change)}` +
  ` · bet came true ${c.met} of ${c.scored} checked · pressed back ${c.undone} of ${c.slides} times`;

const Pick = z.object({ keys: z.array(z.string()).min(1).max(MAX_BLOCKS), rationale: z.string().min(1).max(240) });
const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "proposeDefault",
      description: "Make these candidate changes the starting view for the page type. Pick at most 2, for different blocks.",
      parameters: {
        type: "object",
        properties: { keys: { type: "array", items: { type: "string" }, maxItems: MAX_BLOCKS }, rationale: { type: "string", maxLength: 240 } },
        required: ["keys", "rationale"],
      },
    },
  },
  {
    type: "function",
    function: { name: "hold", description: "Change nothing.", parameters: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"] } },
  },
];

export type GroupResult = { store: string; template: Template; sessions: number; candidates: number; outcome: "applied" | "hold" | "none"; reason: string; applied?: StoreDefault };

export async function proposeForGroup(g: Group, cfg: { registry: Registry; brand: BrandKit }): Promise<GroupResult> {
  const base = { store: g.store, template: g.template, sessions: g.sessions, candidates: 0 };
  const cands = eligible(g);
  if (!cands.length) return { ...base, outcome: "none", reason: `no change has been made often enough yet (needs ${bar().minVisits}+ sessions and ${Math.round(bar().minShare * 100)}% of them)` };
  const hold = (reason: string): GroupResult => ({ ...base, candidates: cands.length, outcome: "hold", reason });

  const data = {
    page: g.template, sessions: g.sessions, simulated: g.simulated,
    candidates: cands.map((c) => ({ key: c.key, block: c.change.id, change: say(c.change), sessions: c.visits, share: Math.round(c.share * 100) / 100, betsMet: `${c.met}/${c.scored}`, pressedBack: `${c.undone}/${c.slides}` })),
  };
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), BUDGET_MS);
  let msg: ChatCompletionMessage;
  try {
    msg = await chat({
      agent: "insights", tools: TOOLS, signal: abort.signal,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: `<data>\n${JSON.stringify(data, null, 1)}\n</data>` }],
      mock: () => mockPick(g, cands),
    });
  } catch (e) {
    return hold(abort.signal.aborted ? "timeout" : `llm error: ${e instanceof Error ? e.message : e}`);
  } finally {
    clearTimeout(timer);
  }

  const call = msg.tool_calls?.find((c) => c.type === "function");
  if (!call || call.type !== "function") return hold("no tool call");
  const args = safeJson(call.function.arguments);
  if (call.function.name === "hold") return hold(String((args as { reason?: unknown } | undefined)?.reason ?? "hold"));
  const pick = Pick.safeParse(args);
  if (!pick.success) return hold(`bad proposal: ${pick.error.issues.map((i) => i.message).join("; ")}`);
  if (BANNED.test(pick.data.rationale)) return hold("rationale used banned wording");

  // Only changes the evidence supports, at most one per block.
  const chosen = [...new Set(pick.data.keys)].map((k) => cands.find((c) => c.key === k));
  if (chosen.some((c) => !c)) return hold("the model picked a change that is not a candidate");
  const picked = chosen as Candidate[];
  if (new Set(picked.map((c) => c.change.id)).size !== picked.length) return hold("two changes for the same block");

  const trial: StoreDefault = { id: "", store: g.store, template: g.template, changes: picked.map((c) => c.change), rationale: pick.data.rationale, evidence: [], simulated: g.simulated, mocked: isMocked(), at: 0, active: true };
  const neutral = buildSlide({ persona: NEUTRAL_PERSONA, template: g.template, registry: cfg.registry, brand: cfg.brand });
  const checked = validateSlide({ slide: withDefaults(neutral, [trial]), registry: cfg.registry, brand: cfg.brand, returning: false });
  if (!checked.ok) return hold(`validator: ${checked.errors.join("; ")}`);
  if (changedBlocks(neutral.blocks, checked.slide.blocks).length > MAX_BLOCKS) return hold("would change more than 2 blocks");

  const applied = addDefault({ ...trial, evidence: picked.map((c) => evidenceLine(g, c)) });
  return { ...base, candidates: cands.length, outcome: "applied", reason: pick.data.rationale, applied };
}

// Look at every shopper so far, one page type at a time.
export async function analyzeAll(configFor: (store: string) => { registry: Registry; brand: BrandKit } | undefined): Promise<GroupResult[]> {
  const out: GroupResult[] = [];
  for (const g of aggregate(listVisits())) {
    const cfg = configFor(g.store);
    if (cfg) out.push(await proposeForGroup(g, cfg));
  }
  return out;
}

// Deterministic stand-in without an API key: the most frequent changes, for different blocks.
function mockPick(g: Group, cands: Candidate[]): ChatCompletionMessage {
  const top: Candidate[] = [];
  for (const c of cands) if (top.length < MAX_BLOCKS && !top.some((t) => t.change.id === c.change.id)) top.push(c);
  const first = top[0];
  const rationale = `${first.visits} of ${g.sessions} sessions on ${g.template} pages ended up with ${first.change.id} ${say(first.change)}, so new visits now start there.`;
  return {
    role: "assistant", content: null, refusal: null,
    tool_calls: [{ id: "mock-insights", type: "function", function: { name: "proposeDefault", arguments: JSON.stringify({ keys: top.map((c) => c.key), rationale }) } }],
  };
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return undefined; }
}
