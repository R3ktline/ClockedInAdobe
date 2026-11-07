# Tasks

The shared board for the 12-hour build. Claim a task by putting your name in it **and pushing** before you start. One line per change, so merges don't conflict.

Status: `todo` · `doing` · `blocked` · `review` · `done`
Format: `- [status] [track] task (owner) · notes / PR link`

Tracks: **A** bogdan · **B** Ionut · **C** David · **D** Matei ([AGENTS.md](../AGENTS.md#team-and-ownership)).

## Phase 1: foundation (bogdan, solo)

bogdan builds the base and a thin proof of concept that touches every track's folder, so each track starts Phase 2 from working code instead of four competing scaffolds. Nobody else pushes app code during this phase.

- [done] [A] Scaffold: Next.js 16 + TS 5.9 + Tailwind 4 + Framer Motion + zod 4 + `openai`; scripts `dev`, `build`, `typecheck`, `test`; Commands table in AGENTS.md (bogdan) · lint not set up yet
- [done] [A] `babel/schema`: first version of every zod schema, plus `SlideProposal` (what the Director proposes) (bogdan) ·
- [done] [A] Seed catalog: 14 products across the 6 categories, `data/catalog.json` (bogdan) · grown to ~60 in Phase 2
- [done] [B] Taraba: home, category and product pages from `<BabelBlock>`, brand kit, registry with `byDialect` (bogdan) · placeholder images
- [done] [B] `babel/sdk`: `BabelProvider` (visit, signals, ghost replay, pause-then-slide), `BabelBlock`, `BabelStack`, slide control (◀ ▶, Why?, Standard view), change highlight (bogdan) ·
- [done] [D] Signals → `/api/events` → `babel/markers` with `hesitation`, `trustNeed`, `infoAppetite` + triggers, unit-tested (bogdan) ·
- [done] [C] `babel/llm` (DeepSeek client, mock, usage log), `babel/persona` slide-0 rules, Director with `proposeSlide` / `hold`, repair loop, 6 s budget (bogdan) ·
- [done] [A] `validateSlide`: schema, registry, brand clamp, change budget, unit-tested (bogdan) ·
- [done] [D] Bare `/merchant` (markers + evidence, Director trace, LLM usage) and the Radu ghost shopper (bogdan) ·

**Foundation checkpoint:** the Radu ghost shopper runs on Taraba; his markers rise on `/merchant`; the Director (real DeepSeek) proposes a slide; the validator accepts or makes it repair; the page moves to slide 2 and ◀ goes back. With DeepSeek unreachable, the Director holds and the store still works. CI is green. When this is met, bogdan marks it `done` here and tells the team.

- [done] Checkpoint (bogdan) · 2026-11-07. Mock LLM: Radu's replay → hesitation/trustNeed cross 0.6 → slide 1 → ◀ back; unreachable LLM → hold (unit test); typecheck, 15 tests, `next build` pass. **Live LLM:** same flow through OpenRouter with the free `nvidia/nemotron-3.5-lightning:free` (no free DeepSeek model supports tool calls today): valid slide on the first round in 10-15 s, real token usage on /merchant. That run caught the Director betting that an accumulating marker would fall; fixed by telling it which markers fade (prompt v2). **DeepSeek:** same flow on `deepseek-flash` (V4.1 Flash): valid slide on the first round in 4.5-6.5 s, prefix cache hits from the second call on.

**While Phase 1 runs (prep only, no app code pushed):**
- Ionut: designs for the 4 dialects on Taraba, and Croiala's look.
- David: drafts of the Director and Concierge prompts from [GUARDRAILS §6](GUARDRAILS.md#6-draft-prompts), and the tool list.
- Matei: event streams for the 10 shoppers ([SPEC §3.4](../SPEC.md#34-the-10-demo-shoppers)) and marker weights from [MARKERS.md](MARKERS.md).

## Phase 2: P0 per track ([SPEC §13](../SPEC.md#13-scope))

- [done] [A] Full catalog: 60 products (10 per category), 3 copy registers, policies, store-wide promotions, 3–4 simulated review texts each (`Product.reviews`, shown under "Read reviews" on Taraba) (bogdan)
- [todo] [A] Return-visit major slide with carry-over (validator side) (bogdan) · with C
- [todo] [A] Policy layer + red-team fixtures from [GUARDRAILS §7](GUARDRAILS.md#7-red-team-fixtures-scriptseval-fixtures) passing (bogdan) ·
- [done] [A] A2A Agent Card + `search_products`, `get_product`, `compare_products`, `get_store_policies`, `create_handoff_link` in `babel/tools` (bogdan) · needs B: `/{store}/h/{id}` shortlist page reading `getHandoff(id)` from `babel/tools`; until then the link points at the first product page
- [done] [A] `scripts/buyer-agent.ts` (DeepSeek-driven buyer agent over A2A, `npm run buyer-agent`) (bogdan) ·
- [todo] [B] All block variants for the 4 dialects on Taraba (hero, productList, filters, gallery, summary, specs, trust, buyBox, compare, continuity, assist) (Ionut) ·
- [todo] [B] SlidePlayer polish: change highlight, Why? panel, undo (Ionut) ·
- [todo] [C] Director: all tools, hypothesis scoring, repair loop, 6 s budget, learned priors slot (David) ·
- [todo] [C] Slide cache + `build-slide-cache` script; persona rules tuned on the 10 shoppers (David) ·
- [todo] [D] All 13 markers + evidence + triggers, unit-tested (incl. "volume is not interest") (Matei) ·
- [todo] [D] Ghost shopper runner for all 10 shoppers (Matei) ·
- [todo] [D] `/merchant`: live sessions, full Director trace (Matei) ·

**Checkpoint:** the full P0 path runs end to end with replayed responses. **Record the backup video now.**

## Phase 3: P1

- [todo] [B] Croiala store: brand kit, registry, variants; clamp log visible (Ionut) ·
- [todo] [C] Concierge chat → explicit slides (David) ·
- [review] [C] Insights agent cards + "approve as default" (David) · panel UI with D · first version built by bogdan: `babel/agents/insights.ts`, `babel/session/defaults.ts`, `/api/insights`, "What shoppers have in common" on /merchant. It applies a default on its own once validated (SPEC §6.3 says a human approves), with a Revert button
- [done] [A] MCP endpoint over `babel/tools` (bogdan) · stateless Streamable HTTP at `/api/mcp`
- [todo] [D] Persona table vs Standard-view holdout (simulated, labelled) (Matei) ·
- [todo] [C] Cost meter: usage → cost from DeepSeek's pricing page; per-1,000-visits figure (David) · [SPEC §14](../SPEC.md#14-cost)
- [todo] [D] LLM synthetic shoppers (Matei) ·

## Phase 4: demo (last ~3 hours)

- [todo] [B] Simulator panel, side-by-side view, presenter hotkeys, demo-mode slow transitions (Ionut) ·
- [todo] [C] Record/replay for scripted beats; warm the slide cache (David) ·
- [todo] [all] Rehearse [DEMO.md](DEMO.md) twice on a projector-sized screen; go through [DEMOQUESTIONS.md](DEMOQUESTIONS.md) (all) ·
- [todo] [all] Final backup video, cost-vs-value slide, closing slide (all) ·

## Blocked / needs another track

<!-- - [blocked] [B] needs `emphasis` field on Slide blocks (Ionut) · waiting on A -->
