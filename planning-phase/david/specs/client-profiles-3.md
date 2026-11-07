# Spec — 20 more client profiles (test batch 3)

Date: 2026-11-07. Status: **test fixtures, `[ASSUMPTION]` throughout.** Companion to
`specs/client-profiles.md`, `specs/client-profiles-2.md` and `specs/signal-model.md`.

**Written and frozen before the first run.** The expected pages below were fixed first, from the
team definitions of each dialect and need (`specs/signal-model.md` §5 and the glossary), and not
from the model's own rules. The model (`scripts/signal_model.py`) is not edited. The runner is
`scripts/batch3.py`, which only adds data. Nothing below the "Results" heading existed when the
expectations were written.

**What is different from batches 1 and 2, on purpose:**
- **Variety of person:** ages 21 to 78, 20 different things they are shopping for.
- **Variety of situation:** an expert, a bargain hunter, a skeptic, a gift buyer, a team buyer, a repeat
  buyer, a lost visitor, a thin visit, a photo browser, a return visit, a declared preference that
  fights behaviour, a declared view, denied consent, two accessibility settings, arrival-only evidence.
- **Pairs that pull against each other:** price against trust, detail hunger against confusion, expertise
  against a high-contrast setting, "just the basics" against spec-heavy behaviour.
- **Two cases aimed at weak spots we already know about:** #33 (an expert who reads spec tables but never
  opens a technical section, the gap that caused Paul's miss) and #38 (an expert who needs high contrast,
  where the spec turns an accessibility setting straight into the simple look).
- Most people have one off-pattern click added as noise. Scoring is strict on the first answer; a second
  defensible answer is listed and reported separately.
- The signal counts are my translation of each description into the model's signal inventory. They are
  written by an agent that has read the model, so they are cleaner than real visitors would be.

All numbers and behaviours are illustrative `[ASSUMPTION]`. Ages are labels for us; the model never sees age.

---

| # | Who (label only) | Shopping for | What they do | Off-pattern click | Tests | Expected | Also acceptable | Why |
|---|---|---|---|---|---|---|---|---|
| 21 | Hiro, 41 | A mechanical keyboard | Searches switch types and layouts, opens spec tables and the technical section, compares two boards, swipes one photo. | gallery_swipe | the plain expert case | `dense` x `specs` | - | technical vocabulary plus depth |
| 22 | Nadia, 78 | Hearing-aid batteries | Large text is on. Presses reorder, skips detail, mis-taps once, copies the phone number, zooms one photo. [context: {"os_large_text": true}] | image_zoom | accessibility setting plus a decided visitor | `guided` x `quick` | - | already decided and needs larger, simpler controls |
| 23 | Priya, 21 | A laptop for university | Arrives from a price-comparison site and a deal campaign, sorts and filters by price, checks price history and cheaper options, saves two, opens one spec table. | spec_open | strong price evidence with one off-pattern spec open | `standard` x `deals` | - | price is the whole story |
| 24 | Tomas, 56 | A used e-bike | Reads reviews first, sorts them most critical, filters to verified sellers, opens the returns policy twice, many views and no cart, opens two spec tables, sorts by price once. | price_sort | the skeptic | `standard` x `reassurance` | - | wary; persuasion would backfire |
| 25 | Sofia, 33 | A console for her nephew | Searches in everyday words, opens the glossary twice, opens age suitability twice and gift options once, opens returns, views a few products without opening anything, filters price once. | price_filter | gift buyer inferred, not declared | `guided` x `reassurance` | `guided` x `balanced` | plain words, gift context, worried about returns |
| 26 | Kwame, 44 | Laptops for a team | Searches with model terms, opens technical sections and spec tables, uses the seat counter, checks security and policy pages, adds three to compare, returned once without buying, swipes one photo. | gallery_swipe | B2B with two defensible needs | `dense` x `specs` | `dense` x `reassurance` | technical buyer for a team, detail first |
| 27 | Margit, 69 | Her usual coffee | Has several previous orders, presses reorder, skips detail, adds from the list, uses the search box, zooms one photo. | image_zoom | repeat buyer | `standard` x `quick` | - | knows what she wants; get out of the way |
| 28 | Yusuf, 27 | Tax software | Views five products and opens nothing, presses back six times, re-searches three times without clicking a result, clicks something dead twice, sorts by price once. | price_sort | the lost visitor | `guided` x `balanced` | - | lost; needs a simpler page, never a denser one |
| 29 | Chloe, 30 | Nothing yet | Swipes one photo and leaves within seconds. | - | thin evidence | `standard` x `balanced` | - | almost no evidence, so do not guess |
| 30 | Jonas, 29 | A sofa, for ideas | Arrives from a social network, saves three items, swipes the gallery five times, zooms twice, opens dimensions once, views three products without opening anything, sorts by price once. | price_sort | photo-led browsing | `visual` x `inspiration` | - | browses by picture |
| 31 | Alina, 38 | A baby stroller | Sorts and filters by price and looks at a cheaper alternative, but also reads reviews first, sorts them most critical, opens returns twice, and has come back once without buying. | - | price against trust | `standard` x `reassurance` | `standard` x `deals` | price matters, but a safety purchase needs reassurance first |
| 32 | Mateo, 34 | A camera | Opens three spec tables and stays long on one, opens the glossary three times, presses back four times, re-searches twice without a click, clicks something dead. | - | detail hunger and confusion together | `guided` x `specs` | `guided` x `balanced` | wants detail but is struggling, so simpler wording and layout |
| 33 | Svetlana, 47 | An audio interface | A real expert who reads spec tables closely: five opens, long dwell three times, compares two, uses the search box, opens dimensions. Never opens a technical section or uses a technical filter. | - | targets the known gap found with Paul | `dense` x `specs` | - | an expert, shown by how closely she reads specs |
| 34 | Oliver, 52 | Headphones, second visit | Last visit: arrived from a review channel, technical search, four spec opens, two technical sections, two compares. This visit: two more spec opens, one compare, one technical section, back to the same items. | - | return visit that confirms | `dense` x `specs` | - | a returning expert who keeps behaving like one |
| 35 | Beatrix, 60 | A mattress | Told the chat 'just the basics', yet opens four spec tables, stays long on one, searched with technical terms, and compares two. [declared: {"traits": {"IA": 0.15}}] | - | declared preference against behaviour | `standard` x `balanced` | - | what she said beats what she did |
| 36 | Kofi, 22 | An e-reader | Picked the dense view himself. Behaviour is thin: one product view, short session. [declared: {"dialect": "dense"}] | - | declared view switch | `dense` x `balanced` | - | his choice of view is honoured; nothing else is known |
| 37 | Daniel, 40 | A phone | Declined consent. Would have opened five spec tables and compared three. [context: {"consent": false}] | - | consent denied | `standard` x `balanced` | - | no consent means no personalisation at all |
| 38 | Ruth, 70 | A monitor | High-contrast mode is on. Searches with technical terms, opens four spec tables and two technical sections, compares two, uses the search box. [context: {"prefers_contrast_more": true}] | - | accessibility setting against expertise | `dense` x `specs` | `guided` x `specs` | an expert who needs high contrast, not a simpler page |
| 39 | Vikram, 25 | Sneakers | Arrives from a price-comparison site, through a deal campaign link and from a social network. Stays seconds. | - | arrival-only evidence | `standard` x `balanced` | - | arrival details alone are not a personality |
| 40 | Elodie, 45 | A dishwasher | Returned to the same two items twice, saved two, opened returns twice, opened dimensions twice, read reviews first, opened two spec tables, searched in everyday words, came back without buying, zoomed one photo. | image_zoom | considered buyer | `standard` x `reassurance` | - | a careful, stalled big purchase |

---

## Results

Run 2026-11-07, once, model frozen (`scripts/signal_model.py`, git blob `3d5bac5`). The table above was
hashed before the run (sha256 `cf08db55…`). No model change and no expectation change after seeing the results.
Runner: `python scripts/batch3.py`. Stability = share of 300 runs, with every weight nudged by up to 25%,
that still produce the **expected** page.

**17 of 20 match strictly. 2 more match the listed alternative. 1 misses outright.**

| # | Who | Chose | Expected | Result | Stability | Why it went that way |
|---|---|---|---|---|---|---|
| 21 | Hiro | `dense` × `specs` | `dense` × `specs` | ✅ | 100% | technical search + technical section + spec opens: two independent jargon groups |
| 22 | Nadia | `guided` × `quick` | `guided` × `quick` | ✅ | 100% | large text set the look directly; reorder set the need |
| 23 | Priya | `standard` × `deals` | `standard` × `deals` | ✅ | 100% | the stray spec open did not move the need |
| 24 | Tomas | `standard` × `reassurance` | `standard` × `reassurance` | ✅ | 100% | trust need 0.92 beat a price sort |
| 25 | Sofia | `guided` × `balanced` | `guided` × `reassurance` | ➖ alternate | 0% | see below |
| 26 | Kwame | `dense` × `specs` | `dense` × `specs` | ✅ | 94% | reassurance (security checks) was a close second |
| 27 | Margit | `standard` × `quick` | `standard` × `quick` | ✅ | 100% | |
| 28 | Yusuf | `guided` × `balanced` | `guided` × `balanced` | ✅ | 100% | confusion 0.92 → simpler, never denser |
| 29 | Chloe | `standard` × `balanced` | `standard` × `balanced` | ✅ | 100% | confidence 0, no guess |
| 30 | Jonas | `visual` × `inspiration` | `visual` × `inspiration` | ✅ | 100% | |
| 31 | Alina | `standard` × `reassurance` | `standard` × `reassurance` | ✅ | 100% | trust 0.88 vs price 0.82: the tie rule |
| 32 | Mateo | `guided` × `specs` | `guided` × `specs` | ✅ | 100% | confusion decided the look, detail hunger the lead |
| 33 | Svetlana | `standard` × `specs` | `dense` × `specs` | ❌ | 0% | the known gap, see below |
| 34 | Oliver | `dense` × `specs` | `dense` × `specs` | ✅ | 100% | last visit's evidence carried over at 0.6 and was confirmed |
| 35 | Beatrix | `standard` × `balanced` | `standard` × `balanced` | ✅ | 100% | her "just the basics" pinned appetite low |
| 36 | Kofi | `dense` × `balanced` | `dense` × `balanced` | ✅ | 100% | his own view choice was honoured |
| 37 | Daniel | `standard` × `balanced` | `standard` × `balanced` | ✅ | 100% | no consent, nothing collected |
| 38 | Ruth | `guided` × `specs` | `dense` × `specs` | ➖ alternate | 0% | see below |
| 39 | Vikram | `standard` × `balanced` | `standard` × `balanced` | ✅ | 100% | three arrival signals together still stay neutral |
| 40 | Elodie | `standard` × `reassurance` | `standard` × `reassurance` | ✅ | 100% | |

### The three that did not match

- **#33 Svetlana, a miss, and the same gap as Paul.** An expert who reads spec tables closely and never
  opens a technical section. Information appetite is high (0.86, confident), but jargon comfort has no
  evidence, so the `dense` rule never fires. Across 300 nudged runs it never does either, so this is a gap
  in the rules and not bad luck. This is the second client to hit it, which makes it a pattern: **detail
  hunger from spec reading is not counted as technical comfort.** It fails on the safe side (normal layout,
  specs first). The candidate fix in `specs/signal-model.md` (count which spec rows are read) is still
  untried.
- **#38 Ruth, matches only the alternative, and it is a design question more than a bug.** The spec turns a
  device accessibility setting straight into the `guided` look, so an expert with high-contrast mode on gets
  the simplest layout. I registered `dense` as the right answer because high contrast is about legibility,
  not about wanting less detail. That is my judgement, and the team may disagree. Either way, a setting about
  how things look decides how much detail the page shows. A cleaner design would apply the contrast setting
  as a style and keep the look from behaviour.
- **#25 Sofia, matches only the alternative.** The model did notice it is a gift (`buyingFor` = other), but a
  gift flag does not change the need. Her trust need (0.61) sits at confidence 0.36, below the 0.55 threshold,
  so `reassurance` is not chosen and she gets `balanced`. Expecting reassurance was my judgement; `balanced`
  is a defensible, cautious answer. The finding is narrower: **in the current model, the gift context
  changes only a flag on the slide, not what the page leads with.**

### How to read this

- **Combined score on the two batches written after the model was frozen:** 9 of 10 (batch 2) and
  17 of 20 (batch 3), so **26 of 30 strict**, and 28 of 30 counting alternatives. Batch 1 is not counted
  because the model was built on it.
- **Still synthetic, and still friendlier than real visitors.** Each profile is a clean list of clicks that
  an agent who had read the model translated from a description. Real sessions have fewer signals and more
  contradictions, so expect a lower real-world number.
- **The misses are more useful than the score.** Two of the three sit on the two places the profiles were
  aimed at: #33 on the rule that combines appetite and jargon comfort into the `dense` look, and #38 on the
  rule that turns an accessibility setting into the `guided` look. #25 is a third, separate gap (gift context
  does not change the lead).
- **Not tested here:** Matei's tracker on these 40 clients, real return visits over days, and decay over
  time (the script scores snapshots).
