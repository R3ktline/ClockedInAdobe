# 09 — Adobe integration story

Date: 2026-11-07. Written after David confirmed **the hackathon is Adobe-sponsored**.
Answers open question 4. Sources at the bottom; three claims verified against Adobe's own
documentation.

---

## The strategic inversion — read this first

`docs/08-competitive-analysis.md` and ADR-007 advised positioning **against** Adobe Target's
variant-selection model. **With Adobe sponsorship confirmed, that advice is wrong.**

The judges are Adobe or Adobe-aligned. "We replace Adobe Target" is a bad pitch to Adobe.
The same technical distinction, pointed the other way, is an excellent one:

> **Adobe Target optimizes among the variants a marketer authored.
> We generate the variants it optimizes among.**

We are not a competitor to Target. We are **the layer above it** — the thing that removes
its ceiling. Target's constraint has always been that a human has to author each variant.
We author them per visitor, and hand them to Target to serve and measure.

**Nothing about the architecture changes.** Only the rhetorical direction does.

---

## Every component maps to a real Adobe product

| Our component | Adobe product | Confidence |
|---|---|---|
| `UserProfile` | **AEP Real-Time Customer Profile** — custom XDM field group on the Individual Profile class | **Verified mechanism** |
| Signal collection | **Adobe Web SDK / Experience Edge** | Plausible, `[VERIFY]` |
| Adaptation Engine | *ours* — this is the new part | — |
| `UIIntent` | **Adobe Target JSON offer**, form-based activity, fetched via `getOffer()` | **Verified** |
| Component registry | **AEM Content Fragments** + variations, headless GraphQL | **Verified fit** |
| Chat | **AEP Agent Orchestrator** / alongside Brand Concierge | Directional |
| **Measurement** | **Target's control group + lift reporting** | **Verified — and this is the big one** |

### 1. `UIIntent` is literally an Adobe Target JSON offer

Target supports **JSON offers**: non-visual offers delivered as **native JSON objects**, for
"use cases where Target decisioning is required to send an offer in JSON format for
consumption in SPA framework or server-side integrations." Retrieved explicitly by the
developer with `getOffer()`, or directly via the server-side APIs and the Node.js, Java,
.NET and Python SDKs.

**That is exactly our delivery mechanism, already shipping in Adobe's product.** Our
`UIIntent` config needs no translation layer — it *is* a JSON offer.

**Constraint to be honest about:** JSON offers work only in **form-based** activities, and
only in **A/B Test, Automated Personalization (AP), and Experience Targeting (XT)**. Not the
Visual Experience Composer. That's a real limitation, not a blocker — AP is the activity type
we'd want anyway.

### 2. Target supplies the measurement we don't have

This is the most valuable thing in this document.

`docs/08-competitive-analysis.md` identified our single biggest weakness: **Adobe holds back a
control group and reports real conversion lift; we have nothing but a simulated dashboard.**

Run our `UIIntent` as a JSON offer inside an **Automated Personalization activity**, and
Target's control group measures *us*. The weakness disappears, and it disappears by using the
sponsor's product.

**This is the answer to "how do you know it works?"** — the hardest question we face. We don't
claim a lift number. We say: *here is exactly how Adobe Target would measure it, and that's
the integration.*

### 3. AEM Content Fragments are already our component registry

Adobe describes Content Fragments as **reusable, presentation-agnostic content built from
structured fields, with a per-channel variation model**, consumed through AEM Headless GraphQL
APIs. Community guidance rates them as well suited to headless delivery *because they separate
content from layout* — and rates Experience Fragments as less suited, since those bundle design
with content.

**Structured content + variations + presentation-agnostic + headless** is a description of our
blocks-and-variants registry. We are not imposing a new authoring concept on Adobe customers —
**we're consuming one they already author.**

Use **Content Fragments**, not Experience Fragments. Experience Fragments carry layout, which
breaks the separation the whole design depends on.

### 4. `UserProfile` fits AEP's Real-Time Customer Profile

Enabling the Profile switch on a schema's root element merges ingested data into the Real-Time
Customer Profile. Custom **field groups** on the Individual Profile class are the documented
extension point, and a saved custom field group is reusable across schemas sharing that base
class — the pattern Adobe's own guide uses for audience membership data.

So our axes (`informationAppetite`, `jargonTolerance`, `intentStage`, `priceSensitivity`,
trust) become a custom field group on Individual Profile.

**Two caveats, both from community posts rather than official docs** `[VERIFY]`: custom fields
work for audiences only if modeled on XDM profile schemas with data-usage labels and within
license entitlements; and high-volume custom attributes can consume profile count or storage
quota. Also note: **enabling a schema for Profile cannot be undone.**

---

## ADR-001 is what makes all of this possible

Worth stating plainly, because it's the strongest validation of an early decision.

ADR-001 said: **the LLM emits a JSON config, never UI markup.** The reasons given were
latency, brand safety, factual safety, testability and cost. Adobe sponsorship adds a sixth,
and it's decisive:

- A JSON config drops straight into a **Target JSON offer**.
- Presentation-agnostic blocks map straight onto **AEM Content Fragments**.

**Had we let the model generate HTML, none of this would plug in.** Target JSON offers take
JSON. Content Fragments are explicitly presentation-agnostic. The architecture we chose for
engineering reasons turns out to be the only one that fits the sponsor's stack.

If one slide has to carry the technical credibility of this project, it's that one.

---

## The honest caveat — state this, don't let a judge find it

**We cannot actually build on AEP, AEM or Target in a hackathon.** No licenses, no tenant, no
time. The demo runs on our own stack.

So this document is an **integration architecture**, not an implementation. Present it as:
"here is how this plugs into the Adobe stack, component by component, and here is the
mechanism for each" — with the JSON-offer and Content Fragment docs cited.

**Do not imply we built on Adobe.** If a judge discovers that after we've implied otherwise,
every other claim becomes suspect. Showing a correct, specific, documented integration design
and saying plainly that it's a design is a strong position. Overclaiming it is fatal.

---

## Revised pitch structure

1. **The problem** — sites are built once, for an averaged-out visitor nobody is.
2. **Why Target can't fully solve it** — its ceiling is how many variants a marketer had
   patience to author. Said respectfully: this is a real constraint of the variant-authoring
   model, not a flaw in the product.
3. **What we add** — generative variant synthesis per visitor, delivered as a Target JSON
   offer. *We generate the variants Target optimizes among.*
4. **The visitor-agency half** — they see the profile, they see the reasoning, they change it
   by talking. Everyone built the personalization; nobody built the control. (Accenture: 83%
   will share data *if* transparent and in control.)
5. **Cognitive accessibility** — EAA has applied to EU e-commerce since 2025-06-28. Moves us
   from the contested conversion budget to the uncontested compliance budget. Adobe does not
   currently sell this.
6. **Integration** — the component mapping table above.
7. **Measurement** — Target's control group measures us. Named honestly as a design, not a
   result.

---

## What this changes in the repo

- **Open question 4: ANSWERED.** Adobe-sponsored, confirmed by David 2026-11-07.
- **ADR-007 is amended by ADR-008**, not discarded. Visitor agency and cognitive
  accessibility remain the differentiators. What changes is that Target goes from
  competitor to **integration surface and measurement apparatus**.
- `docs/08-competitive-analysis.md` stays accurate as competitive research. Its
  recommendation to position *against* Target is superseded for this audience.
- The startup competitors (Fibr AI, Architect, Persona, Storyborrd) matter **more** now, not
  less — they're the ones Adobe might otherwise buy instead of us. None of them, as far as
  the research showed, offer visitor-facing control.

## Sources

- [Create JSON offers — Adobe Target](https://experienceleague.adobe.com/en/docs/target/using/experiences/offers/create-json-offer)
- [Content Fragments and Experience Fragments — AEM](https://experienceleague.adobe.com/en/docs/experience-manager-learn/sites/content-fragments/understand-content-fragments-and-experience-fragments)
- [Ingest and use Experience Platform audiences](https://experienceleague.adobe.com/en/docs/analytics-platform/using/cja-usecases/data-ingestion/ingest-aep-segments)
- [Create a custom schema for Web SDK](https://experienceleague.adobe.com/en/docs/analytics-platform/using/compare-aa-cja/upgrade-to-cja/cja-upgrade-schema-create)
- [AEP data source in Journey Optimizer](https://experienceleague.adobe.com/en/docs/journey-optimizer/using/configure-journeys/data-source-journeys/adobe-experience-platform-data-source)
- [Auto-Target to optimize — Adobe Target](https://experienceleague.adobe.com/en/docs/target/using/activities/auto-target/auto-target-to-optimize)
