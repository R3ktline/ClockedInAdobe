# 08 — Competitive analysis: us vs. Adobe Target and the rest

Date: 2026-11-07. Author: Claude, from web research (sources at the bottom).
Status: evidence-based, and it **changes the positioning**. Read before writing the pitch.

Tested against the user's three criteria: **realizable, profitable, different enough.**

---

## Summary verdict

| Criterion | Verdict |
|---|---|
| Realizable | **Yes.** Unchanged from `01-feasibility.md`. |
| Different enough from **Adobe Target specifically** | **Yes, clearly, and citably.** |
| Different enough from **the market as a whole** | **No — not as currently framed.** At least four startups plus Adobe's own Brand Concierge already claim "AI reshapes the page per visitor." We'd be entrant #5 or #6 on that exact claim. |
| Profitable | **Not as a conversion-optimization vendor.** Plausibly yes under a different frame — see "The accessibility wedge". |

**Recommendation: keep the concept, change the frame.** The technology stays as designed.
What changes is who the product is *for* and which budget pays for it.

---

## 1. What Adobe Target actually does

This matters because the honest distinction is narrower and sharper than "they use rules,
we use AI." Adobe has had ML in Target since 2017.

**Auto-Target** (Target Premium): uses machine learning — primarily **Random Forest** —
to pick, per visitor, among **experiences a marketer already built**. Set up like an
A/B test. Reserves a control group to measure lift.

**Automated Personalization (AP)**: same algorithms, but set up like a multivariate test —
it selects among **combinations of marketer-authored offers**.

So Adobe is not doing naive rules. It is doing sophisticated ML **selection over a finite,
human-authored variant set.**

### The real distinction

> Adobe Target optimizes *which of the marketer's pre-built variants* a visitor sees.
> Its ceiling is how many variants a marketer had the patience to author.
> We synthesize the variant per visitor, so there is no authored set and no ceiling.

That is defensible, specific, and true. It is also **the whole of our technical
differentiation from Adobe Target** — and we should say exactly that rather than
overclaiming.

### Where Adobe is already ahead of where we'd be

- **Measurement.** Auto-Target holds back a control group and reports real lift. We have
  no measurement at all. A judge who knows this space will ask, and "we designed the
  metric" is a much weaker answer than a control group.
- **Thompson sampling caveat is a known-problem they've already documented** — i.e. they
  are several years into the failure modes we haven't hit yet.
- **Brand Concierge + AEP Agent Orchestrator** (launched Summit 2025, expanded 2026):
  a conversational agent deployed on the brand's own site. Greets by name, remembers
  prior interactions, has a Product Advisor Agent, offers a query box and premade prompts.

**Brand Concierge is the closest thing to our chat half, and we need to be precise about
the gap.** On the evidence I found, Brand Concierge is a conversational *assistant beside
the page* — it answers questions and recommends products. The reporting does **not**
describe a visitor reshaping the page's layout and information density by talking to it,
and does not describe that preference persisting.

That gap is real. It is also **a feature, not a moat** — Adobe could close it in a
release. Do not build the pitch on it.

---

## 2. The crowded part (this is the uncomfortable finding)

"AI personalizes the page per visitor" is a **2026 trend with multiple funded entrants**:

- **Fibr AI** — Accel-backed, explicitly competing on cost with Adobe and Optimizely.
  Shipped ads-to-web and LLM-to-web personalization (April 2026): keeps the intent of
  paid and AI-referred traffic intact into the landing page. The most directly
  comparable company found.
- **Architect** (`tryarchitect.com`) — pitch is an agent that lives inside the live site
  and adapts the page per person.
- **Persona** — Product Hunt launch, generative website UI, routes users to the
  best-performing version of each component. Early-stage.
- **Storyborrd** — Product Hunt, built on "no two users see the same website."

Plus Optimizely, Dynamic Yield, Bloomreach in the incumbent tier.

**Implication:** the sentence "our AI changes the website for each user" is no longer a
differentiating sentence in late 2026. If that is the pitch, the response is "which one
are you, and why not Fibr?" **We need a second axis.**

Caveat on sourcing: the startup evidence is vendor blogs, launch pages and trade press.
Early-stage listings are signals of market direction, not of proven traction.

---

## 3. What is actually still open

### Direction A — the visitor is the principal, not the target

Every product above, incumbent and startup, optimizes a **merchant** KPI. The visitor is
the object of personalization, with no visibility into it, no control over it, and no
recourse. Our chat interface and profile viewer invert that relationship.

The demand signal is real, though the numbers are vendor-sponsored and should be quoted
carefully:
- 62% of US consumers find ads that follow them "creepy"; a third don't trust brands with
  their data (Clutch, Jan 2026).
- 91% find at least one form of personalization intrusive (Thoughtspot, 4,800+ respondents).
- 38% will stop doing business with a company over creepy personalization (Gartner 2019).
- **The key one:** 83% will share data for a customized experience **provided the business
  is transparent about its use and the customer has control over it** (Accenture).

That conditional is the entire opportunity. Everyone built the personalization. **Nobody
built the "customer has control over it" half.** Our architecture already produces it
nearly for free — the `rationale` field and the `UIIntent` config are inspectable by
construction (see `specs/ui-intent-schema.md`).

This is a **positioning moat, not a technical one.** Honest framing.

### Direction B — the accessibility wedge (strongest finding; unexpected)

Reframe what we're building: **adaptive cognitive accessibility that also lifts conversion.**

The **European Accessibility Act** (Directive (EU) 2019/882) has applied to e-commerce
sold to EU consumers since **28 June 2025** — the deadline has already passed. Its
requirements include **plain language and intuitive organisation for users "regardless of
their cognitive capacity or reading ability."**

That sentence is a near-exact description of our product's core function: adaptive
verbosity, adaptive jargon level, progressive disclosure of complexity.

Three consequences, and they're big:

1. **It moves us to a different budget.** Conversion-optimization budget is contested by
   Adobe, Optimizely and Fibr. **Compliance budget is not**, and it has a legal deadline
   behind it rather than a hoped-for lift.
2. **It makes the feature an obligation rather than a nice-to-have.** "Adapt to the
   visitor's reading and expertise level" is much harder to decline when it's in scope for
   a directive.
3. **It gives the replacement for the age example** we already discarded in ADR-002 —
   more defensible, more sympathetic, and legally grounded rather than demographic.

There is also a **standards lineage nobody has productized for commerce**: W3C UAAG
included a "portable profiles" success criterion (Level AAA) requiring preference sets be
transferable between systems, and ISO/IEC 24751 ("Access For All") models user needs as
portable preference profiles. The idea is a decade old in accessibility and absent from
e-commerce.

**Verify before pitching:** the EAA runs through national implementing laws, so specifics
vary by country; the technical standard referenced is **EN 301 549** (which in turn cites
WCAG), *not* WCAG directly; and claims about a blanket transition period to 2030 appear
overstated in vendor blogs — it covers certain pre-existing contracts, not all existing
sites. Use Directive (EU) 2019/882 Annex I and law-firm guidance, not SEO blogs. `[VERIFY]`

**Risk to manage:** "accessibility overlay" vendors have a poor reputation with the
disability community and regulators. We must not look like a bolt-on overlay widget — we
are a content-layer integration driven by the merchant's own declared component registry.
Worth checking the current state of overlay-vendor enforcement before leaning on this
framing publicly. `[VERIFY]`

### Direction C — the portable cross-site profile

The original "a For You page, but for websites" vision: one profile, inspectable and
owned by the user, that works across every participating site.

Research finding: **no adopted standard exists.** Only a US patent application for
universal website preference management, an old Google proposal for web-hosted settings,
and the W3C/ISO accessibility criteria above. Genuinely open territory.

**But:** this has a brutal cold-start and network-effect problem. A portable profile is
worth nothing on one site and a lot on a thousand. You cannot bootstrap that in a
hackathon, and a startup needs a wedge before it needs a standard.

**Verdict: this is the vision slide, not the build.** Say "the profile is designed to be
portable; here is the schema" and show `specs/profile-schema.md`. Do not claim a network.

---

## 4. Is it profitable?

Honest, split answer:

**As a standalone conversion-personalization vendor: weak.** Crowded, incumbents own
enterprise distribution, Fibr is already undercutting Adobe on price, and the pitch rests
on a lift number we cannot prove without scale. We would be competing on exactly the
metric where Adobe has a control-group apparatus and we have a slide.

**As a cognitive-accessibility + conversion layer: plausibly yes.** Different buyer
(legal/compliance alongside marketing), uncontested budget, a deadline that has already
passed, and conversion lift becomes the *upside* rather than the entire argument. Adobe
does not currently sell cognitive-accessibility adaptation, and their architecture — ML
selection over marketer-authored variants — isn't naturally shaped for it, because no
marketer authors a variant per reading level.

**The genuinely unresolved question** is the one from `01-feasibility.md` that none of
this research solves: merchants must declare their component registry. That is real
integration work, and it is the actual barrier to revenue. The EAA framing helps, because
compliance work gets scheduled where optimization work gets deferred — but it does not
make the integration free.

---

## 5. What this means for the pitch

**Lead with:** "Personalization today treats the visitor as a target. We make them the
author. And the same engine makes the site legible to people the site currently fails."

**The Adobe Target slide, verbatim-ready:**

> Adobe Target's Auto-Target uses Random Forest to pick which of the *marketer's* pre-built
> experiences you see. Automated Personalization picks among the *marketer's* offer
> combinations. Both are ML selection over a human-authored set — the ceiling is how many
> variants someone had patience to build.
> We synthesize the experience per visitor, so there is no authored set. And the visitor
> can correct us in plain language, which no incumbent allows.

**Keep off the pitch:** "we're the first to personalize websites with AI." We aren't, it's
checkable in thirty seconds, and being caught overclaiming costs more than the claim gains.

---

## Sources

- [How Adobe Target works](https://www.adobe.com/go/target_howitworks_en)
- [Auto-Target to optimize (Adobe Experience League)](https://experienceleague.adobe.com/en/docs/target/using/activities/auto-target/auto-target-to-optimize)
- [Introduction to Target / Automated Personalization](https://experienceleague.adobe.com/en/docs/target/using/introduction/intro)
- [Auto-Target: Personalization reimagined, Powered by Sensei](https://blog.adobe.com/en/publish/2017/03/20/auto-target-personalization-reimagined-by-adobe-target-powered-by-sensei)
- [A Peek Behind the Curtain of AI for Personalization in Adobe Target](https://blog.adobe.com/en/publish/2018/07/06/a-peek-behind-the-curtain-of-ai-for-personalization-in-adobe-target)
- [Adobe's new AI agents can make personal websites for your customers (VentureBeat)](https://venturebeat.com/ai/adobes-new-ai-agents-can-make-personal-websites-for-your-customers)
- [Adobe launches AEP Agent Orchestrator (press release)](https://www.businesswire.com/news/home/20250318537901/en)
- [Adobe Makes Play To Be The Concierge Of AI Brand Services (MediaPost)](https://www.mediapost.com/publications/article/410583/adobe-makes-play-to-be-the-concierge-of-ai-brand-s.html)
- [Adobe Research at Summit 2026: Agentic AI](https://research.adobe.com/news/adobe-research-at-summit-2026-agentic-ai-for-orchestrating-customer-experiences/)
- [Fibr AI launches ads-to-web and LLM-to-web personalization](https://www.pulse.bot/ai/news/fibr-ai-launches-ads-to-web-and-llm-to-web-personalization-to-convert-paid-and-ai-referred-traffic-a9b16c53-5bc4-4dcb-9128-644d55ec909c/)
- [Accel doubles down on Fibr AI](https://www.pulse.bot/ai/news/accel-doubles-down-on-fibr-ai-as-agents-turn-static-websites-into-one-to-one-experiences-b8d56dc2-2a2d-4b37-acb3-e10a74b3bed0)
- [What is an agentic website (Architect)](https://tryarchitect.com/what-is-an-agentic-website)
- [EAA: E-commerce services requirements](https://accessible.org/eaa-ecommerce-services-requirements/)
- [Bird & Bird: navigating the EAA for online retailers](https://www.twobirds.com/en/insights/2025/a-guide-to-navigating-the-european-accessibility-act-for-online-retailers-service-providers-and-plat)
- [PwC: The EU Accessibility Act is here](https://www.pwc.ch/en/insights/regulation/the-eu-accessibility-act-is-here.html)
- [Noerr: Accessibility in e-commerce, new obligations from June 2025](https://www.noerr.com/en/insights/accessibility-in-e-commerce-new-obligations-for-online-shop-operators-starting-from-june-2025)
- [Consumers find some personalization intrusive (CX Dive)](https://www.customerexperiencedive.com/news/consumers-find-some-personalization-intrusive/829729/)
- [Ineffective, invasive personalization turns customers away (CX Dive)](https://www.customerexperiencedive.com/news/ineffective-invasive-personalization-turn-customers-away/830339/)
- [When AI personalization feels like surveillance (CMSWire)](https://www.cmswire.com/customer-experience/when-ai-personalization-feels-like-surveillance/)
- [W3C UAAG portable profiles discussion](https://lists.w3.org/Archives/Public/public-indie-ui/2014Oct/0032.html)
- [US patent: universal website preference management](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8805964)
