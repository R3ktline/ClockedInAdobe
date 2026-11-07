# Spec — Signal model: from clicks to a page shape

Date: 2026-11-07. Status: **proposal, not ratified.** Answers the brief in
`specs/personality-detection-brief.md`. Runnable reference implementation:
[`scripts/signal_model.py`](../scripts/signal_model.py) — every number in this file comes
from running it. **All weights are `[ASSUMPTION]`, hand-set, and not tuned on real visitors.**

---

## 0. The answer in one paragraph

Every click becomes an **evidence item** with a source tier and a **correlation group**.
Evidence adds up per trait, but each group is **capped**, so ten signals that measure the
same thing count as one strong signal, not ten. Each trait gets a **value** *and* a
**confidence**; confidence is high only when **two or more independent groups agree**. A
trait below 0.55 confidence is treated as neutral. Fixed rules then turn the confident
traits into the team's **persona = dialect × need**. A declared preference pins a trait and
beats everything. Tested on the 10 client profiles and 3 held-out visitors: **10/10 and 3/3
after one round of fixes** (6/10 and 2/3 before), and stable when every weight is shaken by
±25%. That result is partly circular — see §8.

## 1. Where it lives

```
 store page                                      server
┌──────────────────────┐   events   ┌──────────────────────────────────────────────┐
│ signals.ts  (consent │─────────► │ 1 EVIDENCE   event -> (trait, ±, tier, group) │
│ gate first)          │            │ 2 ACCUMULATE capped group sums per trait      │
│                      │            │ 3 SCORE      value + confidence per trait     │
│ localStorage:        │◄─ groups ─ │ 4 RULES      intent stage, buyingFor          │
│ last visit's group   │            │ 5 MAP        traits -> dialect x need         │
│ sums only (consented)│            │              (+ copy register, gift context)  │
└──────────────────────┘            └──────────────────────────────────────────────┬──┘
                                                   ▼
                          slide 0 (instant, rules) · Director reads traits + evidence later
```

All five steps are **pure, deterministic functions**. No LLM. Cost per visitor: a few
hundred arithmetic operations. This is what makes slide 0 instant (ADR-004).

**Fit with the team's build** (from the team spec, read once 2026-11-07): steps 1–3 are the
inside of the `babel/markers` module. Steps 4–5 are the `babel/persona` "slide-0 rules
tuned on the 10 shoppers", a **Track C (David)** task. The model's traits are the team's
markers under short names:

| Here | Team marker | | Here | Team marker |
|---|---|---|---|---|
| IA | `infoAppetite` | | INS | `inspirationAppetite` |
| JT | `jargonComfort` | | IF | `interactionFluency` |
| PS | `priceSensitivity` | | CF | `confusion` |
| TN | `trustNeed` (= 1 − trust) | | stage | `purchaseIntent.stage` |
| buyingFor | gift context on the slide | | | |

Not modelled here: `hesitation`, `abandonmentRisk`, `categoryAffinity`, `featureInterest`,
`adaptationAcceptance`. They drive the Director *during* a visit, not the persona.

**What this adds to the team's markers:** the markers have a value but **no confidence**.
Without one, the 0.55 threshold in the team spec has nothing to compare against. §3 is the
missing piece, and it's worth raising with Matei (Track D).

## 2. Signal inventory

Three tiers (David's rule 1). Base weight: **B** repeated on-page behaviour 1.0 · **S**
single action or search wording 0.5 · **C** circumstantial (arrival, session shape) 0.25.
**Declared** is not a weight: it pins the trait (§4).

| Signal | Tier | Moves | Group |
|---|---|---|---|
| spec / detail block opened | B | IA + | detail_depth |
| long dwell on a table | B | IA + | detail_depth |
| dimensions opened | B | IA + | detail_depth |
| product viewed, nothing opened | B | IA − | detail_depth |
| detail skipped / added from list | B | IA − | detail_depth / pace |
| added to comparison | B | IA +, IF + | comparison, control |
| technical section opened (ports, upgrades) | B | JT + | technical_sections |
| technical filter used | B | JT +, IF + | technical_sections, control |
| glossary / "what does this mean" opened | B | JT − | jargon_struggle |
| search with acronyms, units, model numbers | S | JT +, IA + | technical, search |
| conversational search ("for my parents") | S | JT − | technical |
| sort / filter by price | B | PS + | price_focus |
| price history, total incl. fees, cheaper alternative | B | PS + | price_detail |
| arrived from a price-comparison site / deal campaign | C | PS + | arrival |
| reviews opened first, sorted "most critical", verified-only | B | TN + | evidence_seeking |
| returns / warranty / exclusions / security page opened | B | TN + | policy_check |
| came back without buying, many views, no cart | B | TN + | no_commit |
| previous orders (partner data) | B | TN − | history |
| phone number copied | B | TN +, IF − | human_contact, guidance |
| gallery swipes, image zoom | B | INS + | visual_engagement |
| fast scroll | B | INS +, IA − | browse_pace, pace |
| social referrer | C | INS + | arrival |
| mis-tap (tap just outside a target, then a correction) | B | IF − | motor |
| slow deliberate scroll, "how to order" opened | B | IF − | pace_ui, guidance |
| search box used, filter combos | B | IF + | control |
| back button, search refined with no click, dead click | B | CF + | bouncing, search_fail, friction |
| short session | C | IA − | pace |

**Deliberately absent: device type, screen size, pixel ratio.** A phone says nothing about
its owner. This is the bug in Matei's tier 3, where every phone was classed "55+, simple".
Also absent: anything that needs an IP lookup.

**Intent stage** and **buyingFor** are categories, so they get rules, not sums:
- `deciding`: cart / reorder / checkout (0.9), or direct product link + delivery opened (0.8)
- `comparing`: ≥ 2 compare-adds, ≥ 2 saved items, or the same shortlist on ≥ 2 visits
- `researching`: ≥ 2 deep opens (specs, policies, reviews-first, dimensions)
- `browsing`: otherwise
- `buyingFor = other`: declared (1.0); seat counter used (0.7); or two of {age-suitability
  opened, gift options opened, price spread ≥ 3×} (0.6). Otherwise **`unknown`, never
  `self`** — silence is not evidence.

## 3. Accumulation and confidence (David's rules 2 and 3)

**Per signal:** `contribution = tierWeight × strength × direction × (1 − 0.5ⁿ)`, where n is how
often it happened. Repeats count, with diminishing returns: 1× → 50%, 2× → 75%, 3× → 88%.

**Per correlation group:** contributions are summed, then **capped at ±1.2**. This is the
anti-double-counting rule. Five spec-table opens and three long dwells together can't add
more than one group's worth.

**Per trait:**
```
L          = Σ capped group sums
value      = 1 / (1 + e^(−L))                       neutral start: L = 0 → 0.5
mass       = Σ |group sums|
agreement  = |L| / mass                             1 = groups agree, 0 = they cancel out
confidence = agreement × (1 − e^(−mass))
if fewer than 2 groups (≥ 0.3, same direction) back it: confidence ≤ 0.6
```

What this gives you, in plain terms:
- **One group alone never decides much.** It is capped at 0.6 confidence.
- **Two agreeing groups of moderate size pass the threshold.** Radu: policy checks + coming
  back without buying → trust need 0.74, confidence 0.64.
- **Three strong agreeing groups give high confidence.** Mihai: infoAppetite 0.90 at 0.89.
- **Conflict lowers confidence instead of averaging to a fake middle.** Agreement drops,
  so the trait goes neutral (ADR-005).

**Decay.** Transient traits (confusion) should fade with a 30 s half-life, matching the team's
markers: `contribution × 0.5^(age/30 s)`. Session traits don't decay within a visit. *The
script tests snapshots, so decay is specified but not exercised.*

**Return visits** (needs consent; open question 22). Store **only the capped group sums**,
never raw events. On the next visit, multiply them by 0.6 and add the new evidence. Tested:
Mihai's first visit carried over, then a second visit where he skips every detail →
infoAppetite falls to 0.44 at confidence 0.13 → **neutral page, not his old dense one.** New
behaviour beats the old guess, and a contradiction produces *less* adaptation.

## 4. Declared beats inferred (ADR-003)

- A chat preference or a settings toggle **pins** a trait: value as stated, confidence 1.0.
  Inference keeps running for the profile viewer, but never overrides the pin.
- A view switch pins the **dialect**. An explicit request ("just the basics") pins the **need**.
- An **OS / account accessibility setting** (large text, high contrast) sets the `guided`
  dialect directly. It is a need the visitor declared to their device. This is how Maria is
  served **without guessing her age** (ADR-007 frame).

### Age — already settled by the team

The brief's question B was settled in the team's decision log on 2026-11-07: **no age
inference.** A partner may send an `ageBand`, with consent, as a weak prior on dialect
(≤ 0.2), never for prices or offers. Here that is one C-tier signal in its own group:
`0.25 × 0.8 × 0.5 = 0.1` logit, capped at 0.6 confidence as a single group.

**The honest consequence: it can tip a near-tie, never decide anything alone.** In practice
it does almost nothing, which is the point. Demo fixtures leave it unset. `ageBand: minor`
does one thing: it disables the `deals` need (the team's DSA Art. 28 rule).

## 5. Traits → page (the mapping)

**Dialect** — first matching rule wins. Every inferred rule needs its traits at ≥ 0.55 confidence.

| # | If | Dialect |
|---|---|---|
| 1 | visitor picked a view | that one |
| 2 | OS large text / high contrast | `guided` |
| 3 | interactionFluency ≤ 0.35 | `guided` |
| 4 | confusion ≥ 0.6 | `guided` (one step simpler — **never** denser) |
| 5 | inspiration ≥ 0.65 and ≥ infoAppetite | `visual` |
| 6 | jargonComfort ≥ 0.65 and infoAppetite ≥ 0.65 | `dense` |
| 7 | jargonComfort ≤ 0.3 and infoAppetite ≤ 0.55 | `guided` |
| 8 | otherwise | `standard` |

**Need:**
1. Declared → that one.
2. **`quick`** if the stage is `deciding` (≥ 0.8) and infoAppetite ≤ 0.4. The visitor already
   chose; get out of the way.
3. Otherwise the strongest qualifying trait: trust need ≥ 0.6 → `reassurance`, price ≥ 0.65 →
   `deals`, appetite ≥ 0.65 → `specs`, inspiration ≥ 0.65 → `inspiration`.
   - **Ties go to `reassurance`** (+0.05): wrongly removing persuasion costs less than wrongly
     adding it.
   - **Inspiration is not counted twice:** if it already made the dialect `visual`, it only
     becomes the need when nothing else qualifies.
4. Otherwise `balanced`.

**Also derived:** copy register — `plain` if jargonComfort ≤ 0.35, `technical` if ≥ 0.65,
else `standard` (confident values only); gift context = `buyingFor` is `other`.

**Fallback is per dimension** `[PROPOSAL — differs from the team spec]`. The team spec says:
below 0.55, use `standard × balanced` for the whole persona. Here the dialect and the need fall
back **separately**. Radu has a confident need (reassurance) but no confident dialect, so he
gets `standard × reassurance` instead of losing both. Same principle (less adaptation, not a
guess), applied more precisely. **Needs team agreement.**

## 6. Cold start and no consent

- **No consent:** nothing is collected, read or stored. `standard × balanced`, no markers.
- **First visit, no signals:** every trait 0.5 at confidence 0 → `standard × balanced`
  (the store's own good default page).
- **Arrival context only** (referrer, campaign tag): circumstantial tier, a single group →
  **cannot reach 0.55 alone**. Held-out H3 (Instagram ad, 38 s, fast scroll): inspiration
  0.66 at confidence 0.48 → **stays neutral.** One ad click is not a personality.
- The first page that adapts is the **first slide after real behaviour**, usually 10–30 s
  in. Exception: declared accessibility settings act on slide 0.

## 7. Privacy and explainability

**The Why? panel writes itself from the evidence groups.** The top group behind each adapted
trait becomes one plain sentence about *behaviour*, never about the person:

| Trait | Sentence template |
|---|---|
| infoAppetite | "You opened the full specs on 3 products, so they're open by default now." |
| jargonComfort (low) | "You opened the glossary a few times, so we use plain words." |
| priceSensitivity | "You sorted by price, so cheaper options and the store's current offers come first." |
| trustNeed | "You checked the returns policy and reviews first, so they're at the top and sales banners are hidden." |
| inspiration | "You browsed mostly by photos, so this view leads with images." |
| interactionFluency (low) | "Some buttons were hard to hit, so they're bigger now." |
| confusion | "This page seemed hard to use, so here's a simpler version." |
| buyingFor | "You said it's a gift, so suitability and returns come first." |

**Never stored:** raw events beyond the session, age, IP address, device fingerprint,
anything a visitor volunteers about health or family (used for one answer, then dropped).
**Stored with consent:** capped group sums + visit count + saved items, in `localStorage`.

## 8. Validation — what was actually run

`python scripts/signal_model.py`, 2026-11-07. Raw signal counts per person are transcribed
from `specs/client-profiles.md` (`[ASSUMPTION]`). Expected personas are the team spec's
dialect × need for the 10 shoppers.

| | v1 (first run) | v2 (after 3 fixes) |
|---|---|---|
| 10 client profiles | **6/10** | **10/10** |
| 3 held-out visitors (from `visitor-fixtures.md`) | **2/3** | **3/3** |

**The three v1 → v2 fixes, each a structural flaw and not a tweak:**
1. Confidence was too strict. Two agreeing groups couldn't reach 0.55 (scale 1.5 → 1.0). This
   caused 4 misses.
2. Opening a spec table raised jargon comfort. Wrong: it shows appetite. Radu opens insurance
   exclusions because he is worried.
3. `quick` required *proof* of low appetite. Wrong: a cart or reorder click already shows the
   decision.

**Robustness** (every weight × random 0.75–1.25, 300 runs): 8 of 13 visitors keep their
persona 100% of the time, Radu 99%, Ioana 99%, H3 97%, **Victor 88%, Gheorghe 84%**. Weak
spots are where confidence sits near 0.55 — that's where doubt should be.

**Trait bands** (low/mid/high vs. the values written in client-profiles): **13 of 17** confident
traits land in the expected band; 23 trait slots stayed neutral for lack of evidence. The 4
mismatches are informative:
- Cristina, Ioana, Gheorghe come out with **trust need ≈ 0.73**, but client-profiles gives
  them trust 0.5. Their written behaviour (delivery/returns checks, security page, repeat
  visits without buying) *does* indicate a reassurance need, and the team spec expects
  `reassurance` for two of them. **The profiles' trust numbers are inconsistent with their own
  signals.** Fix the profiles, not the model.
- Victor: jargon comfort 0.71 vs 0.6 written. Borderline; `dense` needs ≥ 0.65.

**Why 10/10 is weaker than it looks — say this if asked:**
- **Circular.** The weights were set with these ten in view, and I wrote the signal counts
  from profiles I also helped write.
- **Held-out set contaminated.** H2's failure was seen while making fix 3, so H2 is no longer
  independent. H1 and H3 still are.
- **Clean inputs.** Real visitors are noisier: fewer signals, more contradictions. Expect lower
  real-world agreement.
- **Not compared against Matei's tracker.** The brief asked for a real port of his tiers. Not
  done here: his code is in the repo, and the instruction was to work locally. The brief's
  hand-traced baseline (1 of 3, by luck) stands unverified.

### Batch 2 — 10 new profiles, model frozen (2026-11-07)

`specs/client-profiles-2.md`: written **after** freezing the model (blob `b0fdc91`), with
expected personas fixed in advance from the team spec's definitions, 1–2 noise clicks each,
and harder cases (thin, lost, ambiguous, age labels that a stereotype would get wrong).
**No model change after the run.**

**Result: 9/10.** Robustness: 9 of 10 keep their persona in ≥ 93% of shaken runs.

| | Result | |
|---|---|---|
| 11 Andreea | `visual` × `reassurance` | ✅ despite a stray price sort |
| 12 Paul | `standard` × `specs` (expected `dense` × `specs`) | ❌ need right, dialect wrong — **0% across shaken runs, so a structural gap, not bad luck** |
| 13 Irina, 58 | `standard` × `specs` | ✅ age label didn't matter |
| 14 Sorin | `standard` × `quick` | ✅ |
| 15 Lavinia | `standard` × `balanced`, confidence 0 | ✅ thin evidence → no guess |
| 16 Dan | `standard` × `specs`, plain copy | ✅ detail-hungry but jargon-shy, handled |
| 17 Bianca | `visual` × `inspiration` | ✅ 15 views, no opens, but no bouncing → *not* read as lost |
| 18 Florin, 66 | `dense` × `specs` | ✅ age label didn't matter |
| 19 Corina | `guided` × `balanced` | ✅ lost → simpler |
| 20 Emil | `standard` × `reassurance` | ✅ trust beat price, as the tie rule intends |

**Why Paul missed — and it's a cost of v2 fix 2.** The `dense` dialect needs jargon comfort
from **two** independent groups. Paul's only jargon evidence is one technical search. His
four spec opens no longer count toward jargon, because fix 2 removed that link to stop
worried visitors (Radu) from looking technical. **The trade-off is real:** an expert who reads
spec tables but never opens a "technical section" or uses a technical filter stays on the
`standard` dialect.

The failure is in the safe direction: he gets the normal layout with specs emphasised,
not a wrong page.

Candidate fix, **not applied** (the model stays frozen until a fresh test set exists): count
*which* spec rows are read (acronym-heavy rows, i.e. the team's `featureInterest`) as a second
jargon group.

**Running total: 19/20 profiles + 3/3 held-out visitors.** Batch 2 is the first honest
out-of-sample number. It is still synthetic, and still written by the same agent that wrote
the model, so the inputs are cleaner and friendlier than real visitors.

**What real data would tune it.** Synthetic sessions can't tune weights. The honest training
signal is already in the team's design: **`adaptationAcceptance`** (did the visitor keep or undo
the slide, did they press Standard view). Log `(group sums at slide time → kept / undone)` and
fit a logistic regression per trait. Without real visitors, the weights stay hand-set, and we
should say so.

## 9. Risks and what we cannot know

- **Trust need and buyingFor are inherently weak.** Behaviour hints at them; asking settles
  them. "Who is it for?" in the chat beats every inference rule in §2.
- **Task vs product expertise** (Ioana) is still one number. Her copy register comes out
  `standard`, which is acceptable but not ideal.
- **Absence is not evidence.** A visitor who never sorted by price is not price-insensitive.
  The model leaves price neutral rather than guessing low.
- **Confusion vs simplicity.** Many views with no opens and lots of back-button = confusion,
  answered with a *simpler* page. Getting this backwards (handing a lost visitor a denser
  page) is the worst error. Held-out H1 tests exactly this and passes.
- **Instrumentation cost.** Mis-tap detection and "nothing opened" need the SDK to track which
  blocks exist and were seen. If only two things get built: **block opens and search text.**
- Seen in a repo commit message, not reviewed: a teammate's newer tracker reportedly sends
  visitor IPs to a third-party geolocation service and adds "age signals". Both conflict with
  this model and with the team's own no-age-inference decision. **Raise with Matei; don't port.**

## 10. Decisions needed (David)

1. **Per-dimension fallback** (§5) instead of the team's whole-persona fallback — propose to the team?
2. **"Ties go to the less-commercial page"** (§5) — keep as a rule?
3. **Correct the trust values** in `client-profiles.md` for Cristina, Ioana, Gheorghe (§8)?
4. **Port the model to TypeScript** for `babel/persona` once Node is installed — it's your Track C task.
