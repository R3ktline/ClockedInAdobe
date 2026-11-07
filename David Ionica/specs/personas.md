# Spec — Visitor personas and their data requirements

Date: 2026-11-07. Status: draft. Vertical: electronics / laptops (see `docs/06-open-questions.md` Q6).

Purpose: the fixture set for P2 in `docs/03-plan.md`, and the reference for deciding which
signals to instrument.

---

## Design rule: one schema, ten value-sets

Every persona is described by **the same fields** — those in `specs/profile-schema.md`.
A persona is a point in that space, not a bespoke record. If a persona seems to need a
field no other persona needs, either add it to the schema for everyone or drop it.

**Acceptance test for this set:** every persona must produce a *visibly different*
`UIIntent`. If two personas render the same page, merge them — the distinction isn't real.

---

## The data we can actually get

Ordered by what it costs to obtain. Most of the value is in Tier 1 and Tier 2.

### Tier 1 — free, available on the first pageview, zero integration
| Signal | Why it matters |
|---|---|
| **Entry referrer** | A price-comparison site, a technical review site, a generic search, an LLM referral and a paid ad imply completely different visitors. One of the strongest single signals, and it's free. |
| **Entry URL + query params** | The search that brought them: `cheap laptop for school` vs `thinkpad t14 ryzen 32gb`. |
| Device class + viewport | Phone vs. desktop correlates with session length and intent. |
| Locale / currency | Needed anyway; no profiling involved. |
| Time of day | Weak. Include only if free. |

### Tier 2 — in-session behavioral (needs the SDK, accrues over seconds)
| Signal | Why it matters |
|---|---|
| **On-site search text / chat text** | **The single best expertise signal.** "laptop with good battery" vs "16GB DDR5 thin-and-light" classifies vocabulary in one shot. Far more reliable than dwell time, and essentially free. |
| **Which blocks they open** | Did they expand the spec table? The reviews? The comparison? Direct evidence of information appetite — the highest-value behavioral signal. |
| Sort / filter applied | Sorted by price → price sensitivity. Filtered by RAM → expertise. |
| Dwell time per block | Useful but noisy. A long dwell can mean interest or confusion. |
| Scroll depth and velocity | Fast skim vs. careful read. |
| Products viewed, category spread | Breadth → browsing; depth on 2–3 items → comparing. |
| Comparison tool use | Strong `intentStage = comparing` signal. |
| Add-to-cart / remove | Strong `deciding` signal. |
| Back-button rate on product pages | High rate suggests the pages aren't answering their question — a good trigger to *offer* adaptation. |

### Tier 3 — cross-session (needs storage; localStorage is enough for the demo)
Visit count, days since first visit, previously viewed products, price-drop interest, and
**prior explicit preferences** (authoritative — ADR-003).

### Tier 4 — declared (must be asked, or volunteered in chat)
Self-rated expertise, the actual task ("I edit video", "it's a gift for my mother"),
accessibility needs, budget ceiling.

**This tier is where the chat earns its place.** Personas 5 and 6 below are close to
*impossible* to infer from behavior — you cannot observe "this is a gift." So the chat is
not only a correction mechanism, it is the cheapest way to acquire data that behavior
never reveals. Worth saying explicitly in the pitch: **asking is cheaper and more accurate
than surveillance.**

### Never collected (ADR-002)
Age, gender, income, health, location beyond locale, third-party broker data, or any proxy
for a protected characteristic.

---

## The ten personas

Axes are from `specs/profile-schema.md`: `domainExpertise` (DE), `informationAppetite` (IA),
`jargonTolerance` (JT), `priceSensitivity` (PS), `intentStage` (IS). All 0–1 unless noted.

### 1. The Spec Hunter
**DE** 0.9 · **IA** 0.9 · **JT** 0.9 · **PS** 0.4 · **IS** comparing

Knows the vocabulary and wants all of it. Reads benchmarks, cares about upgrade paths and
thermal throttling.

- **Page:** full spec table expanded, benchmark comparisons, ports diagram, upgradeability. Reviews filtered to technical ones. Marketing copy suppressed.
- **Discriminating signal:** opens the spec table within seconds, uses technical terms in search, arrives from a review site.
- **Detectable?** Yes, cheaply.

### 2. The Overwhelmed First-Timer
**DE** 0.1 · **IA** 0.2 · **JT** 0.1 · **PS** 0.5 · **IS** browsing

Doesn't know what a chipset is and doesn't want to. Needs to know if it will do what they need.

- **Page:** three plain-language benefit bullets ("handles video calls, Office and Netflix; battery lasts a workday"), one image, one price, one button. Specs collapsed behind "technical details". Jargon avoided.
- **Discriminating signal:** plain-language search terms, never opens the spec table, high back-button rate.
- **Detectable?** Yes — but note it's defined partly by *absence* of signal, so it doubles as the safe default.

### 3. The Budget Maximizer
**DE** 0.5 · **IA** 0.7 · **JT** 0.5 · **PS** 0.95 · **IS** comparing

Wants the most for the least. High appetite, but only for price-relevant facts.

- **Page:** price leads, price history, performance-per-currency, cheaper alternatives, refurb options, deal badges. Spec table reduced to the fields that justify the price gap.
- **Discriminating signal:** sorts by price repeatedly, arrives from a comparison site, filters on a price ceiling.
- **Detectable?** Yes, very cheaply. Best-instrumented persona of the set.

### 4. The Decided Buyer
**DE** any · **IA** 0.1 · **JT** any · **PS** 0.3 · **IS** deciding

Already chose. Arrived to transact. Every extra block is friction.

- **Page:** price, stock, delivery date, warranty, checkout. Everything else collapsed. No recommendations, no cross-sell above the CTA.
- **Discriminating signal:** direct entry or exact-model search, straight to one product, no comparison use, fast add-to-cart.
- **Detectable?** Yes. **Dominant axis is `intentStage`, not expertise** — a useful demonstration that the axes are independent.

### 5. The Gift Buyer
**DE** 0.2 (for themselves; irrelevant to the recipient) · **IA** 0.4 · **JT** 0.1 · **PS** 0.6 · **IS** researching

Buying for someone whose needs they only half know.

- **Page:** suitability framing ("good for a student / for a parent / for light gaming"), return policy and gift options promoted hard, delivery timing prominent. Specs mostly hidden — they can't evaluate them anyway.
- **Discriminating signal:** **essentially undetectable from behavior.** Needs to be declared. Search text like "laptop for my mum" is the only free hint.
- **Detectable?** **No — requires the chat or an explicit prompt.** This persona is the argument for Tier 4.

### 6. The Task-Driven Professional
**DE** 0.4 on components, 0.9 on their own task · **IA** 0.6 · **JT** 0.3 · **PS** 0.4 · **IS** researching

Knows exactly what they need to *do* ("4K video editing in Premiere"), not which parts deliver it.

- **Page:** "can it run X" framing, software compatibility, real-world task benchmarks instead of synthetic ones, sustained-load performance. Specs translated into task outcomes.
- **Discriminating signal:** task-shaped search text ("laptop for video editing"), software names in queries.
- **Detectable?** Partially — only if they search or chat. **Shows that expertise is domain-specific, not scalar**, which is a genuine limitation of our current schema (see Open Items below).

### 7. The Returning Researcher
**DE** 0.6 · **IA** 0.8 · **JT** 0.6 · **PS** 0.6 · **IS** comparing

Fifth visit. Has narrowed to three models and is stuck.

- **Page:** resumes where they left off — a comparison of what they already viewed, what changed since (price drops, stock), a decisive "difference that matters" summary. Hides anything already rejected.
- **Discriminating signal:** visit count, previously-viewed set. Needs Tier 3 storage.
- **Detectable?** Yes, with persistence. Strong demo beat — "the site remembers your shortlist."

### 8. The Skeptic
**DE** 0.5 · **IA** 0.7 · **JT** 0.4 · **PS** 0.5 · **IS** researching

Been burned before. Wants evidence the thing won't break.

- **Page:** reviews expanded and verified-purchase filtered, warranty terms, return policy, durability and repairability, brand reliability. Promotional copy and deal badges suppressed — they *reduce* trust for this persona.
- **Discriminating signal:** opens reviews first and dwells there, reads return policy, low add-to-cart rate across many views.
- **Detectable?** Yes. Note the page must *remove* persuasion, which is a good counterexample to "personalization = more upsell."

### 9. The Clarity-Need Visitor
**DE** any · **IA** 0.2 · **JT** 0.05 · **PS** any · **IS** any — **declared, persistent**

Needs low cognitive load: plain language, short sentences, strong hierarchy, minimal
simultaneous choices. May be a cognitive accessibility need, a non-native reader, or
someone on a phone in a hurry.

- **Page:** maximum plain language, one idea per block, no dense tables, no parallel comparisons, generous spacing, explicit next step.
- **Discriminating signal:** **declared, never inferred.** Set via the profile viewer or chat and then persistent.
- **Detectable?** **No, and deliberately so.** Inferring cognitive ability from behavior is exactly what ADR-002 forbids. This persona is the ADR-007 accessibility case, and it must be opt-in.

### 10. The Mobile Skimmer
**DE** 0.3 · **IA** 0.15 · **JT** 0.2 · **PS** 0.7 · **IS** browsing

Phone, 40-second session, thumb-scrolling.

- **Page:** image-led, one price, one CTA, everything else collapsed. Shortest copy of any persona.
- **Discriminating signal:** viewport, scroll velocity, session duration. Free, Tier 1.
- **Detectable?** Yes, trivially. Note it wants a minimal page like persona 4 but for the
  opposite reason, and the content differs — 4 wants price/stock/checkout, 10 wants
  image/price/CTA. Confirms they're genuinely distinct.

---

## What this set tells us

1. **Six of ten are detectable from Tier 1 + Tier 2 alone** (1, 2, 3, 4, 8, 10). Those are
   the demo. Instrument: referrer, search text, block-open events, sort/filter, viewport,
   scroll velocity. That's a small list and most of it is free.
2. **One needs persistence** (7) — localStorage is sufficient.
3. **Three cannot be inferred and must be declared** (5, 6, 9). This is not a gap to fix,
   it is the product argument: the chat exists because asking beats guessing.
4. **The two highest-value signals are block-open events and free-text search.** If you
   instrument only two things, instrument those.
5. **Persona 2 doubles as the neutral fallback** — it's defined largely by absent signal,
   so it's the safe cold-start default. Convenient: our safest default is also our most
   under-served real user.

## Demo recommendation

Do not demo ten. Pick **three with maximum visual contrast** — Spec Hunter (1),
Overwhelmed First-Timer (2), Budget Maximizer (3) — and keep the rest as fixtures proving
the model generalizes. Three pages that look radically different beats ten that look
similar. Load them through the persona switcher from `docs/02-architecture.md`.

## Open items

- **`domainExpertise` is modelled as scalar per domain, but persona 6 breaks that** — high
  task expertise, low component expertise. Either add a `taskExpertise` axis or accept the
  simplification for the hackathon. Logged as a schema question; **recommend accepting the
  simplification** and noting the limitation honestly if asked.
- Personas 3 and 8 conflict on promotional content: one wants deal badges, the other is
  repelled by them. Confirms `priceSensitivity` and trust are separate axes. Our schema has
  no trust axis — consider whether persona 8 is representable at all, or whether it needs
  one. `[ASSUMPTION]` currently: approximated by high `informationAppetite` on reviews.
