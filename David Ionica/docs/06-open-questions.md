# 06 — Open questions

Add questions here rather than guessing. When answered, move the answer into the relevant
doc and mark the question `ANSWERED` with the date — don't delete it.

## Blocking the plan

1. **What is the deadline?** Hours remaining determines everything in `03-plan.md`.
   Phases are currently unpinned to dates because of this.
2. **How many people, and who does what?** Suggested split: one on the storefront +
   registry (P1), one on the engine + chat (P2/P3), one on the trust surface + pitch
   (P5/P6). Agents can take whichever lane is unclaimed.
3. ~~**Repo access.**~~ **ANSWERED 2026-11-07 — resolved. The repo exists.** It is private,
   and David *is* a collaborator on it. Every earlier 404 came from either an anonymous
   request or a token with no repository access — and GitHub returns an identical 404 for
   "private" and "does not exist", so "the repo may not exist" stayed an open possibility
   right up until it was checked with working credentials. **Access route:** Docker
   Desktop's MCP toolkit — `docker mcp oauth authorize github`, then granting the connector
   access to this repo. **No personal access token was needed.** Note the connector is a
   GitHub *App*, so it reaches only repositories it has been granted; the `--scopes` flag
   does nothing. See `07-upstream-repo.md` for the full check history.

## Scope and positioning

4. ~~**Is this an Adobe-sponsored hackathon?**~~ **ANSWERED 2026-11-07 — yes, confirmed by
   David.** Consequence was the *opposite* of what this question assumed: do **not** position
   against Adobe Target. Position *on top of* it — "Target optimizes among the variants a
   marketer authored; we generate the variants it optimizes among." See **ADR-008** and
   `docs/09-adobe-integration.md`, which maps every component to a real Adobe product with
   three claims verified against Adobe's docs. Biggest win: running `UIIntent` as a Target
   JSON offer inside an Automated Personalization activity means **Target's control group
   measures us**, which fixes our worst weakness.
5. **What are the judging criteria?** Weighting between technical depth, business case,
   and demo polish changes the cut list in `03-plan.md` significantly.
6. **Demo vertical: electronics?** The laptop example is good because expertise variance
   is genuinely high and specs are genuinely confusing. Alternatives with the same
   property: insurance, mortgages, supplements, enterprise SaaS pricing pages. Electronics
   is probably right — it needs no domain explanation to a judge.
7. **Project name.** "Chameleon" is a placeholder (ADR-006).

## Technical

8. **Is there a real partner site, or only our demo storefront?** Changes whether the
   SDK must work against a site we don't control. Assume demo-only unless told otherwise.
9. **Anonymous or logged-in users?** Affects profile storage and the consent flow.
   Assume anonymous + localStorage for the hackathon.
10. **How many page templates?** Default assumption: one (`product_detail`). A category
    listing page would also demo well but doubles the registry work.
11. **Does the chat need to answer product questions too**, or only reshape the page?
    Default assumption: reshape only. Product Q&A is a different (crowded) product and
    will eat the whole timeline. **Note:** Adobe Brand Concierge already does product Q&A
    well. Competing there is a losing fight; reshaping is the open gap.

## Added 2026-11-07 after competitive research (`docs/08-competitive-analysis.md`)

12. **Does the team accept the ADR-007 reframe?** Still the highest-priority decision, now
    **as amended by ADR-008**: visitor agency + cognitive accessibility as the
    differentiators, with Adobe Target as an **integration surface rather than a
    competitor**. Everything in the pitch depends on this. Architecture is unaffected.

## Added 2026-11-07 after Adobe sponsorship was confirmed

17. **Do we have any Adobe tenant access through the sponsorship?** If the hackathon provides
    an AEP/AEM/Target sandbox, the integration in `docs/09-adobe-integration.md` stops being
    a slide and becomes demonstrable — which would be worth more than anything else on the
    list. **Ask the organisers.** If not, the honesty constraint in ADR-008 is binding.
18. **Are the judges Adobe employees?** Changes how much Adobe product knowledge to assume,
    and how carefully to phrase Target's authoring ceiling. Be respectful: it's a real
    constraint of the variant-authoring model, not a flaw in the product.
19. **`[VERIFY]` before building on the AEP claim:** custom profile fields reportedly need
    XDM profile schemas with data-usage labels and license entitlements, and high-volume
    custom attributes can consume profile/storage quota. Both from community posts, not
    official docs. Also note **enabling a schema for Profile cannot be undone.**
13. **Do we pursue the accessibility/EAA angle?** It is the strongest profitability story
    found, but it needs legal care. Before pitching: read Directive (EU) 2019/882 Annex I
    directly (**not** vendor blogs — several overstate things), confirm that **EN 301 549**
    is the referenced technical standard rather than WCAG, and check the current
    reputational and enforcement status of "accessibility overlay" vendors so we are not
    mistaken for one. Marked `[VERIFY]` in doc 08.
14. **Can we produce any real measurement?** Adobe Auto-Target holds back a control group
    and reports actual lift. We have nothing. Even a tiny within-team preference test
    (N≈20: show both page versions, ask which they'd rather buy from) is worth far more in
    Q&A than a simulated dashboard. Decide whether there's time.
15. **Is Fibr AI the closest competitor?** Needs a proper teardown — pricing, integration
    model, whether the visitor has any control. Put findings in `research/`. If they
    already do visitor-facing control, Direction A weakens and we need to know now.
16. **Does Adobe Brand Concierge let a visitor reshape page layout by chatting?** The
    reporting I found does not say so, which is the basis of our gap claim. This should be
    confirmed against Adobe's own product documentation before it goes on a slide — the
    whole chat differentiation rests on it.

## Added 2026-11-07 with `specs/client-profiles.md`

20. **Add `trust` and `buyingFor` to `specs/profile-schema.md`?** Both are used in the 10
    client profiles, kept in a separate `proposed` block so the profiles still match the
    current schema. `trust` (0–1) is needed to *remove* persuasion (Bogdan #8, Radu #6);
    `buyingFor` (`self` | `other`) covers gift and team buyers (Gheorghe #10, Ioana #7).
    `bogdan/SPEC.md` has the same gap (no skeptic, gift or repeat-buyer persona). Needs
    David's call, then agreement with Bogdan.
21. **Name clashes.** `specs/visitor-fixtures.md` reuses six names from the canonical client
    profiles for different people, and client #8 shares a name with teammate Bogdan.
    Proposal: rename the fixtures file's people, and rename client #8. Not done — renaming
    touches files the design workstream already uses.
22. **Return-visit memory.** `bogdan/SPEC.md` lists cross-session tracking as a non-goal;
    client #5 (Cristina) depends on it. localStorage-only would be enough. Team decision.
