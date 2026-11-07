# Decisions

The single list of settled choices and open questions. Agents: read this before proposing an alternative. If you think a decision is wrong, raise it with the team instead of quietly changing course.

The non-negotiable rules in [CLAUDE.md](../CLAUDE.md#non-negotiable-rules) and the stack in [SPEC §6](../SPEC.md#6-tech-stack) also count as settled.

## Open

- Product category (laptops recommended)
- Full PageSpec per scene, or JSON patches? (MVP: full spec. Patches only if payloads get slow)
- DeepSeek model ID(s) and token budget. Check `api-docs.deepseek.com` on the day, since legacy aliases are being deprecated
- First visit: an explicit one-tap onboarding question, or only the view chip? (Recommend: chip plus an optional question)
- Demo format: live vs recorded, and whether the venue network can carry live calls. Proposal in [DEMO.md](DEMO.md)
- Add the session agent and optimizer agent from [PLANNING-NOTES §6](PLANNING-NOTES.md#6-making-it-agentic)? Not yet in SPEC
- Adopt the truth model's schema additions (`claims`, `answer.status`) from [SPEC §4.3](../SPEC.md#43-truth-model-whats-real-on-a-page-the-ai-keeps-reshaping)? Track A to decide
- "Receipts" as the name for the claim-source feature?
- Hackathon judging criteria: are Adobe APIs required, and how is "agentic" weighted?
- Can we get Adobe sandbox access (Target, AEM, Firefly) for the integration story?

## Log

Format: `- YYYY-MM-DD · [track] · decision. Why: reason. (owner)`. Newest last.

- 2026-11-07 · all · Build the adaptive storefront, even though the hackathon is hosted by Adobe and Target covers nearby ground. Why: instantly understood, very visual demo, and we change *how much and how* people see, not *what*. Alternatives set aside are in PLANNING-NOTES §3. (team)
- 2026-11-07 · all · Pitch line: "Target personalizes content. We personalize complexity." Position it as complementary to Adobe (PageSpec delivered as a Target offer or built from AEM content), not as a competitor. (team)
- 2026-11-07 · C · DeepSeek is the only runtime LLM. Why: team choice, cheap, OpenAI-compatible. Alternatives in PLANNING-NOTES §8; how its weak spots are covered in [ANALYSIS §2.13](ANALYSIS.md#213-deepseek-specific-risks). (team)
- 2026-11-07 · all · The app is called **Babel**. Considered Facet, Fitted, Dial. Not to be confused with the Babel JS compiler: say "Babel storefront" in package names and search terms where it could clash. (R3ktline)
