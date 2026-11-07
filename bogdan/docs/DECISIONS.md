# Decisions

Settled choices, newest last. One line each: **what**, **why**, who. Agents: read this before proposing an alternative. If you think a decision is wrong, raise it with the team instead of quietly changing course.

Format: `- YYYY-MM-DD · [track] · decision. Why: reason. (owner)`

## Seeded from SPEC / GUARDRAILS

- 2026-11-07 · all · The LLM outputs PageSpec JSON, never code. Why: safety, brand consistency, validatable. (team)
- 2026-11-07 · all · Prices, stock, ratings, and discounts are looked up by `productId` and never pass through the LLM. Why: no hallucinated or personalized pricing. (team)
- 2026-11-07 · all · Runtime AI is the DeepSeek API through one client in `lib/llm`. Model ID comes from `DEEPSEEK_MODEL`. (team)
- 2026-11-07 · all · Personas are needs-based: `simple`, `specs`, `deals`, `explorer`, `balanced`. No demographics. Why: legal/ethical exposure, misclassification. (team)
- 2026-11-07 · all · First paint uses the rules engine + cached variants. LLM calls run only in background refinement or chat. Why: latency. (team)
- 2026-11-07 · A · `packages/schema` (zod) is the single source of truth. Track A owns it. (team)
- 2026-11-07 · all · Stack: Next.js App Router + TS strict, Tailwind + shadcn/ui, Framer Motion, zod, `openai` SDK pointed at DeepSeek. (team)

## Open (see SPEC §11, move here once decided)

- Product category (laptops recommended)
- Full PageSpec per scene vs JSON patches (MVP leaning: full spec)
- DeepSeek model ID(s) and token budget. Provider is locked (see Log); check `api-docs.deepseek.com` on the day for current IDs, since legacy aliases are being deprecated
- Live demo vs recorded fallback. Proposal in [DEMO.md](DEMO.md): live, with replayed responses for scripted beats plus a backup video
- "Receipts" as the name for the claim-source feature (SPEC §4.3)?
- Adopt the truth model and the proposed `claims` / `answer.status` schema additions from [SPEC §4.3](../SPEC.md#43-truth-model-whats-real-on-a-page-the-ai-keeps-reshaping)? Track A to decide
- Add the session agent and optimizer agent from [PLANNING-NOTES.md §6](PLANNING-NOTES.md#6-making-it-agentic)? Not yet in SPEC

## Log

<!-- add new decisions below -->
- 2026-11-07 · all · Build the adaptive storefront, even though the hackathon is hosted by Adobe and Target covers nearby ground. Why: instantly understood, very visual demo, and we change *how much and how* people see, not *what*. Alternatives considered and set aside are in PLANNING-NOTES §2-4. (team)
- 2026-11-07 · all · Pitch line: "Target personalizes content. We personalize complexity." Position it as complementary to Adobe (PageSpec could be delivered as a Target offer or built from AEM content), not as a competitor. (team)
- 2026-11-07 · C · DeepSeek is locked in as the only runtime LLM. Considered Claude Haiku 5.5 and TypeSafe Jev (PLANNING-NOTES §8). Why: team choice, cheap, OpenAI-compatible. Its weak spots are covered by existing rules: zod validation plus one repair retry (JSON mode doesn't enforce our schema), no PII sent (data is processed in China), deterministic fallbacks (outages). (team)
- 2026-11-07 · all · The app is called **Babel**. Considered Facet, Fitted, Dial. Not to be confused with the Babel JS compiler: say "Babel storefront" in package names and search terms where it could clash. (R3ktline)
