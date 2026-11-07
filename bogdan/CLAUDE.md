# CLAUDE.md

Guidance for AI coding agents (Claude Code, etc.) working in this repo.

## What this is

Hackathon project: **Babel**, an adaptive storefront. The page reshapes itself per shopper persona (density, layout, copy depth) and through a chat that turns answers into page "scenes". Runtime AI is the **DeepSeek API**.

- Product spec and architecture: [SPEC.md](SPEC.md)
- Risks, competition, counterpoints: [docs/ANALYSIS.md](docs/ANALYSIS.md)
- Safety layers and system prompts: [docs/GUARDRAILS.md](docs/GUARDRAILS.md)

**Status: planning.** No app code yet. Don't scaffold or build unless asked.

## Non-negotiable rules

1. **The LLM outputs PageSpec JSON, never code.** No runtime-generated HTML/CSS/JS, no `dangerouslySetInnerHTML`, no `eval`. New UI capability = a new Section component in `components/sections` + a schema entry, never "let the model write it".
2. **Prices, stock, ratings, and discounts never pass through the LLM.** The renderer looks them up by `productId`. Don't add these fields to `PageSpec`.
3. **Every LLM output is validated in code** (zod → refs → grounding → policy) before use. JSON mode is not validation.
4. **First paint never waits on an LLM call.** Initial render uses the rules engine + cached variants. LLM calls go in background refinement or chat only.
5. **One LLM client.** All DeepSeek calls go through `lib/llm`. No direct `fetch` to the API elsewhere. Model ID comes from `DEEPSEEK_MODEL`, never hard-coded.
6. **Prompts live in `/prompts/*.md`**, versioned. Static content first, variable content last (DeepSeek prefix caching). Untrusted text goes in `<data>` / `<user_message>` tags.
7. **No PII, no demographics.** Personas are needs-based (`simple`, `specs`, `deals`, `explorer`, `balanced`). Never infer or display age, health, or similar traits. User-facing text describes the *view*, not the *person*.
8. **No personalized pricing, no dark patterns.** See GUARDRAILS §2.
9. **Every failure path has a deterministic fallback** (cached variant or default grid). The shop must work with the DeepSeek API unreachable.

## Schema is the contract

`packages/schema` (zod) is the single source of truth for `PageSpec`, `Section`, `Scene`, `Product`, and `Persona`. TS types are inferred from it, and the JSON Schema in prompts is generated from it. Change the schema first, then update the renderer, prompts, and validators in the same change.

## Team and ownership

Several people, each running their own agents on separate machines. Agents don't talk to each other. They coordinate through this repo. Tracks follow SPEC §10:

| Track | Person | Owns (may edit) |
|---|---|---|
| **A. Schema & data** | R3ktline | `packages/schema`, `data/`, `lib/tools`, `lib/persona` |
| **B. Renderer & UI** | Ionut | `app/` (pages), `components/` |
| **C. Agents** | David | `lib/llm`, `lib/agents`, `prompts/`, `app/api` |
| **D. Guardrails & pitch** | Estegucci | `lib/guardrails`, `scripts/`, `docs/` |

- **Stay in your track's folders.** If a task needs a file another track owns, stop and say so in the task (or ask the human) instead of editing it.
- **Schema changes are owned by Track A.** Any other track that needs a field opens a task for A. A schema PR updates the renderer, prompts, and validators in the same change (see above).
- Cross-cutting files (`package.json`, configs, CLAUDE.md) change only in small, separate PRs.

## Coordination files (read before starting work)

- [docs/TASKS.md](docs/TASKS.md): the task board. Claim a task before starting it and update its status when done.
- [docs/DECISIONS.md](docs/DECISIONS.md): settled decisions. Don't re-argue them. Add a line when you make one.
- `git log` and PR descriptions: what other tracks changed recently. Check them after every rebase.

## Git workflow

- Branch per task: `<track>/<short-name>` (e.g. `b/compare-table`). One agent per checkout. Run parallel agents in separate git worktrees.
- Rebase on `main` before starting and before opening a PR. Keep PRs small and merge often (aim for under an hour of work).
- Commit messages say *what changed and why* in plain words. Other people's agents read them.
- Until the real LLM client exists, use the mock in `lib/llm` (fixture PageSpecs) so UI work never waits on Track C.
- CI (typecheck + tests) must pass before merge. Don't merge your own red PR.

## Planned layout

See SPEC §7. Summary: `app/` (routes + api), `components/sections` (registry), `lib/{llm,agents,guardrails,persona,tools}`, `packages/schema`, `prompts/`, `data/`, `scripts/`.

## Stack (planned)

Next.js App Router + TypeScript, Tailwind + shadcn/ui, Framer Motion, zod, `openai` SDK pointed at `https://api.deepseek.com`, JSON/SQLite catalog.

## Commands

_To be filled in after scaffolding._ Expected:
- `npm run dev`: dev server
- `npm run build-variants`: pre-generate persona variants into `data/variants/`
- `npm run eval`: run red-team and persona fixtures
- `npm test`: unit tests (guardrails especially)

## Environment

```
DEEPSEEK_API_KEY=        # never commit; .env.local only
DEEPSEEK_MODEL=          # check api-docs.deepseek.com for current IDs
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

## Conventions

- TypeScript strict. No `any` in schema, guardrail, or agent code.
- Guardrail functions are pure and unit-tested with fixtures from `scripts/eval-fixtures/`.
- Section components must be accessible (semantic HTML, labels, focus states, contrast) in **every** persona. The `simple` view is not an accessibility fix, and we don't claim compliance.
- Keep agent code readable: one file per agent, explicit loop, no framework magic unless it saves real time.
