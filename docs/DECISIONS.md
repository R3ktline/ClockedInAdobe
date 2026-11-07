# Decisions

The single list of settled choices and open questions. Agents: read this before proposing an alternative. If you think a decision is wrong, raise it with the team instead of quietly changing course. The non-negotiable rules in [AGENTS.md](../AGENTS.md#non-negotiable-rules) also count as settled.

## Open

- **Start time and deadline** of the 12-hour build (pins the hour blocks in [TASKS.md](TASKS.md)).
- **GitHub logins** in `.github/CODEOWNERS` were taken from commit authors: each person should confirm theirs.
- **DeepSeek model ID(s)** and whether to use the thinking mode for the Director. Check `api-docs.deepseek.com` on the day.
- **Product images:** generated or a CC0 set? Either way stored locally with the licence noted.
- **Store names:** check "Taraba" and "Croiala" for clashes with real businesses before the pitch.
- **MCP live demo:** expose `/api/mcp` through a tunnel so a real assistant can connect on stage, or show the A2A script only?

## Log

Format: `- YYYY-MM-DD · [track] · decision. Why: reason. (owner)`. Newest last. Entries before the build phase are in `planning-phase/*/` and are history only.

- 2026-11-07 · all · The app is called **Babel**. Supersedes "Chameleon" (David's ADR-006). Say "Babel storefront" where it could clash with the Babel JS compiler. (bogdan)
- 2026-11-07 · all · **Product framing:** Babel is an AI layer that a store opts into, adapting the store's own pages, not a storefront of its own. Supersedes the "headless storefront" demo framing in bogdan's planning SPEC. (bogdan)
- 2026-11-07 · all · **Persona = dialect × need.** Dialect (`guided`, `standard`, `dense`, `visual`) is how a person reads the web; need (`specs`, `deals`, `inspiration`, `reassurance`, `quick`, `balanced`) is what they want emphasised. Maps bogdan's personas, David's axes, Matei's tiers and Ionut's styles ([SPEC §3.3](../SPEC.md#33-how-the-planning-phase-material-maps-onto-this)). Why: pages tailored to how people understand the web, without demographics. (bogdan)
- 2026-11-07 · all · **No age inference.** A partner may send an age band with consent as a weak prior only, never for prices or offers. Supersedes the age-to-persona mapping in Matei's tracker and the generation targeting in Ionut's styles. Why: legal (GDPR, AI Act Art. 5, DSA Art. 28) and the first thing judges attack. (bogdan)
- 2026-11-07 · all · Matei's "Gen Z 20% discount" and "Expires in 18:24" countdown are **removed**: personalised pricing and false urgency. "Behavioural biometrics" is renamed **interaction signals**. (bogdan)
- 2026-11-07 · all · **Slides, not morphing.** The UI intent is a timeline of slides: minor slides during a visit (≤ 2 blocks), a major slide only on a return visit with carry-over of anchors and the shopper's most-used blocks. Supersedes "at most one automatic re-layout per session" (bogdan) and "implicit signals cut first" (David). (bogdan)
- 2026-11-07 · all · **Slide replaces both PageSpec and UIIntent.** Built on David's UIIntent (no content, registry-bounded) plus a timeline, change budget, hypothesis and brand clamp. (bogdan)
- 2026-11-07 · all · **AI is brand-bounded** by a per-store BrandKit (fixed colours/fonts, clamped ranges) and Registry. Ionut's generation reskins become dialect design references, not reskins. (bogdan)
- 2026-11-07 · all · **AI-centred:** a Director agent (tools, hypothesis, self-repair, outcome check) decides every slide after slide 0; rules are only for first paint and fallback. (bogdan)
- 2026-11-07 · all · **Marketing markers** defined in [MARKERS.md](MARKERS.md): 13 deterministic markers driving the Director and the merchant panel. (bogdan)
- 2026-11-07 · C · **DeepSeek is the only runtime LLM.** Why: cheapest. The China data-location concern is accepted; no personal data is sent. Supersedes Claude in David's architecture doc. (bogdan)
- 2026-11-07 · all · **No Adobe integration.** No sandbox; Adobe Target/AEM/AEP stays out of the build and out of the pitch except as a Q&A answer. Supersedes David's ADR-008 and `09-adobe-integration.md`. (bogdan)
- 2026-11-07 · A · **Third-party integration = A2A** for agentic shopping (Agent Card + JSON-RPC via `@a2a-js/sdk`), plus the same tools as an **MCP** server so Claude/ChatGPT-style assistants can connect. Agents get the same prices; Babel never negotiates. (bogdan)
- 2026-11-07 · all · **Demo category: multi-category.** Two fictional stores inspired by real ones: Taraba (general marketplace, eMAG/Amazon-like, P0) and Croiala (fashion, Zalando/About You-like, P1). Supersedes "laptops only". (bogdan)
- 2026-11-07 · all · **Data is synthetic.** David's 10 client profiles become shopper fixtures on Taraba (client #8 renamed Victor). Data gathering is not the focus; the change to the UI/UX, conversion and markers is. (bogdan)
- 2026-11-07 · all · **Cost is a TODO**: measure real DeepSeek usage during the build and price it from DeepSeek's own pricing page ([SPEC §14](../SPEC.md#14-cost)). (bogdan)
- 2026-11-07 · all · **Track split confirmed:** A bogdan, B Ionut, C David, D Matei. **Foundation first:** bogdan alone builds the base app and a thin proof of concept across all folders; the tracks take over their folders after the foundation checkpoint in [TASKS.md](TASKS.md#phase-1-foundation-bogdan-solo). Why: one coherent base instead of four agents scaffolding conflicting structure. (bogdan)
- 2026-11-07 · C · **The Director proposes a change set (`SlideProposal`), not a whole Slide.** Code applies it to the current slide and validates the result. Why: smaller model output, fewer invalid proposals, and the change budget becomes a simple diff check. (bogdan)
- 2026-11-07 · A · **Registry blocks carry `label` and `byDialect`.** Each store decides what a dialect means for its own blocks; Babel only adds theme presets and need-based ordering. (bogdan)
- 2026-11-07 · A · **Stack pinned:** Next.js 16, TypeScript 5.9 (not 7: the native rewrite is too new for Next's type checks), Tailwind 4, zod 4, vitest. No LLM key → `babel/llm` answers with each agent's deterministic mock, so the app always runs. (bogdan)
- 2026-11-07 · C · **Any OpenAI-compatible endpoint can stand in for DeepSeek** through the same three env vars (`DEEPSEEK_BASE_URL`, `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`). Testing uses OpenRouter's free `nvidia/nemotron-3.5-lightning:free`; free models are slower, so the Director's budget is `BABEL_DIRECTOR_BUDGET_MS` (default 6000, ~45000 for free models). DeepSeek stays the target model. (bogdan)
- 2026-11-07 · C · **The agent also decides when to look.** Besides marker thresholds, the session asks the Director for a "checkin" after 15 s with at least 3 new events (`BABEL_CHECKIN_MS`, 0 = off); it decides on its own whether to change the page. Same pacing and change budget apply. (bogdan)
- 2026-11-07 · C · **DeepSeek model: `deepseek-flash`** (DeepSeek-V4.1-Flash, listed by `/models` for our key). `deepseek-v4-pro` is available if quality needs it. (bogdan)
- 2026-11-07 · B · **Ghost replay drives the real UI** (cursor, scroll, real clicks via `data-ghost` tags), and a testing overlay shows the agent's status, the model's answer and a plain-language "What changed" list. (bogdan)
- 2026-11-07 · D · **Zooming in is a high-interest signal.** A browser or pinch zoom of 10%+ (`page_zoom`) triggers the Director immediately, skipping the 20 s pause; the prompt tells it not to hold and to raise text size one step and simplify. Rationales talk about the zoom, never eyesight or age. Also fixed: the slide route cleared the trigger list before the Director could read it. (bogdan)
