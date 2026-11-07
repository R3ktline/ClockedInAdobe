# 03 — Plan

Date: 2026-11-07. Status: draft. **Blocked on two unknowns: the deadline and the team
split.** See `docs/06-open-questions.md`. Phases are sized relative to each other, not
pinned to dates, until those are answered.

## Build order principle

Build one **vertical slice** end to end before widening anything. One page template,
three blocks, three personas, one working chat instruction. A working thin slice beats
five components at 60%, and the 60% failure mode is the most common way hackathon
projects die.

## P0 — Foundations `[IN PROGRESS]`

- [x] Workspace structure and agent protocol (`CLAUDE.md`)
- [x] Concept, feasibility, architecture docs
- [x] Install `git` (2.56.0) and `gh` (2.103.3) — done 2026-11-07.
      **`node` / `npm` are still NOT installed** — this now blocks P1.
- [x] Get access to `github.com/R3ktline/ClockedInAdobe` — done 2026-11-07 via the Docker
      Desktop MCP GitHub connector. Repo exists, is private, David is a collaborator.
- [ ] Ratify `specs/profile-schema.md` and `specs/ui-intent-schema.md` with the team
- [ ] Anthropic API key in `.env.local`, confirmed never committed

**Exit criterion:** every team member can run the repo locally and agrees on the two schemas.

## P1 — Demo storefront + neutral render

- [ ] Next.js app, Tailwind, TypeScript
- [ ] Catalog: 8–12 laptops, hand-authored JSON, **rich** data (full specs, plain-language
      benefits, reviews, price history). The data must be rich enough that filtering it
      differently produces visibly different pages — if the catalog is thin, every
      persona looks the same and the whole demo collapses. Do not under-invest here.
- [ ] Component Registry for one template (`product_detail`) with real variants per block
- [ ] Neutral canonical SSR render — a good-looking normal product page
- [ ] Renderer that takes a `UIIntent` and applies it, with animated transitions

**Exit criterion:** hand-write a `UIIntent` JSON file, and the page visibly changes shape.
No AI involved yet. **If this doesn't work, nothing downstream matters.**

## P2 — Adaptation engine

- [ ] Three hardcoded personas (expert / novice / price-driven) as `UserProfile` fixtures
- [ ] Persona switcher dev panel
- [ ] Deterministic rules mapping profile → `UIIntent` (no LLM) as the baseline and fallback
- [ ] LLM path: structured-output call, schema validation, invalid-field dropping
- [ ] Cache keyed on profile fingerprint
- [ ] `rationale` generation and confidence gating

**Exit criterion:** flip the persona switcher, page re-shapes correctly. This is the
money shot — get it working and recorded early, as insurance against later breakage.

## P3 — Chat loop

- [ ] Chat widget on the page
- [ ] Utterance → profile patch (structured output) → re-render
- [ ] Durable `explicitPreference` that survives reload and overrides inference
- [ ] Confirmation line: "Done — I've simplified product details across the site."
- [ ] Undo

**Exit criterion:** say "too much detail, just the basics", the page simplifies, reload
the page, it is still simple. The persistence is the part that makes it feel real; a
change that evaporates on reload reads as a gimmick.

## P4 — Implicit signals

- [ ] Signal collector in the SDK
- [ ] Async profile nudging from signal batches
- [ ] Session-level cold-start adaptation

**Lowest priority of the core features.** Cut this first if time is short — the persona
switcher covers the same demo ground, and "we infer from behavior" is believable on a
slide without being built.

## P5 — Trust surface

- [ ] Profile viewer: plain language, editable, resettable, exportable
- [ ] Consent gate on first visit
- [ ] "Adapted for you — why?" affordance surfacing the `rationale`
- [ ] Global off switch

**Do not cut this.** It is the main differentiator against every incumbent and it is
cheap — it is mostly rendering data we already have. Cut P4 before P5.

## P6 — Pitch and measurement

- [ ] Measurement design: what we would A/B test, what the metric is, what lift would
      prove it. Dashboard with **explicitly labelled simulated** data.
- [ ] Integration story slide: the script tag plus the registry schema file
- [ ] Positioning slide: versus Adobe Target / Optimizely rule-based personalization
- [ ] Privacy and EU AI Act slide
- [ ] Demo script, timed, rehearsed, with a recorded fallback video

## Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Scope creep; nothing finished | **Highest** | Vertical slice first. Record the P2 demo the day it works. |
| Thin catalog data makes personas look identical | High | Over-invest in catalog richness in P1. |
| Judges call it a ChatGPT wrapper | High | Registry architecture, explainability, measurement plan. |
| Page changing feels broken, not magic | Medium | Animated transitions, visible badge, undo. |
| LLM returns invalid config | Medium | Schema validation, drop invalid fields, deterministic fallback. |
| No toolchain on dev machine | Medium | Install git + Node in P0, today. |
| No repo access | Medium | Resolve with the repo owner. |
| Fabricated metrics discredit the project | Medium | Label all simulated data as simulated, every time. |

## Cut list, in the order to cut

1. P4 implicit signals (persona switcher covers the demo)
2. Multiple page templates — one template, done well, is enough
3. Measurement dashboard — the slide alone carries it
4. Multi-session profile persistence beyond localStorage

Never cut: P1 renderer, P2 persona switching, P3 chat persistence, P5 profile viewer.
