# Design briefs — 10 test people

Date: 2026-11-07. **Audience: the design workstream.** Self-contained — you don't need to
read anything else in this repo to use it.

---

## What you're designing

Not ten page layouts. **One page per vertical, that can render in several shapes.**

Every brief below is written as a **diff from the neutral baseline** (defined next). So for
each person you're answering: what moves to the top, what gets hidden, how dense is it, how
technical is the language.

### The neutral baseline

The normal, un-personalized page. Build this first for each vertical. **It has to be a
genuinely good page on its own** — it's what we show when we know nothing about the visitor,
and what we fall back to if anything breaks.

Default block order, top → bottom:

```
1. breadcrumb
2. hero / imagery
3. title + price
4. primary CTA
5. key facts (short)
6. full detail / specs
7. reviews
8. related items
9. policies (delivery, returns, warranty)
```

### What each block needs from you

Each block needs **3–4 variants** spanning dense → plain, all on-brand. Example:

```
full detail  → table_full | table_key | prose_benefits | hidden
hero         → gallery | single_image | room_context | minimal
reviews      → full_list | critical_first | summary_only | hidden
price_cta    → prominent | standard | total_cost | with_financing
key facts    → six_items | three_items | one_line | hidden
```

The system picks a variant per block, per visitor. **You design the variants; you never
design a per-person page.**

### How to test whether it's working

> Put any two briefs side by side as finished screens. Hand them to someone who hasn't seen
> this document. If they can't immediately tell which person each page is for, the variants
> aren't differentiated enough yet.

Second test, equally important:

> At least one page must end up **simpler and less commercial** than the neutral baseline.
> If every personalized page has *more* stuff on it than the default, we've built an upsell
> engine, not personalization.

⭐ = **the three to design first.** They have maximum contrast and they're the demo.

---

## 1 · Tudor, 16 — sneakers · fashion

**Cares about:** the brand, the hype, what his friends are wearing. It's not his money.
**Page feel:** fast, visual, almost no text. Phone-first (390px).

**Block order:**
```
1. hero — near-fullbleed image, swipeable
2. title + price (one line)
3. size availability
4. primary CTA
5. social proof — "1.2k bought this week"
6. related items
—— collapsed below ——
materials / construction, reviews, policies
```
**Hidden:** materials, construction detail, care instructions.
**Type & density:** large imagery, minimal body copy, generous tap targets.
**Don't:** write paragraphs. He will not read them.

---

## 2 · Ana, 23 — a trip to Spain · travel

**Cares about:** the cheapest option that still works. Flexible on dates, will trade comfort for price.
**Page feel:** numbers-forward, comparison-friendly.

**Block order:**
```
1. total price including all fees  ← non-negotiable, at the top
2. price calendar / cheaper nearby dates
3. title + location
4. primary CTA
5. the 3 amenities she filtered on (only those)
6. cheaper alternatives nearby
—— collapsed ——
photo carousel, full amenity list, reviews
```
**Hidden:** the big photo carousel (demote it), full amenity lists.
**Don't:** show a headline price that grows at checkout. It's the one thing that loses her.

---

## 3 · Mihai, 29 — a laptop · electronics ⭐ **DEMO**

**Cares about:** full specs, benchmarks, upgradeability. Reads hardware reviews for fun.
**Page feel:** dense, technical, zero hand-holding. The densest page in the set.

**Block order:**
```
1. title + price (compact)
2. full spec table — EXPANDED by default
3. benchmark comparison vs. similar models
4. ports diagram
5. upgradeability / what's replaceable
6. technical reviews only
7. primary CTA
—— hidden ——
"what's this good for", lifestyle photography, marketing copy
```
**Hidden:** plain-language benefit bullets, lifestyle imagery, anything promotional.
**Type & density:** small type is fine. Tables are fine. Information density is the point.
**Don't:** explain what RAM is. It reads as condescending and he'll leave.

---

## 4 · Elena, 34 — the weekly shop · groceries ⭐ **DEMO**

**Cares about:** speed. Same 40 items every week. Discovery is friction, not a feature.
**Page feel:** the **fastest and emptiest** page in the set. This is the subtractive one.

**Block order:**
```
1. ONE-TAP REORDER — last week's basket, pre-filled
2. delivery slot picker
3. search box
4. checkout
—— collapsed or removed entirely ——
recommendations, promotions, category browsing, "you might also like"
```
**Hidden:** recommendations, promos, category navigation, seasonal banners.
**Type & density:** functional, compact, minimum taps to done.
**Don't:** show her anything new. She's not shopping, she's restocking.

> **This is the page that proves personalization isn't just upselling.** Make it noticeably
> emptier than the baseline.

---

## 5 · Cristina, 38 — a sofa · furniture

**Cares about:** picturing it in her actual living room. Two weeks of consideration, big spend.
**Page feel:** visual, spacious, reassuring.

**Block order:**
```
1. hero — large room-context photography (not product-on-white)
2. title + price
3. dimensions — VISUAL, a diagram, not a table
4. fabric / colour swatches
5. delivery, assembly and returns  ← big-ticket anxiety, bring it up
6. primary CTA
7. reviews
```
**On a return visit, add at the top:** "Still thinking about this?" with her saved items and
what changed (price drops, stock).
**Don't:** put dimensions in a spec table. She's thinking spatially, not numerically.

---

## 6 · Radu, 41 — home insurance · finance ⭐ **DEMO**

**Cares about:** understanding what he's actually buying. Anxious, no domain knowledge.
**Page feel:** plain, calm, honest. No sales energy at all.

**Block order:**
```
1. "What's covered" / "What's not covered" — TWO PLAIN COLUMNS, side by side, at the top
2. plain-language summary of the policy
3. price
4. shortened quote form, with visible progress ("step 2 of 3")
5. full policy terms (collapsed, available)
—— removed ——
promotional framing, urgency, "best value" badges
```
**Hidden:** promotional banners, urgency cues, upsell tiers above the fold.
**Type & density:** generous line height, short sentences, every technical term defined
inline where it appears.
**Don't:** use industry language anywhere a plain word exists. And **no promotional framing**
— in insurance it reads as evasion and actively loses trust.

> Legal note: policy wording comes from the insurer **verbatim**. We can reorder and
> summarize around it, never rewrite it.

---

## 7 · Ioana, 45 — project software for her team · B2B SaaS

**Cares about:** will it work with what we already run, and what does it really cost at 30 seats.
**Page feel:** businesslike, evidence-led.

**Block order:**
```
1. integrations — above features
2. pricing AT HER SEAT COUNT (30), not a generic tier table
3. security / GDPR / compliance
4. features framed as team outcomes, not feature names
5. "Book a demo" as primary CTA
—— demoted ——
"Start free trial", individual-user framing
```
**Don't:** lead with a free trial. She can't self-serve a decision for a team of 30.

---

## 8 · Bogdan, 52 — a used car · automotive

**Cares about:** not getting burned. Reliability over everything.
**Page feel:** evidence-first, sober. **Less persuasion than the baseline.**

**Block order:**
```
1. service history + inspection report
2. reliability data / known issues
3. total cost of ownership (not sticker price)
4. reviews — EXPANDED, critical ones NOT buried
5. warranty + service network
6. verified seller badge
7. price + CTA
—— removed ——
deal badges, urgency banners, "3 people viewing this"
```
**Hidden:** deal badges, countdowns, scarcity cues.
**Don't:** use any urgency or scarcity device. For him they're evidence something's wrong.

---

## 9 · Maria, 67 — a prescription refill · pharmacy

**Cares about:** not making a mistake. Low digital confidence, uses a tablet (768px).
**Page feel:** large, calm, one thing at a time.

**Block order:**
```
1. "How to order" — explicit numbered steps
2. the item, large, with a large clear quantity control
3. ONE primary action
4. phone support number — VISIBLE, at every step
5. confirmation restating in plain words what's about to happen
```
**Hidden:** carousels, modals, timed elements, anything that moves on its own.
**Type & density:** large type, large tap targets (she mis-taps small controls), high
contrast, one action per screen.
**Don't:** hide the phone number behind a chat widget. She's trying to reach a human —
observed behaviour: she copied the number to her clipboard. Let her.

> Note: this layout responds to an **observed need and a declared preference**, not to her
> age. Same layout would serve a 25-year-old who asked for it.

---

## 10 · Gheorghe, 74 — a present for his granddaughter (7) · toys

**Cares about:** getting something she'll actually like. Knows nothing about the category.
**Page feel:** guided, reassuring.

**Block order:**
```
1. "Who's it for?" — ask directly, at the top
2. suitability framing — "good for ages 6–8, develops X"
3. hero image
4. price
5. gift wrapping + delivery-by date
6. return policy — prominent
7. CTA
—— hidden ——
materials, technical detail, specifications
```
**Hidden:** materials, specs, anything he can't evaluate.
**Don't:** make him choose from 40 options. Narrow it, then ask one question.

---

## Summary table

| # | Person | Vertical | Page is… | Leads with |
|---|---|---|---|---|
| 1 | Tudor, 16 | fashion | visual, minimal | image |
| 2 | Ana, 23 | travel | numbers-forward | total price |
| 3 ⭐ | Mihai, 29 | electronics | **densest** | spec table |
| 4 ⭐ | Elena, 34 | groceries | **emptiest** | one-tap reorder |
| 5 | Cristina, 38 | furniture | visual, spacious | room photography |
| 6 ⭐ | Radu, 41 | insurance | **plainest** | covered / not covered |
| 7 | Ioana, 45 | B2B SaaS | businesslike | integrations |
| 8 | Bogdan, 52 | automotive | evidence-first | service history |
| 9 | Maria, 67 | pharmacy | largest, calmest | how to order |
| 10 | Gheorghe, 74 | toys | guided | "who's it for?" |

**Start with 3, 4 and 6.** Mihai is the densest page, Elena is the emptiest, Radu is the
plainest. Three screens that prove the idea generalizes across verticals *and* prove that
personalization sometimes means **removing** things.
