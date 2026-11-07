# 02 — Architecture

Date: 2026-11-07. Status: proposed, not yet ratified by the team.

## The one idea that matters

```
Signals ──▶ UserProfile ──▶ [Adaptation Engine] ──▶ UIIntent ──▶ Component Registry ──▶ DOM
                  ▲                                     │
                  └──────────── Chat patch ◀────────────┘
```

The LLM lives in exactly one box (Adaptation Engine) and one side-loop (Chat). It emits
**`UIIntent`** — a small JSON config. It never emits markup, copy, or product facts.

The partner site owns a **Component Registry**: for each page template, which blocks
exist and which variants each block supports. `UIIntent` may only reference declared
blocks and variants. Anything else is dropped and logged.

This registry is the safety boundary. The engine *physically cannot* produce an off-brand
page, a hallucinated spec, or an invalid layout, because the only thing it can say is
"render declared block X at declared variant Y in position Z."

## Components

### 1. Client SDK (`@chameleon/sdk`)
One script tag on the partner site. Responsibilities:
- collect behavioral signals (debounced, batched, no PII)
- request a `UIIntent` for the current page
- apply it to the already-rendered neutral page
- host the chat widget and the "why this layout?" affordance

### 2. Signal Collector
Events: page view, dwell per block, accordion/tab opens (did they open the spec table?),
scroll depth, sort/filter use, on-site search terms, comparison use, add-to-cart.

Deliberately **not** collected: name, email, demographics, cross-site history, anything
inferring a protected characteristic. If a signal cannot be explained to the user in one
sentence on the profile viewer, we don't collect it.

### 3. Profile Service
Owns `UserProfile` (see `specs/profile-schema.md`). Two update paths:
- **Implicit** — rules plus a light model over signal batches, nudging axis values.
  Cheap, runs async, never in the render path.
- **Explicit** — a chat instruction becomes a durable `explicitPreference`.

**Explicit always beats implicit.** If the user said "just the basics", no amount of
behavioral signal re-expands their page. This single rule is what makes the chat feel
real rather than decorative.

### 4. Adaptation Engine
`(UserProfile, PageContext, RegistryCapabilities) → UIIntent`

- **Cache first.** Key = `hash(profileFingerprint, pageTemplate, registryVersion)`.
  The fingerprint is a coarse bucketing of profile axes, so similar visitors share
  entries. Steady state: most requests never reach the model.
- **On miss:** one structured-output LLM call (`claude-sonnet-5`), validated against the
  `UIIntent` schema, invalid fields dropped, result cached.
- **Confidence gating:** below threshold, return the neutral intent. Low confidence means
  *less* adaptation, never a guess.
- Every `UIIntent` carries a `rationale` string — plain-language, user-facing.

### 5. Component Registry (partner side)
Declarative. Example for a product detail template:

```
specs      → table_full | table_key | prose_benefits | hidden
hero       → gallery | single_image | minimal
reviews    → full_list | summary_only | score_only | hidden
price_cta  → prominent | standard | with_financing
compare    → full_matrix | top3 | hidden
```

### 6. Chat Agent
Input: utterance + current `UIIntent` + profile + registry capabilities.
Output: a profile patch, an optional immediate `UIIntent` override, and a one-line
confirmation of what changed. Must also answer "why does my page look like this?" by
reading `rationale` and the profile — not by improvising.

### 7. Profile Viewer
User-facing, plain language, editable, resettable, exportable. Consent lives here.
This is both the privacy story and a strong demo beat. Not optional.

## One page per person, or N classes of page?

Added 2026-11-07 after this was asked directly. It will be asked again, including by judges.

**The answer: one page per person. The space is continuous, not classed.**

A `UIIntent` is a point in a combinatorial space — roughly 6 blocks × ~4 variants each,
times ordering, times collapsed flags, times field subsets, times verbosity (1–5) ×
density (2) × jargon (3) × tone (3). That is hundreds of thousands of distinct renderable
pages. For practical purposes, one-of-one.

**But be precise about one thing, because it is a real caveat:** the **profile fingerprint**
used for caching (above) buckets the axes coarsely and hashes them, so sufficiently
similar visitors are served the same cached config. That is a quantization of the
continuous space, and it exists for one reason — keeping the LLM out of the render path.

It is a **tunable dial, not a conceptual limit**: finer buckets mean more unique pages and
higher cost; coarser buckets mean fewer unique pages and lower cost. Choose per deployment.

**How to state it honestly:**
- To a general audience: "every visitor gets their own page." True.
- To a technical judge: "continuous config space, cached at a granularity we tune for
  cost." Also true, and it's the answer that survives follow-up.

**The personas are not classes.** `specs/personas.md` and `specs/visitor-fixtures.md` are
**test fixtures** — named points sampled from the space because they are far apart, so the
team has something concrete to build and demo against. The system has no notion of them.
A real visitor sits *between* fixtures, with declared preferences pulling them sideways.
Nothing in the engine maps a visitor to a persona.

## Render strategy (this is load-bearing)

1. Server-renders the **neutral canonical page**. Fast, cacheable, crawlable, identical
   for everyone. No LLM involved.
2. On hydration, the SDK fetches the `UIIntent` and applies it with animated transitions.
3. The page visibly settles into its personalized shape.

**Never block first paint on a model call.** The settle-in motion is not a compromise —
in a demo it reads as the product working.

## Latency budget

| Path | Target |
|---|---|
| Neutral SSR page | normal page speed, model not involved |
| `UIIntent` cache hit | < 50 ms |
| `UIIntent` cache miss | < 1.5 s (page already visible) |
| Chat turn → visible change | < 2 s |

## Proposed stack

- **Frontend + demo storefront:** Next.js 15 (App Router), TypeScript, Tailwind.
  App Router gives us canonical SSR plus client adaptation in one deployable.
- **Backend:** Next.js route handlers for the hackathon. Extract to a standalone service
  only if we need to pitch it as an embeddable product.
- **Models:** `claude-sonnet-5` for the chat loop and engine (latency-sensitive);
  `claude-opus-5` for offline profile synthesis and evaluation. Use structured
  output / tool-use so the model returns schema-valid JSON rather than parsed prose.
- **Storage:** SQLite (`better-sqlite3`) with JSON columns. Sufficient; Postgres is a
  slide, not a task.
- **Cache:** in-process LRU. Name Redis as the production answer; do not build it.

## Demo tooling (build this early, it saves hours)

A **persona switcher** dev panel that loads a prepared profile instantly. Judges give you
five minutes; you cannot spend three of them simulating browsing behavior to earn an
inferred profile. The switcher is also the fastest way to test the engine during
development.
