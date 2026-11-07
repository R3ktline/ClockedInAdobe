# Babel rebuild — analysis and build plan

Written 2026-11-07 by Claude (Opus 5.5) for David. This is a clean rebuild of the team app
(`R3ktline/ClockedInAdobe`, `origin/main` bf9d04f) in its own local repo. Nothing here is pushed.
The team's `SPEC.md` is still the starting point; where it contradicts itself or the code, this file
says which way the rebuild goes and why.

## 1. Decisions David made for the rebuild (2026-11-07)

| Question | Answer |
|---|---|
| Where | New local folder `D:\GitHubRepos\babel-rebuild`, own git repo, not pushed |
| How the page changes | **Next page only.** The page the shopper is reading never moves on its own. Each new page opens already adapted. Changes the shopper asks for (chat, view switch, style, Standard view, previous view) apply at once, because they asked |
| Generational skins | **Keep as now.** Babel picks a skin (Bento by default, 25% of visits get another, weighted by persona) |
| P1 scope | Concierge chat · merchant panel + cost meter · A2A + MCP + hand-off page. **Not** Croiala, **not** Insights |

## 2. What was wrong (found 2026-11-07) and how the rebuild fixes it

| # | Problem in the team app | Fix in the rebuild |
|---|---|---|
| 1 | Change budget contradicts itself: SPEC says ≤ 4 blocks and same dialect; DECISIONS says ≤ 2, then 4, then "a minor slide may change the dialect"; the latest commit says it keeps the dialect | One rule, in code: a later page may differ from the last view of the same page type by **≤ 3 blocks** plus the dialect's own restyle; the **dialect may change once per visit**, at a page boundary |
| 2 | "Major only on a return visit" is broken by the curtain/calibration path on a first visit | No curtain. `return` views exist only on the first page of a return visit |
| 3 | Pacing differs (SPEC 20 s / 5 slides, code 8 s / 12, check-ins 5 s) | Nothing moves on screen, so pacing is about cost only: Director runs ≥ 8 s apart, ≤ 12 per visit, both in one config file |
| 4 | Policy layer, input guard, grounding and red-team fixtures named as P0 do not exist; the model's rationale reaches the shopper unchecked | `guardrails/policy.ts`, `input.ts`, `grounding.ts` + red-team tests. Every string a shopper reads passes the policy check or is replaced by a code-built line |
| 5 | Anonymous visitors are profiled by default (`consent.personalization: true`); the opt-in only appears in curtain mode | Consent banner on the first visit. Until "yes": standard store, no signals, no memory |
| 6 | Shopper IP sent to ipapi.co for language | No IP lookup. English only (i18n dropped from the rebuild) |
| 7 | Live DeepSeek key committed in `.env.local` | `.env.local` is git-ignored here; key copied locally only. **Rotate the team key after the hackathon** |
| 8 | Skins re-roll with `Math.random()` on every page, so a visit can change skin page to page | Same policy (25%, weighted), but seeded by visitor + visit number: one skin per visit, reproducible in tests |
| 9 | Only 3 of 13 markers exist; `confusion` is a trigger with no rule, so it never fires; "volume is not interest" untested | All 13 markers, one weights table, trigger on confusion works, the Elena-style test exists |
| 10 | Markers and the signal model are two shopper reads that can disagree | One persona source: the signal model (David's, parity-tested) or the shopper's explicit choice. Markers only trigger the Director, feed its context and the merchant panel |
| 11 | Hypotheses on fading markers count as "met" just because time passes | Scored on events in the window after the view vs. an equal window before, not on decayed values; "no data" when the shopper left early |
| 12 | Hand-off page `/{store}/h/{id}` missing, so the A2A demo beat ends on a product page | Built; shows the agent's shortlist in the shopper's own view, same prices |
| 13 | First paint is the neutral page, then slide 0 arrives (flash) | The view is computed on the server during render (consented visitor id in a cookie), so the first paint is already the adapted page, with no LLM in the path |
| 14 | 8 overlapping modes (`?apply`, `?curtain`, `?tx`, `?txlab`, `?skin`, lab, `step=free`, `BABEL_INTERVENTION`) in a 703-line provider | One mode. Demo knobs are only `?ghost=` and `&visit=2` |
| 15 | Half-width `side_*` variants only work in pairs; the validator cannot check the pairing | Dropped. Each block variant stands alone |
| 16 | Only 5 of the 10 shopper fixtures exist | All 10, each tested to read as its expected persona |
| 17 | Cost meter missing | Real token usage per agent; prices from env (`BABEL_PRICE_*`). DeepSeek's pricing page did not return prices on 2026-11-07, so the meter says **"price not set [VERIFY]"** until filled |
| 18 | Chat goes to the Director; the SPEC's Concierge does not exist | Concierge agent with catalog tools, grounded 1–2 sentence answers, labelled as AI, plus an explicit view change |

## 3. Kept as is (reused, already sound)

- `data/catalog.json` — 60 synthetic products, 6 categories, 3 copy registers.
- David's signal model `babel/persona/signalModel.ts` with its parity test (reproduces all 43 published results).
- Taraba's product art (`art.tsx`, original SVG illustrations), brand kit, cart.
- Ionut's skin tokens (`app/skins.css`) and the dialect looks.
- The A2A / MCP gateway wiring and `scripts/buyer-agent.ts`.

## 4. The contract (short; the zod source of truth is `babel/schema`)

- **Persona** = dialect × need + confidence. Below 0.55: `standard` × `balanced`.
- **View** (the old "Slide"): which declared blocks show, in which variant and order, theme, skin, copy
  register, rationale, evidence lines. Kinds: `first` (first page of a visit), `next` (later page),
  `return` (first page of a return visit), `explicit` (the shopper asked), `standard` (Standard view).
- **Plan**: what the Director decides for the *next* pages — need, at most one dialect change, copy
  register, theme step, block changes per page type, rationale, hypothesis. Validated by building every
  page type it touches and running the validator on each.
- Order of precedence for a page view: no consent → standard · Standard view on → standard ·
  explicit choice → explicit · first page of a return visit → return (with carry-over) · otherwise
  rules (signal model) + Director plan, inside the budget.
- **Registry** per store: blocks, variants, neutral, `required`, `byDialect`, `byNeed`, plain-language
  `describe` per variant. Babel holds no store variant names; the store declares what a dialect and a
  need mean for its own blocks.
- **Never** in a view: prices, stock, ratings, discounts, delivery dates, product copy.

## 5. Build order

1. Schema, Taraba registry, persona rules (signal model → view).
2. Markers (13), triggers, hypothesis scoring.
3. Guardrails: validator, policy, input guard, grounding.
4. Session: visitors, visits, pages, memory, return visit, plan application.
5. LLM client (usage + cost), Director, Concierge, prompts.
6. SDK: provider, blocks, view bar (Why? · previous view · Standard view · style), consent banner,
   chat panel, ghost runner.
7. Taraba pages (home, category, search, product, cart, checkout, hand-off), demo hub, side by side.
8. Merchant panel + cost meter.
9. Gateway (A2A, MCP, agent card), buyer agent.
10. 10 shopper fixtures; tests (unit, red-team, ghosts); typecheck; build; browser check.
