# AGENTS.md

Rules for every coding agent (Claude Code, Codex, Cursor, …) and every person working in this repo. `CLAUDE.md` just imports this file.

## What this is

**Babel**: an AI layer an online store plugs into. It decides what kind of shopper is on the page (persona = web dialect × need), scores marketing markers from their behaviour, and a DeepSeek agent re-composes the store's own page as a timeline of **slides**, inside the store's brand. The catalog is also served to shopping agents over A2A and MCP. 12-hour hackathon, synthetic data, two fictional demo stores (Taraba, Croiala).

**Status: Phase 1 (foundation) built, one check left.** The base app and an end-to-end proof of concept run on the mock LLM. The checkpoint in [docs/TASKS.md](docs/TASKS.md#phase-1-foundation-bogdan-solo) still needs one run against real DeepSeek. When bogdan marks it `done`, the tracks take over their folders. Planning is finished and archived in `planning-phase/` (history, read-only, not a source of truth).

## Read before you start

1. [SPEC.md](SPEC.md): the build contract. What to build, schemas, layout, scope.
2. [docs/DECISIONS.md](docs/DECISIONS.md): settled choices. Don't re-argue them.
3. [docs/TASKS.md](docs/TASKS.md): claim a task before working on it.
4. For your area: [docs/MARKERS.md](docs/MARKERS.md) (markers, signals), [docs/GUARDRAILS.md](docs/GUARDRAILS.md) (validation, legal, prompts), [docs/DEMO.md](docs/DEMO.md) (what the demo needs), [docs/DEMOQUESTIONS.md](docs/DEMOQUESTIONS.md) (judge Q&A), [docs/JUDGING-CRITERIA.md](docs/JUDGING-CRITERIA.md).

## Non-negotiable rules

1. **The LLM outputs Slide JSON or tool calls, never code.** No generated HTML/CSS/JS, no `dangerouslySetInnerHTML`, no `eval`. A new UI capability is a new block variant in a store's registry.
2. **Prices, stock, ratings, discounts, delivery dates and product copy never come from the LLM.** Store components render them from the catalog by product id. Don't add these fields to `Slide`.
3. **Every LLM output is validated in code**: zod → registry → brand clamp → change budget → policy. JSON mode is not validation.
4. **First paint never waits on an LLM.** Slide 0 comes from `data/slide-cache/` or the rules in `babel/persona`.
5. **One LLM client.** All DeepSeek calls go through `babel/llm`, which also records token usage for the cost meter. Model from `DEEPSEEK_MODEL`, never hard-coded.
6. **Prompts live in `/prompts/*.md`**, versioned, static parts first (DeepSeek prefix caching). Untrusted text goes in `<data>` / `<user_message>`.
7. **No age or demographic inference.** Persona is dialect × need from interaction signals and consented partner context ([GUARDRAILS §3](docs/GUARDRAILS.md#3-what-babel-may-know-about-the-shopper)). User-facing text describes the *view*, never the *person*.
8. **No personalised pricing, no dark patterns.** Hesitation, confusion and abandonment risk never trigger urgency, scarcity, countdowns or discounts.
9. **Change budget is code, not prompt.** Minor slide ≤ 2 blocks, no dialect change; major slide only on a return visit, with carry-over ([SPEC §4.2](SPEC.md#42-change-budget-enforced-in-code-by-babelguardrails-not-by-the-prompt)).
10. **Plug-in boundary.** `stores/*` imports only from `babel/sdk`'s public API. `babel/*` never imports from `stores/*`.
11. **Every failure has a deterministic fallback.** The store works with DeepSeek unreachable (hold / neutral slide).
12. **Synthetic is labelled synthetic.** Every simulated number on screen carries a "simulated" tag. Never invent a metric.
13. **No real brand assets.** No real store names, logos, or images hotlinked from brand sites. Fictional product brands only.

## Schema is the contract

`babel/schema` (zod) is the single source of truth for `Slide`, `Timeline`, `Persona`, `Markers`, `InteractionEvent`, `PartnerContext`, `BrandKit`, `Registry` and `Product`. TS types are inferred from it; the JSON Schema in prompts is generated from it. Track A owns it. Need a field? Open a task for A. A schema change updates validators, prompts and renderers in the same PR.

## Team and ownership

Each person runs their own agents on their own machine. Agents coordinate only through this repo.

**Two phases:**
1. **Foundation (now):** bogdan alone builds the skeleton and a thin end-to-end proof of concept, touching every folder below. Nobody else pushes app code until the foundation checkpoint in [docs/TASKS.md](docs/TASKS.md#phase-1-foundation-bogdan-solo) is marked done.
2. **Tracks (after the checkpoint):** each person deepens their own area, under the ownership below.

| Track | Person (GitHub) | Owns (may edit) |
|---|---|---|
| **A. Schema, data, gateway, guardrails** | bogdan (`R3ktline`) | `babel/schema`, `babel/guardrails`, `babel/tools`, `babel/session`, `data/catalog*`, `app/api/a2a`, `app/api/mcp`, `app/.well-known`, `app/api/_store.ts`, `scripts/gen-catalog*`, `scripts/buyer-agent*`, `docs/DECISIONS.md` |
| **B. Stores and slide UI** | Ionut (`ionutdautema`) | `stores/`, `app/[store]/`, `app/page.tsx`, `app/globals.css`, `babel/sdk/` (signal collection inside `BabelProvider.tsx` is shared with D) |
| **C. Agents and LLM** | David (`Ddavid10101`) | `babel/llm`, `babel/agents`, `babel/persona`, `prompts/`, `app/api/visit`, `app/api/slide`, `app/api/chat`, `data/slide-cache/`, `scripts/build-slide-cache*` |
| **D. Signals, markers, merchant panel** | Matei (`estegucci-oss`) | `babel/markers`, `app/merchant/`, `app/api/events`, `app/api/merchant`, `data/shoppers/`, `data/sessions/`, `scripts/ghost-shopper*`, `scripts/eval*` |

- **Stay in your track's folders** (from Phase 2). If a task needs another track's file, stop and say so in the task instead of editing it.
- Cross-cutting files (`package.json`, configs, `AGENTS.md`, `SPEC.md`) change only in small, separate PRs.
- `docs/` other than DECISIONS: anyone, small PRs.

## Git workflow

- Branch per task: `<track>/<short-name>` (e.g. `b/slide-player`). One agent per checkout; parallel agents use separate worktrees.
- Rebase on `main` before starting and before opening a PR. PRs small, merged often (under an hour of work each). In a 12-hour build, merge to `main` at least every 2 hours.
- Commit messages say what changed and why, in plain words. Other people's agents read them.
- Until the real client exists, use the mock in `babel/llm` (fixture slides) so UI work never waits on Track C.
- CI (typecheck, lint, tests) must pass before merge. Don't merge your own red PR.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Dev server on :3000. `/` index, `/taraba` store, `/merchant` panel |
| `npm run typecheck` / `npm test` / `npm run build` | CI checks (tsc, vitest, Next build) |

Demo URLs: `/taraba/p/home-wm-01?ghost=radu` replays the synthetic shopper Radu in the page (`?ghost=<id>` for any fixture in `data/shoppers/`); open `/merchant` alongside to watch markers and the Director's trace.

**Without `DEEPSEEK_API_KEY` the LLM is mocked** (`babel/llm`, deterministic answers per agent), so everything runs offline; the merchant panel says "mock". `BABEL_LLM=mock` forces the mock even with a key. `BABEL_MIN_SLIDE_GAP_MS` (default 20000) sets the pause between slides.

Planned in Phase 2+ (not there yet): `gen-catalog`, `build-slide-cache`, `buyer-agent`, `eval`, lint.

## Environment

Copy [.env.example](.env.example) to `.env.local` (never committed; `.gitignore` covers it). `DEEPSEEK_MODEL` must be set; check `api-docs.deepseek.com` for current model IDs.

## Conventions

- TypeScript strict. No `any` in schema, guardrail, marker or agent code.
- `babel/markers` and `babel/guardrails` are pure functions with unit tests on the shopper fixtures and `scripts/eval-fixtures/`.
- Block variants are accessible in every dialect (semantic HTML, labels, focus states, contrast). `guided` is not an accessibility fix and we never claim compliance.
- One file per agent, explicit loop, no agent framework unless it saves real time.
