# Spec — 10 client profiles (canonical)

Date: 2026-11-07. Status: **draft, not ratified.** Machine-readable version:
[`specs/client-profiles.json`](client-profiles.json) — same 10 people, as `UserProfile`
objects the engine and the persona switcher can load directly.

**What this file is for.** Ten customers with different traits. For each one we say which
traits we track, how we measure each trait, what our product changes for them, and how we
would know it helped. Use them to test the product: load a profile, render the page, check
the result against "What the product does".

**Where these people come from.** They are the same ten people as in
`specs/design-briefs.md` and `specs/visitor-matrix.md` (same names, ages, shops), so the
design work already done still applies. This file adds what those files did not have: one
profile format, trackable traits, success metrics, and a mapping to Bogdan's personas.

> ⚠ **Name clash.** `specs/visitor-fixtures.md` uses six of these names (Mihai, Elena,
> Cristina, Radu, Ioana, Bogdan) for **different** people. Treat this file as the canonical
> set. Also: customer #8 is named Bogdan, like our teammate. Rename one if it confuses
> people — see open question 21.

> **All numbers are illustrative `[ASSUMPTION]`.** These people are reasoned, not
> researched. Do not put any of these numbers in the pitch as data.

---

## How to read a profile

**Traits we track** (from `specs/profile-schema.md`; all 0–1 unless noted):

| Code | Trait | Low end (0) | High end (1) |
|---|---|---|---|
| DE | `domainExpertise` (per shop type) | doesn't know the words | knows more than the site |
| IA | `informationAppetite` | wants 3 bullets | wants the full table |
| JT | `jargonTolerance` | technical words push them away | technical words help |
| PS | `priceSensitivity` | price barely matters | price decides |
| IS | `intentStage` | `browsing` → `researching` → `comparing` → `deciding` | |
| TR | `trust` **`[PROPOSED]`** | skeptical, persuasion backfires | trusts the shop |
| BF | `buyingFor` **`[PROPOSED]`** | `self` | `other` |

TR and BF are **not in the schema yet** (open question 20). In the JSON they sit in a
separate `proposed` block, so the profiles still match the current schema.

**Never tracked:** age, gender, income, health, location (ADR-002). The age next to each
name is a label for us. The engine never sees it — in the JSON it lives in `fixture`, outside
the profile.

**Persona mix** maps each person onto the five personas in `bogdan/SPEC.md` §3 (`simple`,
`specs`, `deals`, `explorer`, `balanced`). His engine uses the top persona when it is
≥ 0.55, otherwise `balanced`. The mapping is our reading, not agreed with Bogdan.

**On the laptop store** says how the same person would look on the demo shop. Both our
plan and Bogdan's plan use a laptop catalog, so this is the line to test against. It is a
prediction from their traits, `[ASSUMPTION]`.

---

## 1 · Tudor, 16 — sneakers · fashion

**In one line:** Scrolls fast on his phone, follows what his friends wear, reads nothing.

| Trait | Value | How we measure it |
|---|---|---|
| IA | 0.15 | 9 products viewed, 0 blocks opened |
| JT | 0.2 | never opens material/construction details |
| PS | 0.5 | no price sort; price matters but it is not his own money |
| IS | browsing | 40 s sessions, high scroll speed |
| DE | fashion 0.6 · electronics 0.4 | knows brand names in search; electronics is a guess |
| TR | 0.7 | taps "bought this week" and reviews count, not review text |
| BF | self | — |

**Signals:** TikTok/Instagram referrer · mobile 390 px · taps image gallery repeatedly ·
opened size guide once. **Confidence 0.82.**
**Persona mix:** explorer 0.7 · simple 0.1 · deals 0.1 · balanced 0.1 → **explorer**

**What the product does:** Image-first, almost full-screen photos. Real social proof from
catalog data ("1.2k bought this week" only if the shop has the number). Size availability
right away. One price, one button. Almost no text.
**On the laptop store:** Big lifestyle photos, colours, "popular now". Specs hidden.
**Chat moment:** *"just pics, less text"* → `{ verbosity: 1, hero: "gallery" }`
**How we know it helped:** more taps from gallery to size select; lower bounce.
**What we can't know:** whether he will buy or just likes looking.

---

## 2 · Ana, 23 — a trip to Spain · travel

**In one line:** Wants the cheapest option that works. Will trade comfort for price.

| Trait | Value | How we measure it |
|---|---|---|
| PS | 0.95 | sorted by price 3×, filtered hostel + 2-star |
| IA | 0.6 (price-related only) | opened "total price incl. fees", nothing else |
| JT | 0.5 | neutral |
| IS | comparing | 14 listings viewed, 2 saved |
| DE | travel 0.7 · electronics 0.5 | uses "flexible dates" on her own |
| TR | 0.5 | neutral |
| BF | self | — |

**Signals:** price-comparison referrer · toggled "flexible dates" · desktop then mobile the
same day. **Confidence 0.90.**
**Persona mix:** deals 0.8 · specs 0.1 · balanced 0.1 → **deals**

**What the product does:** Total price first, no fee surprises at checkout. Price calendar.
Cheaper nearby dates and airports. Amenities cut to the 3 she filtered on. Photos moved down.
**On the laptop store:** Sorted by price. Only real discounts (from the shop's deal data).
Cheaper alternatives next to each laptop.
**Chat moment:** *"always show me the total with all fees"* → `{ price_cta: "total_cost", scope: "global" }`
**How we know it helped:** fewer people leaving at checkout when fees appear; saved → booked rate.
**What we can't know:** her real budget ceiling.

---

## 3 · Mihai, 29 — a laptop · electronics ⭐ demo

**In one line:** Knows more about the hardware than the shop does.

| Trait | Value | How we measure it |
|---|---|---|
| DE | electronics 0.9 | search `rtx 5070 32gb`; technical words |
| IA | 0.9 | spec table opened within 2 s, 95 s on it |
| JT | 0.9 | opened ports diagram and upgradeability |
| PS | 0.4 | no price sort |
| IS | comparing | 3 models in comparison |
| TR | 0.6 | reads technical reviews |
| BF | self | — |

**Signals:** YouTube review-channel referrer · never opened "What is this good for?".
**Confidence 0.91** — three signals agree.
**Persona mix:** specs 0.85 · deals 0.05 · balanced 0.1 → **specs**

**What the product does:** Dense. Full spec table open, above marketing text. Benchmark
comparison. Ports diagram. Technical reviews only. "What is this good for?" hidden.
**On the laptop store:** This is his home shop — same as above.
**Chat moment:** *"compare the two cheapest with 32GB RAM"* → comparison scene (Bogdan's `compareTable`)
**How we know it helped:** shorter time to first comparison; add-to-cart from the comparison view.
**What we can't know:** his budget. Expertise says nothing about price.

---

## 4 · Elena, 34 — the weekly shop · groceries ⭐ demo

**In one line:** Buys the same 40 things every week. Anything new is in her way.

| Trait | Value | How we measure it |
|---|---|---|
| IA | 0.1 | opens nothing |
| IS | deciding | basket rebuilt in under 3 min, delivery slot booked at once |
| PS | 0.4 | no price sort |
| JT | 0.5 | neutral |
| DE | groceries 0.8 · electronics 0.3 | uses search box, never categories |
| TR | 0.8 | 38 previous orders |
| BF | self | — |

**Signals:** 38 prior sessions · direct entry · same 40 products ±5. **Confidence 0.95.**
**Persona mix:** simple 0.5 · balanced 0.5 → **no clear persona** — Bogdan's set has no
"repeat buyer" type. See gap 2 below.

**What the product does:** **One-tap reorder at the top.** Last basket already filled in.
Delivery slots right away. Offers and recommendations removed — here they are obstacles.
The fastest page in the set. **This is the "less is better" case.**
**On the laptop store:** 3 plain benefit bullets, one price, one button. No upsell.
**Chat moment:** *"stop showing me offers"* → `{ suppress: ["dealStrip", "recommendations"], scope: "global" }`
**How we know it helped:** time from entry to booked delivery slot goes down.
**What we can't know:** when she *would* like to try something new.

---

## 5 · Cristina, 38 — a sofa · furniture

**In one line:** Needs to picture it in her living room. Big spend, slow decision.

| Trait | Value | How we measure it |
|---|---|---|
| IA | 0.7 (visual + size) | opens every photo, dimensions twice, fabric swatches |
| IS | comparing (stuck) | 4 return visits in 2 weeks, no cart |
| PS | 0.5 | no price sort |
| JT | 0.4 | — |
| DE | furniture 0.5 · electronics 0.4 | — |
| TR | 0.5 | opens "delivery & assembly" (big-purchase worry) |
| BF | self | — |

**Signals:** Pinterest referrer · 11 min on one product. **Confidence 0.85.**
**Persona mix:** explorer 0.5 · balanced 0.3 · specs 0.2 → **explorer** (weak fit)

**What the product does:** Large room photos. Dimensions shown visually, not as a table.
Swatches. Delivery, assembly and returns clear. On return: "Still thinking about this?" with
her saved items and **what changed since last time**.
**On the laptop store:** Big photos; size and weight shown visually ("fits a 14-inch
sleeve"); her shortlist resumed on return.
**Chat moment:** *"show only the 3 I saved and what's different"* → comparison cut to the fields that differ
**How we know it helped:** fewer visits before she buys.
**What we can't know:** what is really stopping her. Only the chat can find out.
⚠ Needs **return-visit memory**, which `bogdan/SPEC.md` lists as a non-goal. See gap 3.

---

## 6 · Radu, 41 — home insurance · finance ⭐ demo

**In one line:** Wants to understand what he is buying. Worried, knows little.

| Trait | Value | How we measure it |
|---|---|---|
| DE | insurance 0.2 · electronics 0.4 | search `asigurare locuinta ce acopera` |
| JT | 0.05 | opened glossary links 3× |
| IA | 0.6 (clarity, not volume) | 4 min on exclusions |
| IS | researching | left the quote form at step 3 of 5, came back next day |
| PS | 0.5 | — |
| TR | 0.25 | opened "what's NOT covered" first |
| BF | self | — |

**Confidence 0.86.**
**Persona mix:** simple 0.6 · balanced 0.4 → **simple**

**What the product does:** Plain language everywhere. "What's covered / what's not" first,
in two simple columns. Every term explained inline. Shorter quote form, progress shown.
**No promotional framing** — here it looks like hiding something. Policy text comes from the
insurer word for word (regulated: the "never invent product facts" rule is the law here).
**On the laptop store:** Plain words, terms explained, warranty and returns near the top, no
"deal" badges.
**Chat moment:** *"just tell me what is NOT covered"* → `{ promote: ["exclusions"], coverage: "plain_two_column" }`
**How we know it helped:** more people finish the quote form past step 3.
**What we can't know:** whether he understood, or just gave up reading.

---

## 7 · Ioana, 45 — project software for her team · B2B SaaS

**In one line:** Will it work with what we already use, and what will 30 seats really cost?

| Trait | Value | How we measure it |
|---|---|---|
| DE | b2b_saas 0.6 | knows her team's work well, the product category less (see gap 4) |
| IA | 0.8 | opened integrations, pricing, security pages |
| JT | 0.6 | — |
| PS | 0.6 | moved the seat counter to 30 |
| IS | researching | 3 visits, longer each time |
| TR | 0.5 | opened security/GDPR page |
| BF | **other** (her company) | — |

**Signals:** Google `project tool jira integration` · company network · downloaded nothing.
**Confidence 0.78.**
**Persona mix:** specs 0.5 · balanced 0.4 · deals 0.1 → **balanced** (specs is below 0.55)

**What the product does:** Integrations above features. Price at **her** seat count. Security
and compliance visible. Features described as team results. "Book a demo" over "free trial" —
she cannot decide alone for a team.
**On the laptop store:** Use-case framing from the catalog's plain-benefit text ("for office
work and video calls"), bulk/business price only if the shop has one.
**Chat moment:** *"show prices for 30 people, yearly"* → `{ price_cta: "total_cost", seats: 30, billing: "annual" }`
**How we know it helped:** demo bookings; pricing viewed at her real seat count.
**What we can't know:** who else decides, and what they care about.

---

## 8 · Bogdan, 52 — a used car · automotive

**In one line:** Does not want to get burned. Reliability over everything.

| Trait | Value | How we measure it |
|---|---|---|
| TR | **0.15** | reviews sorted "most critical", "verified seller" on |
| IA | 0.7 (evidence only) | 3 min on reliability data, opened service history first |
| IS | researching | 14 cars viewed, zero enquiries |
| PS | 0.6 | looks at warranty and running costs |
| JT | 0.6 | — |
| DE | automotive 0.6 · electronics 0.5 | — |
| BF | self | — |

**Signals:** desktop only · opened warranty, then return policy. **Confidence 0.80.**
**Persona mix:** balanced 0.6 · specs 0.4 → **balanced** — Bogdan's set has no "skeptic". See gap 1.

**What the product does:** Service history and inspection report first. Reviews open,
**critical ones not hidden**. Total cost of ownership, not just sticker price. Warranty and
service network. **Deal badges and "only 2 left" banners removed** — they lower his trust.
**On the laptop store:** Critical reviews first, warranty and repairability up top, no deal
badges or urgency.
**Chat moment:** *"no sales banners please"* → `{ suppress: ["dealStrip", "urgency"], scope: "global" }`
**How we know it helped:** first enquiry (he has 0 in 14 cars now).
**What we can't know:** whether he will ever buy. Some skeptics research forever.

---

## 9 · Maria, 67 — a prescription refill · pharmacy

**In one line:** Must not make a mistake. Not confident online. Uses a tablet.

| Trait | Value | How we measure it |
|---|---|---|
| IA | 0.15 | opened "how to order", nothing else |
| JT | 0.05 | — |
| IS | deciding | knows what she needs, one item |
| PS | 0.4 | — |
| DE | pharmacy 0.3 · electronics 0.1 | — |
| TR | 0.4 | copied the phone number (wants a human) |
| BF | self | — |

**Signals:** bookmarked direct entry · tablet 768 px · slow scroll · 3 mis-taps near small
buttons · 12 min for one item. **Declared:** "Bigger text, please" (accessibility setting).
**Confidence 0.70, plus a declared preference.**
**Persona mix:** simple 0.9 · balanced 0.1 → **simple** (strongest match in the set — his
`simple` persona reads font size and mis-taps directly)

**What the product does:** Large text, large buttons. One action per screen. Numbered steps.
**Phone number visible on every step** — don't hide it behind the chat. No carousels, no
pop-ups, nothing on a timer. Confirmation screens that say in plain words what happens next.
**On the laptop store:** Same: `simple` view, large type (`fontScale 1.3`), one button.
**Chat moment:** her preference came from the accessibility setting, not chat — it overrides
everything inferred (ADR-003).
**How we know it helped:** the task gets done — online *or* by phone. Fewer mis-taps per session.
**What we can't know:** and must not guess — **why** she wants bigger text. We respond to the
request, never to her age (ADR-002).

---

## 10 · Gheorghe, 74 — a present for his granddaughter · toys

**In one line:** Wants something she will really like. Knows nothing about toys.

| Trait | Value | How we measure it |
|---|---|---|
| DE | toys 0.1 · electronics 0.2 | search `cadouri fetita 7 ani` |
| BF | **other** | opens "age suitability" on every product; prices 80–400 RON (wide spread) |
| IA | 0.4 | 3 products, 6 min each |
| JT | 0.1 | — |
| PS | 0.4 | the wide spread means no fixed budget |
| IS | researching | — |
| TR | 0.5 | opened return policy early |

**Signals:** opened "gift wrapping". **Declared (chat):** *"It's a gift for my
granddaughter, she is 7."* **Confidence 0.60** — just above Bogdan's 0.55 cut-off; the
declared answer is what makes this profile usable.
**Persona mix:** simple 0.5 · balanced 0.5 → **balanced**. No "gift buyer" type. See gap 2.

**What the product does:** Suitability first ("good for ages 6–8"). Returns and gift options
up top. "Arrives by" date visible. Materials and specs hidden. **Asks the one question
behaviour can't answer: "Who is it for?"**
**On the laptop store:** Suitability framing ("good for email, video calls, photos"),
returns and delivery up top, specs hidden.
**How we know it helped:** he answers the "who is it for?" prompt; the gift is not returned.
**What we can't know:** what the granddaughter actually likes.

The recipient's age (7) is something *he* told us, about someone else. That is a declared
input, not an inferred one, so ADR-002 allows it.

---

## Summary

| # | Name | Shop | IA | JT | PS | TR* | IS | BF* | Bogdan persona | Conf. |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Tudor | fashion | 0.15 | 0.2 | 0.5 | 0.7 | browsing | self | explorer | 0.82 |
| 2 | Ana | travel | 0.6 | 0.5 | **0.95** | 0.5 | comparing | self | deals | 0.90 |
| 3 | Mihai | electronics | **0.9** | **0.9** | 0.4 | 0.6 | comparing | self | specs | 0.91 |
| 4 | Elena | groceries | **0.1** | 0.5 | 0.4 | 0.8 | deciding | self | *(none)* | 0.95 |
| 5 | Cristina | furniture | 0.7 | 0.4 | 0.5 | 0.5 | comparing (stuck) | self | explorer | 0.85 |
| 6 | Radu | insurance | 0.6 | **0.05** | 0.5 | 0.25 | researching | self | simple | 0.86 |
| 7 | Ioana | B2B SaaS | 0.8 | 0.6 | 0.6 | 0.5 | researching | **other** | balanced | 0.78 |
| 8 | Bogdan | automotive | 0.7 | 0.6 | 0.6 | **0.15** | researching | self | *(none)* | 0.80 |
| 9 | Maria | pharmacy | 0.15 | 0.05 | 0.4 | 0.4 | deciding | self | simple | 0.70 + declared |
| 10 | Gheorghe | toys | 0.4 | 0.1 | 0.4 | 0.5 | researching | **other** | balanced | 0.60 + declared |

\* proposed, not in schema yet.

**Check passed:** no two people have the same trait values, so each should get a visibly
different page (the acceptance test in `specs/personas.md`).

---

## Gaps found by comparing with `bogdan/SPEC.md`

Bogdan's spec was read for the first time on 2026-11-07. Flagged here, **not changed** on
either side — this is for the team to decide.

1. **No skeptic persona.** Bogdan (#8) and Radu (#6) need persuasion *removed*. His
   `dealStrip` shows "only real discounts", but no persona turns it off. Same gap as our
   missing trust axis — one field (`trust`) would cover both specs.
2. **No repeat-buyer or gift-buyer persona.** Elena (#4) and Gheorghe (#10) both land on
   `balanced`, so his engine would show them the default page. Our axes handle them; his
   persona set does not.
3. **No return-visit memory.** His spec lists "cross-session tracking" as a non-goal.
   Cristina's (#5) best moment — "what changed since you were last here" — needs it.
   localStorage only, no account, would be enough.
4. **Task vs. product expertise** (Ioana #7) — still one number per shop type in both specs.
   Accepted as a simplification for the hackathon.
5. **The two specs fit together well otherwise.** Our traits are a finer layer *under* his
   personas: the persona weights above are computed from the traits. Same threshold idea
   (his 0.55), same "explicit choice beats inference" rule (his truth model layer 2 = our
   ADR-003), same "LLM emits JSON, not markup" rule.
