# Spec — 10 more client profiles (test batch 2)

Date: 2026-11-07. Status: **test fixtures, `[ASSUMPTION]` throughout.** Companion to
`specs/client-profiles.md` (batch 1) and `specs/signal-model.md`.

**Purpose:** an out-of-sample test of the signal model. Batch 1 was used to build the
model, so passing it proves little. This batch was written **after the model was frozen**
(`scripts/signal_model.py`, git blob `b0fdc91`). **No weight or rule is changed after seeing
the results.**

**How "expected" was decided:** from the team spec's definitions of each dialect and need
(their "typical evidence" columns), **written here before the first run**. Not from the
model's rules.

**Harder than batch 1, on purpose:**
- Every person has 1–2 **noise** signals that don't fit their pattern, because real people
  click randomly.
- Two people are **thin** or **lost**, where the right answer is "adapt less".
- Two people are **ambiguous** (two needs both defensible). They are scored strictly on the
  first-choice answer, and the second acceptable answer is listed.
- Two people have an age label that a stereotype would get wrong (58 and fluent; 66 and
  expert). The model never sees age; the test checks that nothing sneaks it in.

---

| # | Who (label only) | Shopping for | What they do (signals) | Noise | Expected | Why |
|---|---|---|---|---|---|---|
| 11 | Andreea, 27 | running shoes | social referrer · 3 gallery swipes · reads reviews first · opens returns policy | 1 price sort | `visual` × `reassurance` | browses by image, but checks reviews + returns before buying |
| 12 | Paul, 35 | gaming headset | search "7.1 surround 50mm drivers" · 4 spec opens · 2 compare-adds · 2 price sorts · price filter | 1 fast scroll | `dense` × `specs` *(also OK: `dense` × `deals`)* | jargon + depth, price matters but specs dominate |
| 13 | Irina, 58 | kitchen robot | conversational search "robot care framanta aluat" · 3 spec opens · long dwell on table · uses search box and filters fluently | 1 gallery swipe | `standard` × `specs` | wants detail, in plain words; fluent with the UI |
| 14 | Sorin, 19 | cheapest phone charger | price-comparison referrer · 1 price sort · adds to cart in 40 s · skips detail | 1 image zoom | `standard` × `quick` | already decided; get out of the way |
| 15 | Lavinia, 44 | — | 1 product view, nothing opened, short session, left | — | `standard` × `balanced` | almost no evidence → don't guess |
| 16 | Dan, 31 | robot vacuum | conversational search · 2 spec opens · 1 long dwell · opens glossary 2× | 1 price filter | `standard` × `specs` | wants detail but struggles with jargon (copy register should be plain) |
| 17 | Bianca, 24 | dresses | social referrer · 8 gallery swipes · 4 zooms · fast scroll 3× · 15 views, nothing opened · **no** back-button | 1 price sort | `visual` × `inspiration` | lots of views with no opens, but *not* lost: no bouncing |
| 18 | Florin, 66 | hammer drill | search "percutie 850W SDS-plus" · 3 spec opens · 2 technical sections · 2 compare-adds · technical filter | 1 policy open | `dense` × `specs` | expert; the age label must not matter |
| 19 | Corina, 39 | a phone case, on mobile | 6 views, nothing opened · 4 back-button · 2 searches refined with no click · 1 mis-tap | 1 gallery swipe | `guided` × `balanced` | lost: simpler page, never denser |
| 20 | Emil, 50 | a TV, 3rd visit | same 2 items on 3 visits · critical reviews · warranty opened · price history opened · 2 price sorts | 1 spec open | `standard` × `reassurance` *(also OK: `standard` × `deals`)* | stalled and wary; price also matters |

## Results

Run 2026-11-07, model frozen: **9/10.** Only miss: **Paul (#12)** got `standard` × `specs`
instead of `dense` × `specs`. The need was right and the dialect wrong, in the safe direction.
Full analysis in §"Batch 2" of `specs/signal-model.md`.
