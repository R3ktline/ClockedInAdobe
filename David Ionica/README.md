# David Ionica — visitor examples

David Ionica's contribution: the **visitor examples** (the people the design workstream
builds against) plus the **project documentation and data contracts** written alongside them.

## What's in here

```
specs/      the visitor examples + the two data contracts (UserProfile, UIIntent)
docs/       concept, feasibility, architecture, plan, ADRs, open questions, research
```

**If you're merging this:** the two files that are contracts between workstreams are
`specs/profile-schema.md` and `specs/ui-intent-schema.md`. Both are **draft, not ratified** —
they're the most likely place this collides with work done elsewhere. `docs/04-decisions.md`
is append-only: supersede an ADR with a new one, never rewrite it.

## The visitor examples — read in this order

### 1. `specs/design-briefs.md` ← **start here if you're designing**
Ten people as **design briefs**. Self-contained — needs nothing else in the repo.

Each person is written as a **diff from a neutral baseline page**: what moves to the top,
what gets hidden, how dense, how technical. Explicit top-to-bottom block order per person,
plus a "Don't" line naming the specific trap.

**Key instruction inside:** you are not designing ten pages. Per vertical you design **one
block set, where each block has 3–4 variants** spanning dense → plain. The system composes
them per visitor.

### 2. `specs/visitor-matrix.md` ← **start here if you're fetching data**
The same ten people across ten verticals (fashion, travel, electronics, groceries,
furniture, insurance, B2B SaaS, automotive, pharmacy, toys), ages 16–74.

Three columns per person: **data we'd have** (the fetch list) → **what it tells us** (the
inference) → **design direction**. Contains the consolidated instrumentation list, which is
the same for every vertical.

### 3. `specs/visitor-fixtures.md` ← the deep worked example
Ten electronics visitors in full detail, showing the whole inference pipeline:
**who they are → what the system sees → what it infers (+ confidence) → what the page does
→ what we can't know.**

Narrower in scope than `visitor-matrix.md` but much deeper. Use it to understand *how* the
inference is supposed to work.

---

## The three findings that matter

**1. The axes are vertical-independent; the blocks are vertical-specific.**
Information appetite, jargon tolerance, intent stage, price sensitivity and trust mean the
same thing in every vertical — so **one profile schema and one engine serve all of them**.
But blocks differ (`specs` vs. `coverage_terms` vs. `reorder`), so each vertical needs its
own component registry. That's config, not code. This is the answer to "does the idea
generalize?"

**2. Sometimes the right personalization is *less*.**
Elena (groceries) gets a page that *hides* discovery and leads with one-tap reorder. Radu
(insurance) gets promotional framing *removed*. Bogdan (used car) gets deal badges
suppressed because they reduce his trust.

Any demo where every personalized page has *more* on it than the default will read as an
upsell engine. **At least one demo page must be simpler and less commercial than the
baseline.** Elena's near-empty grocery page is the point, not an unfinished draft.

**3. The riskiest inference error is reading volume as interest.**
Elena (electronics fixture 2) views seven products in four minutes and opens nothing. That
*looks* like active research. With zero block-opens and a high back-button rate it's
actually **repeated bouncing off pages that don't answer her question** — a confusion
signal. Getting this backwards would hand the most overwhelmed user the densest page. Handle
it explicitly.

## If you only instrument two signals

**Block-open events** (did they expand the spec table?) and **free-text search/chat text**
(vocabulary classifies expertise in one shot — "laptop with good battery" vs. "16GB DDR5
thin-and-light"). Far more reliable than dwell time, which is ambiguous: a long dwell can
mean interest *or* confusion.

**Entry referrer** is the best free signal — a price-comparison site vs. a technical review
site tells you a lot before the visitor clicks anything.

## Two things deliberately not resolved

- **No trust axis in the profile schema.** It's load-bearing in 3 of 10 verticals (Radu,
  Bogdan, partly Cristina) and currently approximated by "high review appetite," which is
  insufficient because trust drives content *removal*. **Recommend adding it.**
- **Task vs. product expertise.** Ioana knows her job (video editing) but not components;
  Mihai knows components. One scalar can't hold both. Recommend accepting the simplification
  for the hackathon and stating the limitation honestly.

Both are flagged in the files rather than papered over.

## Note on ages

Ages are the **human-readable label** on each fixture — they make the people concrete for
design discussion. The engine keys on the **derived axes**, not the birth year, because the
correlation is loose and the failure case is bad: a 74-year-old gamer served a patronising
page, or a 16-year-old who reads datasheets served three bullets. Where age genuinely
matters it's **declared** (Gheorghe's granddaughter's age, for gift suitability), which is
both more accurate and consented.

**Design for the derived column; label with the age column.**

## Not validated

These people are reasoned, not researched. **Nobody has tested whether real users actually
prefer differently-shaped pages** — the premise the whole project rests on. If asked "how do
you know this works?", the honest answer is that we haven't tested it yet. The cheapest fix
is a ~20-person preference test (show two versions, ask which they'd rather buy from, check
whether preference correlates with self-rated expertise).
