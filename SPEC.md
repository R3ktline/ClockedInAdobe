# SPEC: Babel

> **The shared build contract.** Every person and every coding agent builds against this file. If your code disagrees with it, the code is wrong or this file needs a PR. Settled choices are in [docs/DECISIONS.md](docs/DECISIONS.md); who does what is in [docs/TASKS.md](docs/TASKS.md).
>
> Context: a **12-hour hackathon**, judged on [these criteria](docs/JUDGING-CRITERIA.md). Shopper data is **synthetic**. We optimise for a convincing, honest demo, not for production.

---

## 1. One-liner

**Babel is an AI layer an online store plugs into.** It works out what kind of shopper is on the page, keeps scoring marketing markers from how they behave, and an agent re-composes the store's own page as a series of **slides**, always inside the store's brand. The same catalog is also open to shopping agents (OpenAI, Anthropic, anyone) over **A2A** and **MCP**.

> **Every shopper speaks a different web dialect. Babel translates the store.**

People don't all read the web the same way. Some want one big button and plain words, some want a dense spec table, and some want images and almost no text. Today they all get the same page. Babel gives each one a page shaped to how *they* understand the web: same products, same prices, different shape.

## 2. Goals and non-goals

**Goals (demo)**
1. A store we don't own the code of in spirit (two fictional stores, [§9](#9-demo-stores-and-catalog)) adds Babel through one integration point.
2. The page adapts to **who the shopper is** (persona = dialect × need, [§3](#3-personas-dialect--need)) from partner-provided context plus interaction signals.
3. Adaptation is a **timeline of slides** ([§4](#4-slides-ui-intent-that-changes-over-time)): small steps during a visit, a **major** re-composition only on a **return visit**, and some of the old layout always carried over.
4. An **AI agent decides every slide** ([§6](#6-ai-at-the-centre-the-agents)): it reads the markers, states a hypothesis, acts, and checks whether it worked.
5. **Marketing markers** ([§5](#5-marketing-markers)) are defined, computed live, shown to the merchant, and fed back into the agent.
6. The AI is **brand-bounded** ([§7](#7-brand-bounds)): it chooses inside the store's brand kit and registry, never outside.
7. **Agentic shopping** ([§8](#8-agent-gateway-a2a--mcp)): buyer agents query the store over A2A/MCP and hand a link back to the human.
8. Everything is **legal by design** ([docs/GUARDRAILS.md](docs/GUARDRAILS.md)).

**Non-goals**
- Real checkout or payments (cart is mocked).
- Real store integrations, Adobe products, or real tracking data. Data is synthetic and labelled as such.
- Collecting data ourselves in the real world. Signal collection exists, but the demo is driven by synthetic sessions.
- Personalized pricing, **ever**.
- Age inference, **ever** ([GUARDRAILS §3](docs/GUARDRAILS.md#3-what-babel-may-know-about-the-shopper)).

## 3. Personas: dialect × need

A persona is two things, plus a confidence:

```ts
type Persona = { dialect: Dialect; need: Need; confidence: number /* 0-1 */ };
```

### 3.1 Dialect: how this person reads the web

Chosen from **how they interact**, not from who they are.

| Dialect | The page looks like | Typical evidence |
|---|---|---|
| `guided` | Large type, 1 column, explicit text labels on every icon, one primary button, step-by-step chooser, reduced motion | OS zoom / large text, coarse pointer with mis-taps, long hover before clicks, reduced-motion or high-contrast settings, conversational search ("something warm for my granddaughter") |
| `standard` | The store's normal page | Default; weak or mixed evidence |
| `dense` | Compact, 4-5 columns, tables, expanded filters, keyboard-friendly | Fine pointer, filter and sort use, spec-table opens, acronym-heavy search ("ANC LDAC 30h") |
| `visual` | Image-first, bento/feed cards, swipe gallery, minimal text | Fast scroll, gallery swipes, image zooms, social referrer, almost no block opens |

The generation moodboard and style pages from the planning phase ([planning-phase/ionut/](planning-phase/ionut/)) are the **design inspiration** for the dialects. They are not targeted at generations, and they are expressed inside each store's brand ([§7](#7-brand-bounds)), never as a reskin.

### 3.2 Need: what this person wants emphasised

| Need | What moves up | Main markers |
|---|---|---|
| `specs` | Spec tables, compare matrix, technical copy register | `infoAppetite`, `jargonComfort` |
| `deals` | Price sort, the store's real promotions (same for everyone), price per unit, cheaper alternatives | `priceSensitivity` |
| `inspiration` | Editorial, lifestyle images, "popular now" (real numbers only) | `inspirationAppetite` |
| `reassurance` | Returns, warranty, delivery, review summaries; promo badges **removed** | `trustNeed`, `hesitation` |
| `quick` | Reorder, prominent buy box, everything else collapsed: a page with **less** on it | `purchaseIntent` stage = deciding |
| `balanced` | Store default | none dominant |

At least one demo persona (`quick`, `reassurance`) must get a page that is **simpler and less commercial** than the default. Otherwise Babel reads as an upsell engine.

### 3.3 How the planning-phase material maps onto this

| Planning-phase source | Becomes |
|---|---|
| bogdan's personas: `simple`, `specs`, `deals`, `explorer`, `balanced` | `simple` → `guided` × (`balanced` or `reassurance`); `specs` → `dense` × `specs`; `deals` → `standard` × `deals`; `explorer` → `visual` × `inspiration`; `balanced` → `standard` × `balanced` |
| David's axes (`informationAppetite`, `jargonTolerance`, `priceSensitivity`, `intentStage`, `trust`, `buyingFor`) | Markers `infoAppetite`, `jargonComfort`, `priceSensitivity`, `purchaseIntent`, `trustNeed`. `buyingFor: other` shows as a gift context on the slide (age suitability, gift receipt) |
| Matei's tiers | Tier 1 (account) → `PartnerContext.account`, **without** age-to-persona mapping. Tier 2 (UTM) → campaign **intent** tags, never demographic cohorts. Tier 3 (OS zoom, contrast) → dialect evidence. Tier 4 (search wording) → `jargonComfort` / dialect. Tier 5 ("behavioural biometrics") → **interaction signals**. Tier 6 (localStorage) → return-visit memory for major slides |
| Ionut's generation styles | Dialect design references (`visual` ← Gen Alpha bento, `guided` ← clear-affordance classic UI). The XP reskin itself is out: it breaks brand bounds and uses third-party assets |

### 3.4 The 10 demo shoppers

David's ten client profiles ([planning-phase/david/specs/client-profiles.md](planning-phase/david/specs/client-profiles.md)), moved onto our multi-category store. They become `data/shoppers/*.json`: a synthetic `PartnerContext` plus a scripted interaction stream. Ages stay as human labels in the fixture only; **the engine never sees them**.

| # | Shopper | Shopping for (on Taraba) | Expected persona |
|---|---|---|---|
| 1 | Tudor | sneakers | `visual` × `inspiration` |
| 2 | Ana | the cheapest decent suitcase | `standard` × `deals` |
| 3 | Mihai | a laptop | `dense` × `specs` |
| 4 | Elena | the weekly grocery order | `standard` × `quick` |
| 5 | Cristina | a sofa, second visit | `visual` × `reassurance` (major slide on revisit) |
| 6 | Radu | a washing machine, skeptical of promos | `standard` × `reassurance` |
| 7 | Ioana | monitors for her team | `standard` × `specs`, plain copy register |
| 8 | Victor (was "Bogdan" #8, renamed to avoid clashing with our teammate) | a power drill, distrusts deal badges | `dense` × `reassurance` |
| 9 | Maria | her usual vitamins and skincare (non-prescription) | `guided` × `quick` |
| 10 | Gheorghe | a present for his granddaughter | `guided` × `reassurance`, gift context |

### 3.5 How a persona is decided

1. **Slide 0 (instant, no LLM wait):** `babel/persona` rules score the `PartnerContext` and the first signals, then pick a cached slide for that persona.
2. **Every later slide:** the Director agent ([§6.1](#61-director-the-core-loop)) re-reads the markers and may revise the persona. Its revision is what counts.
3. **Explicit choice always wins:** the view switcher or a chat request ("simpler please") locks the dialect and need until the shopper changes them.
4. Below confidence `0.55`, use `standard` × `balanced`. **Low confidence means less adaptation, not a guess.**

## 4. Slides: UI intent that changes over time

Babel never emits markup. It emits a **Slide**: a small JSON instruction that says which of the store's declared blocks to show, in which variant and order, and with which theme settings. A visit is a **timeline** of slides. The shopper sees changes as discrete, animated steps they can page back through, like a slideshow, not as a page that morphs underneath them.

### 4.1 Schema (sketch; the zod source of truth goes in `babel/schema`)

```ts
type Slide = {
  id: string;
  index: number;                    // position in this visit's timeline
  parentId?: string;
  kind: "initial" | "minor" | "major" | "explicit";
  trigger: "page_load" | "revisit" | "markers" | "chat" | "view_switch" | "agent_handoff";
  template: "home" | "category" | "product";
  persona: Persona;
  theme: {                          // every value is clamped to the store's BrandKit ranges
    density: "airy" | "comfortable" | "compact";
    typeScale: number;              // e.g. 0.95-1.3
    contrast: "normal" | "high";
    radius: number;                 // px
    motion: "full" | "reduced";
  };
  copyRegister: "plain" | "standard" | "technical";   // picks a pre-written catalog field; never generates copy
  blocks: {
    id: BlockId;                    // must exist in the store's registry for this template
    variant: string;                // must be declared for that block
    order: number;
    collapsed?: boolean;
    maxItems?: number;
    fields?: string[];              // subset of catalog spec keys for table-like variants
  }[];
  keep: BlockId[];                  // carried over unchanged from the previous slide / last visit
  rationale: string;                // shopper-facing "why this view", describes the view, never the person
  hypothesis?: {                    // the agent's bet, checked at the next boundary
    marker: MarkerId; expect: "up" | "down"; withinSeconds: number;
  };
  confidence: number;
  source: "rules" | "director" | "concierge" | "explicit" | "cache";
};

type Timeline = { visitorId: string; visitId: string; slides: Slide[]; cursor: number };
```

**What is not in a Slide:** prices, stock, ratings, discounts, delivery dates, product copy. Store components render those from the catalog by product id. The model *cannot* misstate them because it never writes them.

### 4.2 Change budget (enforced in code by `babel/guardrails`, not by the prompt)

| Kind | When it may happen | What it may change |
|---|---|---|
| `initial` | First page load of a visit | Anything, from cache or rules |
| `minor` | During a visit, at a slide boundary | **At most 2 blocks** (variant, order or collapsed), theme moves at most one step, dialect unchanged, `keep` blocks untouched |
| `major` | **Only on a return visit**, as its first slide | Dialect, theme, order and variants, **but** carries over the anchors plus the shopper's **two most-used blocks from last visit** (same variant, same above/below-the-fold position) and the recently-viewed strip |
| `explicit` | The shopper asked (chat or view switcher) | Whatever they asked for, inside brand bounds |

Always fixed (anchors): the header (logo, search, cart), the price inside the buy box, legal/footer links.

Pacing limits for `minor` slides: none while the shopper is scrolling or has the pointer pressed; at least 20 s between slides; at most 5 per visit. If the shopper undoes a slide, that kind of change is blocked for the rest of the visit, and the Director is told.

### 4.3 Slide boundaries (when a new slide can happen)

- Navigation to another page (the natural moment; most changes should land here).
- A marker crosses a threshold ([docs/MARKERS.md](docs/MARKERS.md#3-triggers)) and the shopper has paused (idle ≥ 2 s).
- A chat answer or a view switch.
- Arrival through an agent hand-off link ([§8](#8-agent-gateway-a2a--mcp)).

### 4.4 What the shopper sees

- A short animated transition on the blocks that changed, with a brief highlight.
- A small slide control: `◀ 2 / 3 ▶ · Why? · Standard view`. ◀ goes back to the previous slide. **Standard view** turns personalization off for the visit (this is also our non-profiling option, [GUARDRAILS §2](docs/GUARDRAILS.md#2-legal-checklist)).
- **Why?** shows the `rationale` and the evidence behind it in plain words ("You opened the returns policy twice, so it's now near the top").

## 5. Marketing markers

Markers are live scores (0-1, with evidence) computed **deterministically** from interaction signals. They answer the questions a marketer asks about a session, they drive the Director, and they are what the merchant panel shows. Full definitions, inputs, triggers and forbidden uses: **[docs/MARKERS.md](docs/MARKERS.md)**.

| Marker | The marketing question it answers |
|---|---|
| `purchaseIntent` (+ stage) | How close is this shopper to buying? |
| `priceSensitivity` | Is price driving the decision? |
| `infoAppetite` | How much detail do they want? |
| `jargonComfort` | Do technical words help or push them away? |
| `trustNeed` | Do they need reassurance before buying? |
| `hesitation` | Are they stuck at a decision point? |
| `confusion` | Are they lost (lots of views, nothing opened)? |
| `inspirationAppetite` | Are they browsing for ideas rather than a product? |
| `categoryAffinity` | Which categories pull them? |
| `featureInterest` | Which product attributes do they care about? |
| `interactionFluency` | How at ease are they with this interface (drives dialect)? |
| `abandonmentRisk` | How likely are they to leave without buying? |
| `adaptationAcceptance` | Do they keep or undo Babel's changes? (the agent's own feedback) |

## 6. AI at the centre: the agents

The rules engine only exists so the first paint is instant and so there is a fallback. **Every decision after slide 0 is made by an agent**, and the demo shows its reasoning. DeepSeek is the only runtime LLM ([§10](#10-tech-stack)).

### 6.1 Director: the core loop

Runs at every slide boundary for a live visit.

1. **Observe:** marker snapshot and deltas since the last slide, current persona, current slide, consented partner context, the timeline so far, and the outcome of its last hypothesis (did `hesitation` drop? did the shopper undo?).
2. **Decide:** hold, or propose a slide. It must state a `hypothesis` ("moving returns and warranty up will lower `hesitation` within 30 s").
3. **Act through tools:**
   - `getMarkerEvidence(markerId)`: the events behind a marker.
   - `getRegistry(template)`: the blocks and variants this store allows.
   - `getBrandKit()`: the store's ranges.
   - `getProductFacts(ids, fields)`: catalog facts, to pick which spec fields matter for this shopper.
   - `proposeSlide(slide)`: runs the full validator and returns errors, so the agent **repairs its own proposal** (up to 2 retries).
   - `hold(reason)`: no change this time.
4. **Learn:** at the next boundary the hypothesis is scored and fed back in. Across visits, the Insights agent's summaries ("for `guided` × `reassurance`, moving `trust` up lowered hesitation in 7 of 9 sessions") are added to the Director's context as learned priors.

Limits: 3 tool rounds, 6 s budget, then fall back to "hold". It never sees raw personal data and cannot touch prices, stock or copy.

### 6.2 Concierge: chat to slide (P1)

The shopper asks ("just the basics", "compare the two cheapest with 16 GB", "something for a 6-year-old"). The Concierge calls catalog tools, answers in 1-2 sentences, and produces an `explicit` slide. Explicit preferences are stored and override inference. It must be labelled as an AI assistant.

### 6.3 Insights: the merchant's analyst (P1)

Reads markers and slide outcomes across sessions and writes short, evidence-linked insight cards for the merchant ("Shoppers who open returns twice convert better when `trust` sits above the gallery"). It can **propose** a change to a persona's default slide; a human approves it in the merchant panel.

### 6.4 Synthetic shoppers (P0 scripted, P1 LLM)

- **P0:** scripted ghost shoppers replay the 10 shopper streams ([§3.4](#34-the-10-demo-shoppers)) into the real event pipeline.
- **P1:** DeepSeek role-plays a shopper with a goal and drives the store through the same tools, producing fresh sessions for the merchant panel and for a simple "steps to success per persona" evaluation.

### 6.5 Agent Gateway

The A2A/MCP server in [§8](#8-agent-gateway-a2a--mcp). Structured skill calls need no LLM; free-text A2A messages go through the Concierge.

## 7. Brand bounds

Each store ships two files that Babel treats as law:

```ts
type BrandKit = {
  store: StoreId;
  colors: Record<"primary" | "accent" | "surface" | "text" | "muted", string>;   // fixed, never changed by AI
  fonts: { heading: string; body: string };                                    // fixed
  ranges: {
    typeScale: [number, number];
    radius: [number, number];
    density: Array<"airy" | "comfortable" | "compact">;
    contrast: Array<"normal" | "high">;
  };
  voice: { do: string[]; dont: string[] };   // used by the Concierge and for rationales
  bannedWords: string[];
};

type Registry = Record<Template, Record<BlockId, {
  variants: string[];
  neutral: string;        // the store's default variant
  required?: boolean;     // can be collapsed, never hidden
}>>;
```

The validator **clamps** every theme value to `ranges`, rejects unknown blocks or variants, and logs each clamp ("asked for radius 24, brand max 8"). That log is a demo beat: the AI wanted something off-brand and the brand won.

**Block catalogue (both stores implement the ones they need):** `hero`, `productList`, `filters`, `gallery`, `summary`, `specs`, `trust`, `buyBox`, `compare`, `continuity` (recently viewed, reorder), `assist` (guided chooser, chat prompt). Dialects are presets over these: the same blocks with different variants and theme values, not different pages.

### 7.1 The plug-in boundary

Code in `stores/*` may only import `babel/sdk` (its public API: `BabelProvider`, `BabelBlock`, `useBabel`). `babel/*` never imports from `stores/*`; it receives the registry and brand kit as data. This is how we prove "one integration point": a store wraps each section in `<BabelBlock id="specs" variants={{ table_full: …, table_key: … }} />` and Babel picks the variant. A script-tag DOM adapter for non-React stores is roadmap, and we say so.

## 8. Agent Gateway: A2A + MCP

A buyer agent is one more shopper: the far end of the `dense` dialect. It wants structured facts and proof, no layout.

- **A2A** (primary): Agent Card at `/.well-known/agent-card.json`, JSON-RPC at `/api/a2a`, built on the official JS SDK (`@a2a-js/sdk`).
- **MCP** (same tools, P1): Streamable HTTP at `/api/mcp`, so Claude and ChatGPT-style agents can connect as a remote MCP server. A2A is for agent-to-agent; MCP is how today's assistant products most commonly attach external tools. One tool layer (`babel/tools`) serves both.

| Skill / tool | Input | Output |
|---|---|---|
| `search_products` | query, category, filters, sort, limit ≤ 12 | product facts incl. price from catalog |
| `get_product` | id | full facts, policies |
| `compare_products` | ids ≤ 4 | spec matrix with differences |
| `get_store_policies` | — | returns, warranty, delivery |
| `create_handoff_link` | product ids, note | `/{store}/h/{id}`: the human opens it and sees the shortlist **in their own dialect** |

Rules: same prices and promotions as humans, Babel **never negotiates**, read-only, rate-limited, no personal data in or out, incoming text treated as untrusted ([GUARDRAILS](docs/GUARDRAILS.md)).

Demo client: `scripts/buyer-agent.ts`, a DeepSeek-driven buyer agent that shops over A2A and prints its log next to the store.

## 9. Demo stores and catalog

Two fictional stores, **inspired by** real ones but with their own names, colours, logos and copy. No real logos, no images hotlinked from brand sites, no real product brand names.

| Store | Inspired by | Brand feel | Priority |
|---|---|---|---|
| **Taraba** (Romanian for "market stall") | eMAG, Amazon: a general marketplace | Friendly and bright, rounded, busy home page | **P0** |
| **Croiala** (Romanian for "the cut of a garment") | Zalando, About You: fashion | Monochrome, editorial, serif headings, sharp corners | P1: proves the same Babel stays on-brand in a very different store |

Check both names for clashes before the pitch.

**Catalog** (`data/catalog.json`, synthetic, generated once and committed): about 60 products across **electronics, fashion, home & furniture, groceries, toys, health & beauty (non-prescription)**, with fictional brands and prices in RON. Every product has:

- facts: `price`, `stock`, `rating`, `reviewCount`, `specs` (category-specific keys), `policies` (`returnDays`, `warrantyMonths`, `deliveryDays`);
- pre-written copy in **three registers**: `copy.plain`, `copy.standard`, `copy.technical`, plus `benefits[]` and a `reviewSummary {pros, cons}`. Babel switches register; it never writes product copy;
- optional `promotion` from a store-wide table: the same for every shopper, with a real end date if any;
- images: generated or CC0, stored locally with their licence noted.

A thin catalog makes every persona look the same and kills the demo, so the catalog is worth real time.

## 10. Tech stack

| Layer | Choice |
|---|---|
| App | Next.js (App Router) + TypeScript, one app: both stores, merchant panel, all APIs |
| UI | Tailwind, Framer Motion (`layout` animations for slide transitions) |
| Schemas | zod, with JSON Schema generated for prompts |
| LLM | **DeepSeek API** via the `openai` SDK, `baseURL` from env, model from `DEEPSEEK_MODEL` (check `api-docs.deepseek.com` on the day). JSON output and tool calling. Static prompt parts first, for DeepSeek's automatic prefix caching |
| Agents | Plain TypeScript loops, one file per agent |
| Agent protocols | `@a2a-js/sdk`; `@modelcontextprotocol/sdk` (P1) |
| State | In memory + JSON files; visitor timeline also in `localStorage` (consented) |
| Node | 22 |

## 11. Architecture

```
┌────────────────────────── Store page (Taraba / Croiala) ───────────────────────┐
│  store components ── <BabelBlock> ──┐                                          │
│                                     ▼                                          │
│  babel/sdk: signals ─► events   SlidePlayer ◄── slide    Why? · ◀ ▶ · Standard │
└───────────┬─────────────────────────────▲──────────────────────────────────────┘
            │ POST /api/events            │ GET/POST /api/slide
            ▼                             │
┌──────────────────────────────── Server ────────────────────────────────────────┐
│  babel/markers (pure) ─► marker snapshot ─► trigger? ─► Director agent         │
│                                                 │  tools: evidence, registry,  │
│                                                 │  brand kit, facts, propose   │
│                                                 ▼                              │
│                                guardrails: zod → registry → brand clamp →      │
│                                change budget → policy ─► slide (or fallback)   │
│  Concierge (chat) ─┘          Insights agent ─► merchant panel /merchant       │
│  Agent Gateway: /api/a2a, /api/mcp ─► babel/tools ─► data/catalog.json         │
│  babel/llm (only DeepSeek caller, records usage for the cost meter)            │
└────────────────────────────────────────────────────────────────────────────────┘
```

## 12. Repo layout

```
app/
  [store]/                 store routes: page.tsx (home), c/[category], p/[id], h/[handoff]
  merchant/                markers panel, Director trace, insights, cost meter
  api/events  api/slide  api/chat  api/a2a  api/mcp
  .well-known/agent-card.json/route.ts
stores/
  taraba/                  brand-kit.json, registry.ts, blocks/ (one file per block, all variants)
  croiala/
babel/
  schema/                  zod: Slide, Timeline, Persona, Markers, Events, PartnerContext, BrandKit, Registry, Product
  sdk/                     BabelProvider, BabelBlock, SlidePlayer, WhyPanel, ViewSwitch, signals.ts
  markers/                 pure functions: events → markers (+ evidence, triggers)
  persona/                 rules for slide 0 and fallback
  agents/                  director.ts, concierge.ts, insights.ts, shopper-sim.ts
  llm/                     DeepSeek client, record/replay for the demo, usage → cost
  guardrails/              validateSlide (schema, registry, clamp, budget, policy), inputGuard
  tools/                   catalog tools shared by agents, A2A and MCP
prompts/                   director.md, concierge.md, insights.md, shopper-sim.md (versioned)
data/                      catalog.json, shoppers/*.json, sessions/, slide-cache/
scripts/                   gen-catalog, build-slide-cache, ghost-shopper, buyer-agent, eval
docs/                      DECISIONS, TASKS, MARKERS, GUARDRAILS, DEMO, DEMOQUESTIONS, JUDGING-CRITERIA
planning-phase/            history: everyone's planning work, read-only
```

## 13. Scope

**P0: the demo does not exist without these**
- Schema in `babel/schema`; catalog (~60 products, 6 categories); 10 shopper fixtures.
- Taraba: home, category and product pages built from `BabelBlock`s, with the variants the 4 dialects need.
- `babel/sdk` SlidePlayer with animated transitions, slide control (◀ ▶, Why?, Standard view), undo.
- Markers engine and event pipeline; scripted ghost shoppers.
- Director agent on DeepSeek with tools, validator with repair loop, rules fallback, slide cache for slide 0.
- Return visit → `major` slide with carry-over.
- Merchant panel: live markers, Director trace (observed → hypothesis → slide → result).
- A2A Agent Card + `search_products`, `compare_products`, `create_handoff_link`; `scripts/buyer-agent.ts`.
- Guardrails: schema, registry, brand clamp, change budget, policy. Red-team fixtures pass.

**P1: makes it impressive**
- Croiala store (second brand kit) with the clamp log on screen.
- Concierge chat → explicit slides.
- MCP endpoint over the same tools, connected from a real assistant.
- Insights agent cards + approve-a-default flow.
- LLM synthetic shoppers.
- Cost meter fed by real DeepSeek usage ([§14](#14-cost)).

**P2: stretch**
- Steps-to-success evaluation per persona with synthetic shoppers.
- Script-tag DOM adapter for non-React stores.

## 14. Cost

**TODO, deliberately.** Before the pitch:
1. Log real `usage` from every DeepSeek call (prompt cache hit vs miss tokens, output tokens) in `babel/llm`.
2. Take the price per token from DeepSeek's own pricing page on the day (not third-party blogs).
3. Measure: cost per Director decision, per chat turn, per A2A free-text request, per 1,000 visits (most visits are served from the slide cache).
4. Show a live cost meter in the merchant panel during the demo, and put the per-1,000-visits figure on the cost-vs-value slide.
