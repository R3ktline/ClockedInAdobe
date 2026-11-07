# 04 — Decision log (ADRs)

**Append-only.** Never edit or delete an existing entry. To change a decision, add a new
ADR that says "Supersedes ADR-NNN" and mark the old one `SUPERSEDED BY ADR-NNN`.

---

## ADR-001 — The LLM emits config, not UI
**Date:** 2026-11-07 · **Status:** Accepted (proposed by Claude, pending team ratification)

**Context.** The obvious implementation of "AI changes the site in real time" is to have
the model generate HTML/JSX for the page.

**Decision.** It does not. The model emits a small JSON `UIIntent` config. A fixed
registry of partner-owned components renders that config.

**Why.** Five reasons, each sufficient on its own:
- *Latency* — markup generation is seconds; a config is small, and cacheable across users.
- *Brand safety* — merchants will not accept a model restyling their pages.
- *Factual safety* — a model writing product copy will eventually invent a spec or a price.
- *Testability* — a config is a value you can snapshot, diff, and assert on. Markup isn't.
- *Cost* — config generation is an order of magnitude cheaper per request, and caches.

**Consequence.** Adaptation is bounded by what the registry declares. This is a feature:
it is the safety boundary. Richer adaptation means declaring more variants, not freer
generation.

---

## ADR-002 — Segment on expertise and intent, never on demographics
**Date:** 2026-11-07 · **Status:** Accepted

**Context.** The founding example was age-based (teenager wants specs, older person
wants simplicity).

**Decision.** Profile axes are domain expertise, information appetite, intent stage,
jargon tolerance, and price sensitivity. Age, gender, and any proxy for a protected
characteristic are neither collected nor inferred.

**Why.** Demographic inference is less accurate than behavioral signal for this purpose,
exposes us to discrimination claims under GDPR Art. 22 and the EU AI Act, and is the
weakest point in the pitch under questioning. The behavioral axes are directly
observable *and* directly declarable by the user.

---

## ADR-003 — Explicit user preferences override inferred ones, always
**Date:** 2026-11-07 · **Status:** Accepted

**Decision.** A preference the user stated in chat is durable and authoritative. No
volume of behavioral signal overrides it. Only the user can change or clear it.

**Why.** If the user says "just the basics" and the page re-expands later because they
happened to scroll a spec table, the chat interface is revealed as decorative. This one
rule is the difference between a conversational product and a suggestion box.

---

## ADR-004 — Never block first paint on a model call
**Date:** 2026-11-07 · **Status:** Accepted

**Decision.** Server-render a neutral canonical page with no model involvement. Apply
adaptation after hydration, with animated transitions.

**Why.** Keeps page speed, CDN caching and SEO intact; removes the model from the
critical path entirely; and the visible settle-in motion reads as the product working
rather than as lag.

---

## ADR-005 — Low confidence means less adaptation, not a guess
**Date:** 2026-11-07 · **Status:** Accepted

**Decision.** The engine emits a confidence value. Below threshold it returns the neutral
intent rather than its best guess.

**Why.** A confidently wrong layout is actively worse than a neutral one — it misleads
the user and makes the product feel broken. Degrading toward neutral is always safe.

---

## ADR-006 — Working codename "Chameleon"
**Date:** 2026-11-07 · **Status:** Provisional

Placeholder so docs and code can use a consistent name. Not a branding decision. The
upstream repo is named `ClockedInAdobe`; whether that is the team name, the project name,
or a placeholder is an open question.

---

## ADR-007 — Position on visitor agency + cognitive accessibility, not on "AI personalizes pages"
**Date:** 2026-11-07 · **Status:** Proposed — **needs a team decision, highest priority**

**Context.** Competitive research (`docs/08-competitive-analysis.md`) found that "AI
reshapes the website per visitor" is a crowded 2026 claim, not a differentiating one:
Fibr AI (Accel-backed, undercutting Adobe on price), Architect, Persona and Storyborrd all
make some version of it, and Adobe's own Brand Concierge ships a conversational on-site
agent. Meanwhile Adobe Target has had ML personalization since 2017 — Auto-Target uses
Random Forest over marketer-authored experiences, and Automated Personalization does the
same over marketer-authored offer combinations.

**Decision.** Keep the product and architecture exactly as designed. Change the frame:

1. **Primary axis — visitor agency.** Every competitor optimizes a merchant KPI with the
   visitor as the object. We make the visitor the author: they see the profile, they see
   the reasoning, they change it by talking. Accenture's finding is that 83% will share
   data for personalization *conditional on transparency and control* — everyone built
   the personalization, nobody built the control.
2. **Secondary axis — cognitive accessibility.** The European Accessibility Act has
   applied to EU e-commerce since 2025-06-28 and requires plain language and intuitive
   organisation for users regardless of cognitive capacity or reading ability. That is a
   description of our core function. It moves us from the contested conversion budget to
   the uncontested compliance budget.
3. **Against Adobe Target specifically**, the claim is narrow and true: they do ML
   *selection over a human-authored variant set*; we *synthesize* the variant. Do not
   overclaim beyond this.

**Explicitly rejected:** leading with "we personalize websites with AI." It is not true
that we're first, it is checkable in under a minute, and the cost of being caught
overclaiming exceeds the benefit.

**Consequence.** `docs/00-concept.md` needs its pitch section reframed once the team
ratifies this. The portable cross-site profile stays a vision slide, not a build — it has
a network-effect cold start that cannot be bootstrapped in a hackathon.

**Supersedes nothing.** ADR-002 (no demographic segmentation) is reinforced by this: the
accessibility frame supplies the defensible replacement for the discarded age example.

---

## ADR-008 — Position *on top of* Adobe Target, not against it
**Date:** 2026-11-07 · **Status:** Accepted · **Amends ADR-007**

**Context.** David confirmed on 2026-11-07 that **the hackathon is Adobe-sponsored**
(answers open question 4). ADR-007 advised positioning *against* Adobe Target's
variant-selection model. To an Adobe audience that is the wrong direction.

**Decision.** Same technical distinction, inverted rhetorically:

> **Adobe Target optimizes among the variants a marketer authored.
> We generate the variants it optimizes among.**

We are the layer above Target that removes its authoring ceiling — not a replacement.
Research confirmed every component maps to a real Adobe product (see
`docs/09-adobe-integration.md`), with three claims verified against Adobe's own docs:

1. **`UIIntent` is literally an Adobe Target JSON offer** — non-visual offers delivered as
   native JSON objects for SPA/server-side consumption, fetched via `getOffer()`. No
   translation layer needed. Constraint: form-based activities only (A/B, AP, XT).
2. **AEM Content Fragments are already our component registry** — reusable,
   presentation-agnostic structured content with a per-channel variation model, via headless
   GraphQL. Use Content Fragments, **not** Experience Fragments (those carry layout, which
   breaks the separation the design depends on).
3. **`UserProfile` fits AEP Real-Time Customer Profile** as a custom XDM field group on the
   Individual Profile class.

**The most valuable consequence.** `docs/08-competitive-analysis.md` identified our single
biggest weakness: Adobe holds back a control group and reports real conversion lift, and we
have nothing. Running `UIIntent` as a JSON offer inside an **Automated Personalization**
activity means **Target's control group measures us.** The weakness is solved using the
sponsor's product.

**This retroactively validates ADR-001.** We chose "config, not markup" for latency, brand
safety, factual safety, testability and cost. It turns out to be the *only* choice that fits
the Adobe stack — Target JSON offers take JSON, and Content Fragments are explicitly
presentation-agnostic. Had the model generated HTML, none of this would plug in.

**What ADR-007 keeps.** Visitor agency and cognitive accessibility remain the
differentiators; Adobe sells neither. Only Target's role changes — from competitor to
**integration surface and measurement apparatus**.

**Mandatory honesty constraint.** We cannot build on AEP/AEM/Target in a hackathon — no
licenses, no tenant. This is an integration *architecture*, and must be presented as one.
**Do not imply we built on Adobe.** A judge discovering that after we implied otherwise
makes every other claim suspect.
