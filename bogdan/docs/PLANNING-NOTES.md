# Planning notes (2026-11-07)

**History, not truth.** This records what we looked at and why we set it aside. Outcomes are in [DECISIONS.md](DECISIONS.md) and the build contract is [SPEC.md](../SPEC.md). Don't cite this file as current.

Market facts come from web searches on the day. Many are vendor claims or third-party summaries, so check the ones marked unverified before they go on a slide.

---

## 1. Where we landed

Outcomes (idea, pitch line, DeepSeek, name) are logged in [DECISIONS.md](DECISIONS.md). The biggest gap left: as specced, the product is mostly a fixed workflow plus a chatbot. §6 proposes how to make it properly agentic.

## 2. Adobe already covers a lot

The hackathon is hosted by Adobe, and several obvious directions are already Adobe products:

| Direction | Adobe product |
|---|---|
| Personalization and experiments | **Target**, plus Experience Platform agents (audience, journey, experimentation) and the CX Enterprise agentic system shown at Summit 2026 |
| Generating campaign content and checking brand compliance | **GenStudio for Performance Marketing** (brand scoring, disclosure libraries, accessibility checks), plus **Brand Intelligence** (April 2026) |
| Being mentioned in AI answers (ChatGPT, Perplexity) | **LLM Optimizer**, being renamed **Brand Visibility** (around Aug 2026) |
| Content provenance | **Content Credentials (C2PA)**, an Adobe-led standard |

Takeaway: don't compete on *doing* personalization or *making* content. Either extend Adobe or work where AI sits on the **customer's** side.

## 3. Alternatives explored

| Idea | What it is | Verdict |
|---|---|---|
| **Personalization fairness auditor** | Synthetic shoppers browse a site as profiles that differ in one trait each. The tool compares what each profile saw (prices, product order, urgency banners) and flags unfair differences | Most novel. The method exists in research (Northeastern, 2014: personalization found on 9 of 16 shops), but we found no product for brands auditing themselves. Timely: the EU Digital Fairness Act proposal is expected Q4 2026. **Set aside**: it's the same engine as the next idea, and it's an audit tool rather than a marketing product |
| **"Walk in their shoes" persona simulator** | Agents use a site as specific people (low vision, tremor, non-native speaker) and report where they get stuck. Limitations are simulated in code (low-contrast text hidden, small tap targets mis-tapped), not just described in a prompt | Crowded (Brox.ai, POPJAM, Shopify SimGym, the UXAgent paper). Simulating limits in code answers the main criticism that AI test users follow tidy paths. **Same engine as the auditor.** Reusable later as the traffic source for the optimizer (§6) |
| **Expectation-gap / returns loop** | An agent mines return reasons and low-star reviews, finds the claim or image that sets a wrong expectation, rewrites the product page, and measures whether returns drop | Passes the agent test (§5). The workflow is known (PIM vendors, Claimlane) but no product owns it. Hard to demo without real returns data. **Set aside** |
| **Brand agent for agent-to-agent shopping** | Each brand runs an agent that answers buyer agents with signed, verifiable claims | **Rejected**: it's a chatbot with an API. Today's buyer agents read platform product feeds and don't negotiate with brand agents. Negotiating offers is personalized pricing. The useful part (verifiable claims) is a data standard, not an agent |
| **AI inbox preview** | Shows how Gmail, Apple Mail and Outlook AI would summarize an email campaign, then rewrites it so the message survives | Small and useful, but weak on "agentic". Competitors not checked |
| **Marketing as a utility** | The ad slot holds a small useful agent (e.g. "plan my hike") instead of a banner | Close to existing "branded GPTs". Hard to pitch as new |
| **AI-disclosure agent for campaigns** | Labels AI-generated assets per the AI Act's Article 50 (in force since 2 Aug 2026), using Content Credentials | Timely and Adobe-aligned, but GenStudio already covers part of it |
| **Calm shopping companion** | A browser extension that simplifies any shop and flags scam sites and dark patterns for less confident shoppers | High impact, but not a marketing product and a poor fit for Adobe |

## 4. Reimagining marketing with AI

Marketing was built around three limits. AI removes all three:

| Old limit | What AI changes | Who owns it |
|---|---|---|
| Content was expensive, so a few versions per segment | Near-free content per person. The bottleneck moves from *making* to *judging* (true, on-brand, legal) | Adobe (Firefly, GenStudio). Crowded |
| Feedback was slow (weeks-long A/B tests) | Real-time optimization and simulated customers | Target, Optimizely, synthetic-user startups. Crowded, weak evidence |
| The audience was a human | **An AI increasingly reads marketing first**: answer engines, shopping agents, AI browsers, inbox summaries | Partly covered (Brand Visibility tracks mentions, not whether an agent *chooses* you) |

What changes when an AI is the first reader:
- **Persuasion gives way to proof.** Agents compare claims instead of reacting to emotion or scarcity.
- **Dark patterns stop working.** An agent ignores a countdown timer.
- **Your brand is what the model says about you.** An inbox AI can shrink a campaign to "Promo: 20% off shoes".
- **The funnel becomes a negotiation.** A request like "jacket under €150, ships Friday" asks for offers.
- **Trust becomes machine-checkable** (Content Credentials, EU Digital Product Passports from 2027).

The insight holds, but the product we built on it (the brand agent) didn't. See §3.

## 5. What "agentic" means

**Definition:** you give the AI a **goal**, and it chooses its own next steps, **acts** with tools, **looks at the result**, and repeats until it decides it's done or can't be.

**Quick test:** if you can draw the exact flowchart in advance, it's a workflow. If the path is chosen at runtime based on what the AI sees, it's an agent.

| Level | What it is | Who picks the next step |
|---|---|---|
| 0. Single call | Prompt in, output out | Nobody |
| 1. Chatbot | Multi-turn conversation | The human, every turn |
| 2. Workflow | Several AI calls in a fixed order | Our code |
| 3. Tool-using agent | The model picks tools, order and when to stop | The model, within one task |
| 4. Autonomous loop | Works on a goal over time, acts, measures, adapts | The model, across cycles, with a human approving risky actions |

Multi-agent setups (planner, worker, critic) are a way to build levels 3–4, not a higher level.

**An agent needs:** a goal (not a question), tools that change things, memory of what it tried, feedback from outside the model (clicks, errors, test results), a stopping rule, and limits on what it may do alone.

**Misconceptions:** chat isn't agentic, more AI calls aren't more agentic, and more autonomy isn't always better. Keep fixed workflows wherever the path is known; the guardrail pipeline *should* stay one.

**Where the current spec sits:** mostly level 2, with level 3 in the chat.

## 6. Making it agentic

*Proposal, not yet in SPEC.*

The original design was a fixed workflow for one reason: **the first page load must be instant and predictable**, and an agent loop takes seconds. That rules out one place for an agent, not the whole idea.

**Rule:** the first page load stays a fixed, instant workflow. Agents work wherever a few seconds or minutes are acceptable.

| Where | Time budget | What the agent decides and does | Feedback |
|---|---|---|---|
| **Chat agent** | 2–10 s | Plans tool calls. Recovers from surprises: loosens filters on no results, asks a clarifying question. Picks the view type. Repairs the page if the critic rejects it | Tool results, critic verdict |
| **Session agent** (new) | Background, during browsing | Watches behavior and decides **whether and how to step in**: swap a spec table for key facts, open a guided chooser, offer "compare these two side by side?" | What the shopper does next. Undo or try something else if it didn't help |
| **Optimizer agent** (new) | Minutes to hours | Across sessions: finds where a persona drops off, designs a new layout, tests it on simulated traffic, keeps or rolls back | Conversion and drop-off per persona |

**Session agent limits:** at most 2–3 interventions per session, one-click undo on every change, nothing moves mid-scroll, and only a fixed set of allowed actions. It never touches prices.

**48-hour plan:** chat agent (already planned) → session agent (the live demo star) → optimizer (stretch, on simulated traffic).

## 7. Keeping the original idea: pros and cons

**Pros**
- Adobe judges understand it instantly and can focus on execution.
- Very visual demo: the store changing shape live.
- A real difference from Target: shape and density, not content.
- Plugs into Adobe (PageSpec as a Target offer, AEM as the content source, Firefly for persona-specific images).
- Social-impact angle for less confident and older shoppers.
- Planning is already done.

**Cons**
- Judges know the space better than us and will compare it to Target.
- Lower novelty score.
- Weak on "agentic" as specced (fixed by §6).
- Persona detection is easy to attack ("how do you know I'm older?").
- Privacy and legal questions need a slide.
- DeepSeek instead of Adobe AI may cost points if judging rewards Adobe tech. Check the rules.

**Fixes:** add the agent loops (§6), lead with the pitch line, use Adobe tools where possible (even mocked), and answer the hard questions in the main pitch.

**Verdict:** viable. It should score high on demo and relevance and middling on novelty. The "agentic" score depends on the loops in §6.

## 8. Model choice

**Locked: DeepSeek.** Alternatives we compared:

| Model | Input / output per 1M tokens | Notes |
|---|---|---|
| **DeepSeek V4 Flash** | ~$0.15 / $0.60 (third-party, unverified) | Chosen. OpenAI-compatible, JSON mode, tool calls, automatic prefix caching. JSON mode doesn't enforce our schema. Data processed in China |
| Claude Haiku 5.5 | $0.10 / $0.50 (Anthropic reference) | Schema-guaranteed structured outputs and strict tool calls |
| Claude Sonnet 5.5 | $2 / $10 | Would have been the fallback for hard planning steps |
| Gemini 3.8 Flash | ~$0.75 / $3.75 (introductory, sources disagree) | Only worth it with Google credits |
| OpenAI cheapest tier | ~$0.10–0.20 / $0.50–1.25 (sources disagree) | Model names unclear |
| Groq / Cerebras | Free tiers, very fast | Open models are less reliable at tool calling |
| xAI Grok 4.6 | ~$2 / $6 | Not cheap for what it offers |

**Price barely matters at hackathon scale:** about 2,000 calls of 10K tokens each is roughly $2–5 on any cheap model. How DeepSeek's weak spots are covered: [ANALYSIS §2.13](ANALYSIS.md#213-deepseek-specific-risks).

**TypeSafe Jev** (considered, not used): a "System One" decision model. It answers typed questions (yes/no, choice up to 255 options, scores up to 10 levels) about the data you send, returns calibrated probabilities, and **never writes text**. Vendor claims: 70–500 ms, $0.042 per 1M input tokens, output free. It scores 67.8% on its maker's own benchmark, tied with GPT-5.6 Terra and below Claude Opus 5's 73.1%. It would have fit the fast decisions (persona choice, "is the shopper struggling?", which intervention, input and policy checks, chat intent), but it can't write PageSpecs, copy or tool plans. It's early access behind a waitlist, with no documented rate limits or data handling. Revisit only if we get keys and the session agent turns out too slow on DeepSeek.

## 9. Still open

Moved to [DECISIONS.md → Open](DECISIONS.md#open).

---

## Sources

- Adobe: [GenStudio brand compliance](https://business.adobe.com/products/genstudio-for-performance-marketing/brand-compliance.html), [Brand Intelligence](https://cmotech.news/story/adobe-adds-brand-intelligence-to-genstudio-marketing-tools), [LLM Optimizer / Brand Visibility](https://helpx.adobe.com/legal/product-descriptions/adobe-llm-optimizer.html), [CX Enterprise](https://letsdatascience.com/news/adobe-launches-cx-enterprise-and-firefly-assistant-48ad6820)
- Fairness auditing: [Northeastern – price discrimination and steering](https://khoury.northeastern.edu/home/ancsaaa/files/imc151.pdf), [Freshfields – Digital Fairness Act](https://technologyquotient.freshfields.com/post/102lw3c/the-eus-proposed-digital-fairness-act-an-e-commerce-players-guide-to-potential)
- Synthetic users: [AIMultiple overview](https://aimultiple.com/synthetic-users), [Userbrain experiment](https://www.userbrain.com/blog/synthetic-users-experiment/), [Blinkux – real vs synthetic](https://blinkux.com/ideas/real-users-vs-synthetic-modern-usability)
- Returns: [Claimlane](https://www.claimlane.com/resources/blog/returns-data-product-descriptions), [Credencys](https://www.credencys.com/?p=41228)
- AI Act Article 50: [Cooley](https://www.cooley.com/news/insight/2026/2026-08-03-eu-ai-act-transparency-obligations-take-effect-2-august-2026)
- Model pricing: [DeepSeek (devtk)](https://devtk.ai/en/blog/deepseek-api-pricing-guide-2026/), [Gemini (Morphllm)](https://www.morphllm.com/gemini-api-pricing), [OpenAI (Morphllm)](https://morphllm.com/openai-api-pricing), [LLM pricing comparison](https://agentdeals.dev/llm-api-pricing), [Grok 4.6](https://anotherwrapper.com/llm-pricing/grok-4.6)
- Jev: [TypeSafe announcement](https://typesafe.ai/blog/introducing-system-one-models-and-jev), [docs](https://docs.typesafe.ai/introduction), [eesel review](https://www.eesel.ai/blog/typesafe-jev-review), [TrueFoundry explainer](https://www.truefoundry.com/blog/typesafe-ai-jev)
