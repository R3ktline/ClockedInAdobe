# Spec — Cross-vertical visitor matrix

Date: 2026-11-07. Supersedes the electronics-only scope of `specs/visitor-fixtures.md`
(that file stays as the deep worked example; this one is the breadth test).

**Purpose.** Ten visitors across ten verticals and ages 16–74. Built as a **shared handoff**
for the three workstreams:

| Column | Owner |
|---|---|
| **Data we'd have** | the data-fetching workstream — this is the fetch list |
| **What it tells us** | the engine (this workstream) |
| **Design direction** | the design workstream — this is the brief |

---

## The headline finding (read this first)

Running the idea across ten verticals produced one clear structural result:

> **The axes are vertical-independent. The blocks are vertical-specific.**

`informationAppetite`, `jargonTolerance`, `intentStage`, `priceSensitivity` and trust mean
the same thing whether you're selling laptops, insurance or groceries. **The profile schema
does not change per vertical.**

But the *blocks* do. A laptop page has `specs`; an insurance page has `coverage_terms`; a
grocery page has `reorder`. So each vertical needs its **own component registry**, while
sharing one profile schema and one engine.

**This is good news, and it's the answer to "does the idea generalize?":**
- One engine, one profile schema, one chat — built once.
- Per vertical: a registry declaring its blocks and variants. That's config, not code.

**For the design workstream this is the key instruction:** don't design ten page layouts.
Design, per vertical, a **block set** where each block has 3–4 variants spanning
dense → plain. The engine composes them.

### A second finding worth acting on

**In several verticals the correct personalization is to show *less*, or to remove
persuasion entirely.** Elena's grocery page hides discovery and leads with reorder. Radu's
insurance page strips jargon and promotional framing. Bogdan's car page suppresses deal
badges because they *reduce* his trust.

Any demo that only ever *adds* detail will read as an upsell engine. Make sure at least one
demo visitor gets a **simpler, less commercial** page than the default.

### Note on age

Age is the **fixture label** — it makes these people concrete for design and discussion.
The engine keys on the **derived axes**, not the birth year. Reason: the correlation is
real but loose, and the failure case is ugly (a 74-year-old gamer served a patronising
page, a 16-year-old who reads datasheets served three bullets). Per ADR-002 we don't infer
age; where age is relevant and declared (e.g. Gheorghe's grandchildren's ages for gift
suitability), it's an explicit input, which is both more accurate and consented.

Practically: **design for the derived column, label with the age column.**

---

## The matrix

### 1. Tudor, 16 — sneakers · fashion
**Prefers:** brands, hype, what his friends wear. Price matters but isn't his own money.
**Data we'd have:** TikTok/Instagram referrer · mobile 390px · 40s sessions · high scroll velocity · views 9 products, opens none · taps the image gallery repeatedly · size guide opened once
**Tells us:** `IA 0.15` · `JT 0.2` · `IS browsing` · visual-led, social-proof-driven · **conf 0.82**
**Design direction:** Image-first, near-fullbleed. Social proof ("1.2k bought this week"). Size availability immediate. One price, one CTA. Almost no body copy. Material/construction detail hidden.

### 2. Ana, 23 — a trip to Spain · travel
**Prefers:** cheapest viable option, flexible dates, will trade comfort for price.
**Data we'd have:** price-comparison referrer · sorted by price 3× · toggled "flexible dates" · filtered hostel + 2-star · opened "total price incl. fees" · 14 listings viewed, 2 saved · desktop then mobile same day
**Tells us:** `PS 0.95` · `IA 0.6 (price-relevant only)` · `IS comparing` · **conf 0.9**
**Design direction:** Total price up front, no fee surprises. Price calendar. Cheaper nearby dates/airports. Amenities reduced to the 3 she filtered on. Photo carousel demoted.

### 3. Mihai, 29 — a laptop · electronics
**Prefers:** full specs, benchmarks, upgradeability. Reads reviews for fun.
**Data we'd have:** review-site/YouTube referrer · query `rtx 5070 32gb` · opens spec table within 2s · 95s dwell there · opens ports diagram · 3 models in comparison
**Tells us:** `DE 0.9` · `IA 0.9` · `JT 0.9` · `IS comparing` · **conf 0.91**
**Design direction:** Dense. Spec table expanded, above the marketing copy. Benchmark comparison. Ports diagram. Technical reviews only. No "what's this good for".

### 4. Elena, 34 — the weekly shop · groceries
**Prefers:** speed. Same 40 items every week. Discovery is friction.
**Data we'd have:** 38 prior sessions · direct entry · basket rebuilt from history in <3 min · uses search box, never categories · same 40 SKUs ±5 · opens nothing · delivery slot booked immediately
**Tells us:** `IA 0.1` · `IS deciding` · habitual repeat · **conf 0.95**
**Design direction:** **One-tap reorder at the top.** Previous basket pre-filled. Delivery slots immediate. Recommendations and promos **collapsed or removed** — they are obstacles here. Fastest page in the set.
*Note: the clearest case where personalization means subtracting.*

### 5. Cristina, 38 — a sofa · furniture
**Prefers:** has to picture it in her living room. Long consideration, big spend.
**Data we'd have:** Pinterest referrer · 11 min on one product · opens every photo · opens dimensions twice · opens fabric swatches · opens "delivery & assembly" · returns 4× over 2 weeks · no cart
**Tells us:** `IA 0.7 (visual + spatial)` · `IS comparing (stalled)` · `PS 0.5` · **conf 0.85**
**Design direction:** Large room-context photography. Dimensions prominent and visual, not a table. Swatches. Delivery/assembly/returns clear (big-ticket anxiety). On return visits: "still thinking about this?" with her saved items + what changed.

### 6. Radu, 41 — home insurance · finance
**Prefers:** to understand what he's actually buying. Anxious, low domain knowledge.
**Data we'd have:** Google `asigurare locuinta ce acopera` · opens "what's covered" and "what's not covered" · 4 min on exclusions · opens glossary links 3× · abandons the quote form at step 3 of 5 · returns next day
**Tells us:** `DE 0.2` · `JT 0.05` · `IA 0.6 (wants clarity, not volume)` · low trust · **conf 0.86**
**Design direction:** Plain language throughout. "What's covered / what's not" as the lead block, in two plain columns. Every term inline-defined. Quote form shortened, progress shown. **No promotional framing** — it reads as evasion here.
*Regulated vertical: the "never fabricate product facts" rule is a legal requirement, not a preference. Policy wording comes from the insurer verbatim.*

### 7. Ioana, 45 — project software for her team · B2B SaaS
**Prefers:** will it work with what we already run, and what will it really cost at 30 seats.
**Data we'd have:** Google `project tool jira integration` · opens integrations page first · opens pricing, toggles seat count to 30 · opens security/GDPR page · downloads nothing · 3 visits, rising dwell · corporate network referrer
**Tells us:** high task expertise, low product expertise · `IA 0.8` · `IS researching` · evaluating for others · **conf 0.78**
**Design direction:** Integrations above features. Pricing at *her* seat count, not a generic table. Security/compliance surfaced (she's buying for a company). Feature list framed as team outcomes. "Book a demo" over "start free trial" — she can't self-serve a team decision.

### 8. Bogdan, 52 — a used car · automotive
**Prefers:** not to get burned. Reliability over everything.
**Data we'd have:** opens service history first · sorts reviews by most critical · 3 min on reliability data · opens warranty, then return policy · 14 vehicles viewed, zero enquiries · checks "verified seller" · desktop only
**Tells us:** low trust (**no axis for this — see gaps**) · `IA 0.7 (evidence-focused)` · `IS researching` · **conf 0.8**
**Design direction:** Service history and inspection report lead. Reviews expanded, **critical ones not buried**. Total cost of ownership, not sticker price. Warranty and service network. **Deal badges and urgency banners removed** — they reduce trust for him.

### 9. Maria, 67 — a prescription refill · pharmacy
**Prefers:** to not make a mistake. Low digital confidence, uses a tablet.
**Data we'd have:** direct entry, bookmarked · tablet 768px · slow deliberate scroll · 3 mis-taps near small controls · opens "how to order" · phone number copied to clipboard · 12 min session, one item
**Tells us:** `IA 0.15` · `JT 0.05` · needs low cognitive load · **conf 0.7 — and partly declared**
**Design direction:** Large type and large tap targets. One action per screen. Explicit numbered steps. Phone support visible at every step. No carousels, no modals, no timed elements. Confirmation screens that restate what's happening in plain words.
*The clipboard copy of the phone number is the signal that matters: she is trying to reach a human. **Surface the phone number, don't hide it behind chat.** Per ADR-002 we respond to the observed need and the declared preference — we never infer capability from her age.*

### 10. Gheorghe, 74 — a present for his granddaughter · toys
**Prefers:** something she'll actually like. Knows nothing about the category.
**Data we'd have:** Google `cadouri fetita 7 ani` · opens "age suitability" on every product · views across 80–400 RON (wide spread) · opens return policy early · opens "gift wrapping" · 3 products, 6 min each
**Tells us:** `DE 0.1` · buying for a third party (**price-band spread + age-suitability opens** — the strongest third-party signal) · `IA 0.4` · **conf 0.6**
**Design direction:** Suitability framing first ("good for ages 6–8, develops X"). Return policy and gift options promoted. Delivery-by date prominent. Specs/materials hidden — he can't evaluate them. **Ask the one question inference can't answer: "who is it for?"**

---

## What the data workstream should actually fetch

Same list for every vertical. This is the whole instrumentation surface:

**Free, first pageview:** referrer · entry query string · viewport + device · locale/currency
**In-session:** which blocks opened (**highest value**) · on-site search text (**highest value**) · dwell per block · scroll depth + velocity · sort/filter applied · items viewed + price spread · comparison use · cart events · back-button rate · mis-tap / rage-click count
**Cross-session (localStorage is enough):** visit count · days since first visit · previously viewed items · saved items · prior basket
**Declared:** stated preferences from chat · explicit accessibility settings · the task · who it's for

**Never:** inferred age, gender, income, health, demographics, third-party broker data (ADR-002).

**If only two things get built: block-open events and free-text search.** Vocabulary
classifies expertise in one shot; block-opens measure appetite directly. Everything else is
refinement.

## What the design workstream should actually produce

Per vertical, a **block set** — not page layouts. For each block, 3–4 variants spanning
dense → plain, all on-brand:

```
specs        → table_full | table_key | prose_benefits | hidden
coverage     → full_terms | plain_two_column | summary | hidden
reorder      → one_tap | list | hidden
hero         → gallery | single_image | room_context | minimal
reviews      → full_list | critical_first | summary_only | hidden
price_cta    → prominent | standard | total_cost | with_financing
trust        → service_history | warranty | verified_badge | hidden
```

Plus, for every vertical, **one neutral page** — the normal unpersonalized version. It's
the server-rendered default, the cold-start page, the low-confidence page, and the fallback
for any error. **It must be a genuinely good page on its own** (ADR-004, ADR-005).

## Unresolved gaps, now confirmed across verticals

1. **No trust axis.** Bogdan (8) and Radu (6) are both trust-driven in different verticals,
   and the schema can't represent it. Previously approximated by review appetite — that
   approximation is now clearly insufficient, since trust drives *removing* content.
   **Recommendation: add a `trust` axis to `specs/profile-schema.md`.** It's one field and
   it's load-bearing in at least three of ten verticals.
2. **Task vs. product expertise.** Ioana (7) and Mihai (3) are both "expert", oppositely.
   Still recommend accepting the simplification for the hackathon and stating it honestly.
3. **Third-party purchasing isn't an axis either** (Gheorghe 10, and Tudor 1 partially —
   spending someone else's money). Behaves like an `intentStage` variant. Needs a decision.

## Demo recommendation

**Three verticals, three visitors, maximum contrast:** Mihai (3, dense/technical),
Elena (4, subtractive/speed), Radu (6, plain-language/trust). Those three prove the idea
generalizes *and* prove personalization isn't just "add more stuff" — which is the critique
the project is most exposed to.
