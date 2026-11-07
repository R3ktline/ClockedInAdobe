# 00 — Concept (canonical)

Last updated: 2026-11-07

## The marketing problem we chose

> "Sites aren't suited explicitly for all users."

A website is built once, for an averaged-out imaginary visitor. Every real visitor
is a compromise against that average. The mismatch costs the merchant conversions
and costs the visitor time and confidence.

Today's answer to this is **segment-based personalization** (Adobe Target, Optimizely,
Dynamic Yield): a marketer hand-authors rules — "if visitor is in segment B, swap
hero banner C." It is coarse, manual, limited to a handful of pre-built variants,
and the visitor has no say in it.

## What we build

A layer that sits between a partner website and its visitor and reshapes the page to
fit that specific visitor — not a segment — and then lets the visitor **talk to it**.

Two halves:

**1. Inferred adaptation.** We build a profile of the visitor (expertise, intent,
decision style, information appetite) and the page renders itself accordingly on
arrival.

**2. Conversational adaptation.** A chat affordance on the page. The visitor says
"too much detail on each product, just give me the basics" and the page changes
immediately — and *stays* that way, because the instruction is written back into
their profile.

The second half is the part nobody shipped yet, and it is what makes the first half
trustworthy: personalization you can argue with.

## The canonical example — and how to frame it

The original framing was: a teenager looking at a laptop wants component specs; an
older person wants to know "is it fast?".

**Do not pitch it that way.** Two problems: it is inaccurate (plenty of 60-year-olds
build PCs, plenty of teenagers don't care about chipsets), and inferring capability
from age is a discrimination problem that will get the project torn apart in Q&A — and
would be an actual legal problem in production under GDPR Art. 22 and the EU AI Act.

**Pitch it on expertise and intent instead:**

| Axis | One end | Other end |
|---|---|---|
| Domain expertise | knows what "NPU TOPS" means | wants "handles video calls fine" |
| Intent stage | researching, comparing | decided, wants to check out |
| Decision driver | spec-maximizing | price-sensitive / brand-trusting |
| Information appetite | wants the full table | wants three bullets |

Same laptop page. Expert sees a dense spec table, benchmark comparisons, upgrade
paths. Novice sees "good for: video calls, Netflix, Office — battery lasts a workday",
one photo, one price, one button. Nothing was invented; the same catalog data was
filtered, ordered and re-voiced.

These axes are **observable from behavior** (did they open the spec tab? did they
sort by price? how long on the comparison view?) and **declarable by the user**. Age
is neither necessary nor used.

## Why a visitor would want this

Less noise, faster decisions, less feeling stupid on a site that assumes knowledge
they don't have — and a profile they can read, edit and switch off.

## Why a merchant would pay for this

Conversion lift and lower bounce on high-consideration catalog pages, without
authoring 40 page variants by hand. The pitch is "replace your rules engine with
something that scales to one-of-one and doesn't need a marketer in the loop."

## What this is NOT

- Not a recommender system. We are not picking *which products* to show (that is a
  solved, crowded space). We are reshaping *how the page presents* whatever products
  it shows. Recommendations are a possible later module, not the core.
- Not an AI page builder. The merchant's design system is respected absolutely.
- Not a content generator. See the "never fabricate product facts" rule in `CLAUDE.md`.
