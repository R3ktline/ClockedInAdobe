# Spec — Ten visitors: raw data → inference → page

Date: 2026-11-07. Companion to `specs/personas.md` (which holds the abstract axes).
Vertical: laptops. Currency: RON. `[ASSUMPTION]` — change if the demo locale differs.

**Purpose.** Worked examples of the whole inference pipeline. For each visitor:

| Column | What it is |
|---|---|
| **Who they are** | Narrative, for *our* understanding only. The system never knows this. |
| **What the system sees** | The actual raw signals. This is all we get. |
| **What it infers** | The conclusion, with a confidence. |
| **What the page does** | The resulting `UIIntent` in prose. |
| **What we can't know** | The honest limit. |

**The gap between column 1 and column 2 is the privacy story.** We produce a good page
without knowing who anyone is. No age, no gender, no income, no identity — see ADR-002.

> **These are not classes.** They are ten points sampled from a continuous space, chosen
> because they're far apart. Real visitors land between them. See "One page per person" in
> `docs/02-architecture.md`.

---

## 1. Andrei — the one who knows more than the site

**Who they are:** CS student, has built two desktops, reads hardware reviews for fun.

**What the system sees:**
- Referrer: `youtube.com` (a hardware review channel)
- Entry search: `rtx 5070 laptop 32gb ram`
- Opened spec table **2 seconds** after load, before scrolling anything else
- Dwell on spec table: 95s. Opened ports diagram. Opened "upgradeability"
- Added 3 models to comparison
- Never opened "What is this good for?"

**What it infers:** `domainExpertise 0.9` · `informationAppetite 0.9` · `jargonTolerance 0.9` · `intentStage comparing` · **confidence 0.91**

Three independent signals agree: technical vocabulary in the query, a technical referrer, and an immediate spec-table open. This is the cheapest high-confidence read in the whole set.

**What the page does:** Spec table expanded by default and moved above the marketing copy. Benchmark comparison promoted. Ports diagram and upgrade paths visible. Reviews filtered to technical ones. "What is this good for?" hidden — it would insult him.

**What we can't know:** His budget. Expertise says nothing about price sensitivity, and we must not assume a student is poor — that's demographic inference by the back door.

---

## 2. Elena — the one the site is failing right now

**Who they are:** Primary school teacher, last bought a laptop eight years ago.

**What the system sees:**
- Referrer: Google, query `laptop bun pentru birou`
- Opened **zero** blocks in 4 minutes
- Viewed **7 products**, average 34s each
- Scrolled past the spec table on every one without stopping
- Back button 5 times
- No sort, no filter, no comparison, no cart

**What it infers:** `domainExpertise 0.15` · `informationAppetite 0.2` · `jargonTolerance 0.1` · `intentStage browsing` · **confidence 0.74**

**The subtle part:** seven products in four minutes *looks* like active research. It isn't. Combined with zero block-opens and a high back-button rate, it reads as **repeated bouncing off pages that don't answer her question**. High view count with zero engagement is a confusion signal, not an expertise signal. Getting this backwards would be the single worst error the engine could make.

**What the page does:** Three plain-language benefit bullets ("handles Office, video calls and Netflix; battery lasts a full workday"). One image. One price. One button. Spec table collapsed behind "Technical details". All jargon swapped for the catalog's plain-language field.

**What we can't know:** Whether she wants simplicity or is simply lost and would welcome guidance. **This is where the chat should proactively offer**, not wait — her back-button rate is the trigger.

---

## 3. Mihai — the one optimizing lei per performance

**Who they are:** Comparing hard across three sites before buying anything.

**What the system sees:**
- Referrer: a price-comparison site
- Sorted by price (ascending) **twice**
- Applied filter: max 3,000 RON
- Opened "price history" on 2 products
- Viewed the refurbished section
- Opened spec table but dwelled only on RAM and storage rows

**What it infers:** `priceSensitivity 0.95` · `domainExpertise 0.5` · `informationAppetite 0.7 (price-relevant only)` · `intentStage comparing` · **confidence 0.88**

Selective spec reading is the interesting signal: he opens the table but only reads the two rows that justify a price gap. High appetite, narrow scope.

**What the page does:** Price leads. Price history chart. Performance-per-lei. Cheaper alternatives and refurbished options surfaced. Spec table reduced to only the fields that explain the price difference. Deal badges on.

**What we can't know:** Whether the 3,000 RON filter is a hard ceiling or an opening position.

---

## 4. Sofia — the one who already decided

**What the system sees:**
- Direct entry, straight to a specific product URL (no search, no category page)
- **22 seconds** on page
- Opened "delivery options" only
- Added to cart

**What it infers:** `intentStage deciding` · `informationAppetite 0.1` · **confidence 0.93**

**Expertise is irrelevant here, and that's the lesson:** the axes are independent. Intent dominates. We don't know if she's an expert and we don't need to.

**What the page does:** Price, stock, delivery date, warranty, checkout. Everything else collapsed. No recommendations above the CTA. **This is the one case where the right personalization is to get out of the way** — a counterexample to "personalization = add more."

**What we can't know:** Why she chose this model. She did the research somewhere we can't see — probably on a competitor's site.

---

## 5. Radu — the one buying for someone else

**Who they are:** Buying a laptop for his mother.

**What the system sees:**
- Entry search: `laptop simplu pentru parinti`
- Opened "return policy" within 30s
- Viewed 3 products at **1,800 / 2,400 / 4,100 RON** — wildly different price bands
- Opened "What is this good for?" on all three
- Never opened a spec table

**What it infers:** `domainExpertise 0.2` · `jargonTolerance 0.1` · **purchasing for a third party — confidence 0.55 only**

The genuinely clever signal is the **price-band spread**. Someone buying for themselves converges on a budget. Scattering across 1,800–4,100 RON means no fixed internal need — characteristic of buying for someone whose requirements you don't know. Supporting evidence from the query text and the early return-policy check.

But 0.55 is **below our confidence threshold**, so per ADR-005 the engine degrades toward neutral rather than guessing.

**What the page does:** Suitability framing ("good for: email, video calls with family, photos"). Return policy and delivery timing promoted. Specs hidden — he couldn't evaluate them anyway. Gift options surfaced.

**What we can't know:** Almost everything that matters — the recipient's actual needs, their eyesight, whether they've used a laptop before. **No amount of behavioral data gets us there.** This visitor is the clearest argument for the chat: one question ("who's it for?") beats any inference we could make.

---

## 6. Ioana — the one who knows her job, not the parts

**Who they are:** Freelance video editor. Knows exactly what she needs to *do*.

**What the system sees:**
- Entry search: `laptop pentru montaj video 4k davinci`
- On-site search: `davinci resolve`
- Opened spec table — but dwelled **only** on GPU and RAM rows, ignored ports, ignored display
- Opened "sustained performance"
- Viewed 2 products, 6 minutes each

**What it infers:** `taskExpertise 0.9` · `componentExpertise ~0.4` · `informationAppetite 0.6` · `intentStage researching` · **confidence 0.7**

**She breaks our schema.** `domainExpertise` is a single number per domain, but she is expert at her *task* and mediocre on *components*. The selective spec-row dwell is the tell — she knows GPU and RAM matter for her work, and doesn't care about the rest.

Recorded as a known limitation in `specs/personas.md`. Recommendation stands: accept the simplification for the hackathon, state it honestly if asked.

**What the page does:** "Can it run DaVinci Resolve at 4K" framing. Real-world task benchmarks instead of synthetic scores. Software compatibility. Sustained-load performance and thermals. Specs translated into task outcomes.

**What we can't know:** Her project scale — 10-minute YouTube cuts and feature-length work need very different machines, and nothing observable distinguishes them.

---

## 7. Cristina — the one who keeps coming back

**What the system sees:**
- **Visit 6** over 9 days (localStorage)
- Stored product IDs: 3, unchanged since visit 3
- Opened the comparison tool on 4 of 6 visits
- One stored product dropped **400 RON** since visit 4
- Dwell rising per visit: 2min → 11min
- Still no cart

**What it infers:** `intentStage comparing (stalled)` · `informationAppetite 0.8` · **confidence 0.85**

Rising dwell with no decision across six visits means she isn't missing information — she's stuck between three options that look equivalent to her. More detail would make it worse.

**What the page does:** Resumes her shortlist immediately. Comparison of the 3 stored products. **"What changed since you were last here"** — the 400 RON drop, flagged. A "the difference that actually matters" summary reduced to the 2–3 fields where the three models genuinely diverge. Previously-rejected products hidden.

**Strongest demo beat in the set** — "the site remembers where you left off" is instantly legible to anyone watching.

**What we can't know:** What's blocking her. The chat is the only route to it.

---

## 8. Bogdan — the one who doesn't trust you

**Who they are:** Last laptop died in 14 months.

**What the system sees:**
- Opened **reviews first**, before specs or price
- Sorted reviews by "most critical"
- Dwell on reviews: 180s
- Opened warranty terms, then return policy
- **11 products viewed, zero add-to-cart**
- Clicked "verified purchase only"

**What it infers:** low trust · `informationAppetite 0.7 (evidence-focused)` · `intentStage researching` · **confidence 0.8 on the behavior, but the schema has no axis for it**

**He breaks the schema too.** There is no trust axis. Currently approximated by high review appetite — flagged `[ASSUMPTION]`.

**What the page does:** Reviews expanded, critical ones *not* buried, verified-purchase filter pre-applied. Warranty terms, repairability, reliability data promoted. **Promotional copy and deal badges suppressed** — for him they actively reduce trust.

He is the best counterexample to "personalization means more upselling." His personalized page has **less** persuasion on it than the default. Worth a line in the pitch.

**What we can't know:** Whether he'll ever buy. Some skeptics research indefinitely.

---

## 9. Daniela — the one who told us

**What the system sees:**
- An explicit, persistent preference: *"Make this simpler — short sentences, no tables."*
- Set via chat on a previous visit
- Source: `chat`. Scope: `global`

**What it infers:** **nothing. It doesn't need to.** `confidence 1.0` — she told us.

Her behavioral signals are deliberately **not** used to modify this. Per ADR-003, explicit beats inferred unconditionally. If she opens a spec table tomorrow out of curiosity, her pages do **not** re-expand.

**What the page does:** Maximum plain language. One idea per block. No dense tables, no side-by-side comparisons. Generous spacing, strong hierarchy, explicit next step.

**What we can't know — and must not try to:** *why* she wants this. Could be a cognitive accessibility need, a non-native reader, low vision, or simple preference. **Inferring the reason is exactly what ADR-002 forbids.** We honour the request without profiling the person behind it. This is the ADR-007 accessibility case, and it is opt-in only.

---

## 10. Alex — the one with 40 seconds

**What the system sees:**
- Viewport 375×812, mobile user-agent
- Referrer: an Instagram ad
- Session: **38 seconds**
- Scroll velocity: high, no stops
- 2 products, ~15s each
- Opened nothing

**What it infers:** `informationAppetite 0.15` · `intentStage browsing` · `priceSensitivity 0.7` (ad-sourced) · **confidence 0.8**

All Tier 1 data — viewport and referrer were free, before he interacted with anything.

**What the page does:** Image-led. One price. One CTA above the fold. Shortest copy in the set. Everything else collapsed.

**What we can't know:** Whether he's a genuine prospect or an accidental ad tap. Most are the latter, which argues for spending the least compute on this visitor — he's also the cheapest to serve.

---

## What the ten tell us

1. **Three independent agreeing signals is enough for high confidence** (Andrei, 0.91). One signal is never enough.
2. **High engagement volume can mean confusion, not interest** (Elena). Seven products with zero block-opens is a *failure* signal. Inverting this would be the engine's worst possible error.
3. **Confidence varies hugely — 0.55 to 1.0 — and must gate behavior** (ADR-005). Radu at 0.55 gets a near-neutral page. Guessing would be worse than doing nothing.
4. **Declared beats inferred, permanently** (Daniela, confidence 1.0). The cheapest high-quality data in the system comes from asking.
5. **Sometimes the right personalization is less** (Sofia, Bogdan). Get out of the way; remove persuasion. Useful against "this is just an upsell engine."
6. **Two visitors break the schema** (Ioana — task vs. component expertise; Bogdan — no trust axis). Both logged honestly rather than papered over.
7. **Novel signals worth noting:** price-band *spread* indicates third-party purchasing (Radu); selective spec-*row* dwell reveals which components a visitor actually understands (Ioana, Mihai); rising dwell with no conversion means stalled, not uninformed (Cristina).

## Demo picks

**Andrei (1), Elena (2), Cristina (7).** Maximum visual contrast, and Cristina's "what changed since you were last here" is the beat that makes the whole thing feel alive. Keep the rest as fixtures.
