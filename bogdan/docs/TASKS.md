# Tasks

The shared board. Claim a task by putting your name in it **and pushing** before you start. Keep edits to this file small (one line per change) so merges don't conflict.

Status: `todo` · `doing` · `blocked` · `review` · `done`
Format: `- [status] [track] task (owner) · notes / PR link`

Prefer GitHub Issues if the team is comfortable with them. Agents can read and update them via `gh issue list` / `gh issue comment`. If you switch, link the issues here and stop editing this file.

## Hour 1: contracts (everything else waits on these)

- [todo] [A] Freeze PageSpec / Section / Scene / Product / Persona zod schemas in `packages/schema` (R3ktline) ·
- [todo] [A] Catalog: 20-40 products, one category, in `data/catalog.json` (R3ktline) ·
- [todo] [B] Render a hand-written PageSpec fixture (Ionut) ·
- [todo] [C] Mock LLM client in `lib/llm` returning fixture PageSpecs (David) · unblocks B
- [todo] [C] Composer returns a valid PageSpec for one persona (David) ·
- [todo] [D] Validator rejects a set of bad fixtures (Estegucci) ·
- [todo] [any] Scaffold Next.js app + `package.json` scripts (`dev`, `typecheck`, `test`) (_) · do once, small PR

## P0 (from SPEC §8)

- [todo] [B] Section registry: `hero`, `productGrid`, `compareTable`, `specTable`, `keyFacts`, `guidedChooser` (Ionut) ·
- [todo] [B] PageSpec renderer with animated transitions (Ionut) ·
- [todo] [A] Rules persona engine (`lib/persona`) (R3ktline) ·
- [todo] [B] Visitor Simulator panel (Ionut) ·
- [todo] [C] Pre-built variants for `simple`, `specs`, `balanced` on home + product pages (David) ·
- [todo] [C] Chat → Scene with 2-3 tools, scene strip, back/forward (David) · tools from A
- [todo] [D] Guardrails: schema + refs + grounding + policy (Estegucci) ·

## P1

- [todo] [C] Profiler Agent with background re-layout (David) ·
- [todo] [B] "Why this view?" explainer (Ionut) ·
- [todo] [D] LLM critic agent on chat scenes (Estegucci) ·
- [todo] [A] `deals` persona + UTM-matched landing variant (R3ktline) ·
- [todo] [B] Side-by-side persona comparison view (Ionut) ·

## Blocked / needs another track

<!-- - [blocked] [B] needs `badge` field on Section (owner) · waiting on A -->
