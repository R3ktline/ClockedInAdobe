# Brief — how we detect a visitor's profile ("personality")

Date: 2026-11-07. Status: **brief for a higher-effort agent. Nothing here is ratified.**
Author: Claude (Sonnet 5.5), at David's request. This file is the handover: it says what is
decided, what is not, what to read, and what to produce.

> **Your job.** Produce a complete, buildable plan for how the product works out who a
> visitor is (their `UserProfile` traits) from data it can legitimately collect, and how it
> turns that into a page. The plan must be testable against the 10 client profiles in
> `specs/client-profiles.md` and must beat the baseline score in §5.

**What "personality" means here.** Not psychometrics (no Big Five). It means the traits in
`specs/profile-schema.md`: domain expertise, information appetite, jargon tolerance, price
sensitivity, intent stage, plus the proposed `trust` and `buyingFor`. If David meant
something wider, ask him (§8, question A).

---

## 1. What David has decided (2026-11-07, in chat)

David agreed to three rules for combining signals. Treat them as the design basis:

1. **Reliability weights.** Every signal gets a weight by how trustworthy its source is.
   Ordering, strongest first:
   - *Declared* (chat statement, settings toggle, login field the visitor filled in) —
     authoritative; overrides everything inferred (ADR-003).
   - *Repeated on-page behaviour* (spec-table opens, dwell, comparisons, price sorts,
     blocks opened or skipped).
   - *Single or circumstantial* (arrival source, device, scroll speed, search wording).
2. **Evidence accumulation.** Each signal nudges a trait up or down by its weight. Traits
   start neutral, drift toward evidence, decay without reinforcement. Later behaviour
   outweighs the starting guess. (`profile-schema.md` already says axes are "nudged, never
   set hard".)
3. **Correlation groups.** Signals that measure the same thing form a group and the
   group's total effect is **capped**, so they are not double counted. Example group:
   "technical interest" = spec-table opens + spec-heavy search wording + jargon-section opens.

David also said he wants **age considered as a factor with a small weight**, "maybe not 100%
certain, but one we should consider". That conflicts with ADR-002 (§2) and is **not
decided** — see §8, question B. My recommendation is in §6.

I also proposed, and David has not rejected: a confidence score on every result; neutral
output when evidence is thin or conflicting (this is already ADR-005).

## 2. Hard constraints (existing ADRs — do not break without a superseding ADR)

| ADR | Rule | Why it matters here |
|---|---|---|
| 001 | LLM emits `UIIntent` JSON, never markup | Detection feeds the engine; it never feeds a "write the page" prompt. |
| 002 | **No age, gender or demographic proxy collected or inferred** | The weight scheme must avoid age, or an ADR must supersede 002. |
| 003 | Declared preference overrides inferred, always | Top of the weight table. |
| 004 | Never block first paint on a model call | Detection must run client-side/cheap; the model is not on the critical path. |
| 005 | Low confidence → neutral, not a guess | Needs a confidence formula and a threshold. |

Also: `CLAUDE.md` second hard rule (never fabricate product facts), and the profile-schema
rule that **every field must be explainable to the visitor in one plain sentence**.
`consent.granted = false` means collect and infer nothing.

## 3. Inputs: what exists

| File | What it gives you |
|---|---|
| `specs/client-profiles.md` / `.json` | The 10 test people: traits, how each is measured, expected persona, expected page. **Your acceptance test.** All numbers are `[ASSUMPTION]`. |
| `specs/profile-schema.md` | The `UserProfile` contract (axes, explicit prefs, signalsSummary, consent). |
| `specs/personas.md`, `specs/visitor-matrix.md`, `specs/design-briefs.md` | Earlier persona work. Names clash with `visitor-fixtures.md` (open question 21). |
| `docs/04-decisions.md` | ADR-001…008. |
| `docs/06-open-questions.md` | Q20 (`trust`, `buyingFor`), Q22 (return-visit memory). |
| Upstream repo `R3ktline/ClockedInAdobe`, `bogdan/SPEC.md` | Bogdan's engine: 5 weighted personas (`simple`, `specs`, `deals`, `explorer`, `balanced`), threshold 0.55, a `PageSpec` JSON, DeepSeek; cross-session tracking is a non-goal. Read via the Docker MCP GitHub connector (see `CLAUDE.md`). |
| Upstream repo, `matei/README.md`, `matei/demo/tracker.js`, `matei/demo/index.html` (commit `7fee2cc`) | Matei's tracking work. **Read-only — it is his; do not edit it.** Summary in §4. |

## 4. What Matei built, and how it scores

A six-tier, **first-match-wins** detector whose main output is an **estimated age**, which
is then mapped to a persona.

| Tier | Signal | Output |
|---|---|---|
| 1 | Logged-in account with an age | `<25` deals · 25–42 specs · 43–59 balanced · 60+ simple, 100% |
| 2 | UTM tags (`18-24`, `senior`, …), else traffic source (TikTok/Snapchat → deals, Facebook → simple) | 70–92% |
| 3 | `devicePixelRatio > 1.25 && innerWidth ≤ 1366`, `prefers-contrast: more`, tablet UA | `simple`, 65–78% |
| 4 | Words typed in the shop's own search box (conversational / spec acronyms / slang) | 80–84% |
| 5 | Scroll velocity > 900 px/s, mouse jiggle | `deals`, 60–68% |
| 6 | Previous result cached in `localStorage` | restores it |

**Reusable:** the tier idea, UTM parsing, accessibility media queries, the search
classifier, scroll speed, `localStorage` persistence.

**Defects found (read-only review, 2026-11-07):**
- Output is age-first; contradicts ADR-002; stereotypes (Facebook → old).
- `hasConsent` is hard-coded `true`; tier 1 writes the user's age bracket to `localStorage`.
- **Tier 3 fires for every phone and tablet** (`devicePixelRatio ≥ 2`, width < 1366), so a
  16-year-old on a phone is classed "55+, simple". The demo hides this by faking the check
  with a checkbox.
- Mouse-jiggle score is never computed. README tier order ≠ code order (code checks search
  before UTM).
- First-match-wins: uses one signal and discards the rest. Adding tiers adds no information.
- Search regexes are headphone-specific; matching is by substring (`anc` matches
  "finance").
- Only 4 of Bogdan's 5 personas are produced; no `explorer`.
- The demo page invents a price, a discount, a promo code and a countdown — fine as a demo,
  unusable in the product (second hard rule).
- Tracks none of: spec-table opens, dwell, comparison use, price sorting, intent stage.

**Baseline score (hand-traced, not executed — Node is not installed here):** run on three of
our profiles with only the inputs his engine could realistically see:

| Profile | His result | Expected (ours, `[ASSUMPTION]`) | |
|---|---|---|---|
| Mihai, laptop expert | baseline `balanced`, 50% — his search words match nothing | `specs` | ❌ |
| Maria, pharmacy | `simple`, 78% — but only because *all* tablets trip tier 3 | `simple` | ✅ by luck |
| Tudor, sneakers | `deals` 72% with a TikTok UTM; `simple` 55+ without one | `explorer` | ❌ |

**1 of 3, and the 1 is accidental.** Separately, applying his age→persona rule using each
person's *true* age matches 5 of the 10 profiles (Ana, Mihai, Ioana, Bogdan, Maria). Our
profiles were written by us, so that test is partly circular. **Your plan must beat both
numbers on all 10.** Port his logic to a script and run it for real before quoting either
figure.

## 5. What can actually be collected

Verified by reasoning, not by building.

- **Observable on the partner's site (first-party script):** spec-table / block opens and
  dwell; product views; comparison use; sort-by-price; on-site search text; viewport,
  device class, pixel ratio; `prefers-*` media queries; scroll speed; mis-taps near small
  targets *if instrumented*; `document.referrer` (often stripped); UTM parameters.
- **Not available:** the Google query that brought the visitor (not passed to sites);
  anything cross-site; "company network" without IP lookup (drop it).
- **Needs the partner's cooperation:** order history (Elena's "38 previous orders"), account
  fields, the catalog.
- **Needs consent:** anything stored in the browser or used for profiling (ePrivacy/GDPR —
  general caution, not legal advice; ask counsel before launch).
- **Weak by nature:** `trust`, `buyingFor`, and "price sensitivity" from absence of sorting.

## 6. Recommended position on age (for David to decide)

Allow a **declared** age only (login birthdate or a chat answer), at a **small prior
weight**, overridable by the first real behavioural evidence. Do **not** infer age from
traffic source, scroll speed or device. Where a *need* is visible (large OS text, high
contrast), respond to the need directly — this is the accessibility frame already adopted in
ADR-007, and it is how Maria is served without guessing her age. Exclude under-18s from age
weighting. Doing this requires a **new ADR that supersedes ADR-002**; do not edit ADR-002.

## 7. Deliverables expected from you

1. **Signal inventory** — every signal: how captured, where (client/server), consent need,
   reliability tier, which trait(s) it moves, direction, base weight, correlation group.
   Mark all weights `[ASSUMPTION]`.
2. **Accumulation model** — update rule, decay, initial values, how declared preferences
   pin a trait, how conflicts resolve, how session and return-visit state is kept
   (`localStorage` only; ties to Q22).
3. **Confidence model** — formula, threshold for neutral output (ADR-005), how it relates to
   Bogdan's 0.55 persona cut-off.
4. **Mapping to the engine** — traits → Bogdan's personas and/or directly to `UIIntent`
   fields; handle the missing personas (skeptic, gift, repeat-buyer, explorer in Matei's set).
5. **Privacy and explainability section** — consent flow, what the profile viewer says per
   trait in one sentence, what is never stored, minors.
6. **Reuse plan for Matei's tiers** — which parts to keep, which to drop, who to talk to.
7. **Validation** — run all 10 profiles through the model with plausible raw-signal inputs;
   report per-profile predicted vs expected, and compare with the §4 baselines. Then list
   what real-visitor data would be needed to tune the weights.
8. **Cold-start behaviour** — what a first-time visitor with no signals sees.
9. **Risks and what we cannot know.**

Write results as new files under `specs/` (suggested: `specs/signal-model.md`,
`specs/confidence-model.md`) plus ADRs in `docs/04-decisions.md` for anything decided. Do not
rewrite existing ADRs. Log your work in `logs/session-log.md`.

## 8. Open questions for David (answer before or while planning)

- **A.** Does "personality" mean the shopping traits in `profile-schema.md` (assumed), or
  something wider?
- **B.** Age: allow declared age as a small-weight prior (§6), or keep ADR-002 intact?
- **C.** Add `trust` and `buyingFor` to the schema? (existing Q20; the signal model needs it
  to model skeptics and gift/team buyers.)
- **D.** Is `localStorage` memory across visits allowed? (existing Q22; Bogdan's spec says
  non-goal.)
- **E.** Who talks to Matei and Bogdan, and does Matei's code get adapted or only reused as
  a reference?
