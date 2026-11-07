# Planning phase (archive)

Everything the team produced before the build, kept as it was written. **History, not truth:** the build contract is [../SPEC.md](../SPEC.md) and the outcomes are logged in [../docs/DECISIONS.md](../docs/DECISIONS.md). Links inside these folders may point to paths that have since moved.

| Folder | Who | What it is |
|---|---|---|
| [bogdan/](bogdan/README.md) | bogdan (R3ktline) | First full spec of Babel (PageSpec, truth model, guardrails, demo, risks, agentic analysis, A2A proposal) |
| [david/](david/README.md) | David Ionica | Concept, feasibility, architecture, ADRs, competitor research, Adobe mapping, UserProfile/UIIntent schemas, 10 client profiles, design briefs |
| [matei/](matei/README.md) | Matei (estegucci-oss) | Signal tracker SDK and demo (6-tier detection) |
| [ionut/](ionut/) | Ionut (ionutdautema) | Visual style pages (`gen-alpha-style.html`, `older-gen-z-style.html`) and the generation moodboard |

## What carried into the build

| Kept | From |
|---|---|
| LLM emits config, never code; prices and facts never pass through it; first paint never waits on the LLM; explicit choice beats inference; low confidence means less adaptation | bogdan, David |
| UIIntent (no content, registry-bounded) as the base of the **Slide** | David |
| Truth model, guardrail layers, prompt structure, red-team fixtures, judging criteria, A2A agent channel | bogdan |
| Signal sources (search wording, OS zoom/contrast, referrer, scroll, localStorage) as **interaction signals** | Matei |
| The 10 client profiles as shopper fixtures; "sometimes the right page has less on it"; "volume is not interest" | David |
| Generation styles as design references for the **dialects** | Ionut |

## What was dropped, and why

| Dropped | Why |
|---|---|
| Age detection and age-to-persona mapping (Matei), generation targeting (Ionut) | Legal exposure and inaccuracy; replaced by dialect × need |
| Age-targeted "20% off" and the countdown timer (Matei's demo) | Personalised pricing and false urgency |
| Full reskins (Windows XP style, Apple product images) | Breaks brand bounds; third-party assets |
| Own headless storefront as the product (bogdan) | Babel plugs into a store instead |
| One re-layout per session (bogdan); implicit signals cut first (David) | Continuous adaptation as slides is now the core |
| Adobe Target/AEM/AEP integration (David) | No sandbox; A2A/MCP is the integration |
| Laptops-only catalog | Multi-category stores |
| Claude as runtime model (David) | DeepSeek chosen for cost |
