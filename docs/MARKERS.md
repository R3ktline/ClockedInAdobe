# Marketing markers

Markers are what Babel knows about a **session**, expressed as the questions a marketer asks. They are computed **deterministically** in `babel/markers` (pure functions, unit-tested), never by the LLM. The Director agent reads them, the merchant panel shows them, and the shopper's **Why?** panel quotes their evidence.

Owner: Track D. Schema: `babel/schema` (Track A). Shopper data in the demo is **synthetic**; every number derived from it is labelled "simulated" wherever it's shown.

---

## 1. Interaction signals (inputs)

Collected by `babel/sdk/signals.ts` on store pages, or replayed by ghost shoppers. **Interaction signals**, never "biometrics": nothing here identifies a person.

```ts
type InteractionEvent = {
  t: number;                 // ms since visit start
  type: EventType;
  blockId?: BlockId;
  productId?: string;
  value?: string | number;   // query text, facet, sort key, velocity bucket…
};
```

| Group | Event types |
|---|---|
| Navigation | `page_view`, `back_nav`, `product_click`, `category_click` |
| Attention | `block_view` (≥ 1 s in viewport), `block_dwell` (ms), `block_open` (expand/tab), `scroll` (velocity bucket: slow / normal / fast), `idle` (≥ 5 s) |
| Search & filter | `search` (query text), `filter` (facet, value), `sort` (key) |
| Product | `gallery_swipe`, `image_zoom`, `hover_price`, `review_open`, `policy_open` (returns / warranty / delivery), `compare_add`, `size_guide_open` |
| Commerce | `add_to_cart`, `remove_from_cart`, `checkout_start`, `reorder_click` |
| Friction | `rage_click` (≥ 3 clicks < 1 s same spot), `dead_click` (click on non-interactive), `mis_tap` (tap just outside a target, then a correction), `page_zoom` (browser or pinch zoom, relative to page load) |
| Babel | `slide_shown`, `slide_undo`, `slide_prev`, `slide_next`, `why_open`, `view_switch`, `chat_message` |
| Context (once) | from `PartnerContext.device`: pointer type, OS zoom, `prefers-reduced-motion`, `prefers-contrast`, viewport |

**Search vocabulary** is the single strongest signal: "laptop with good battery" vs "16GB DDR5 thin-and-light" classifies `jargonComfort` and `infoAppetite` in one query. `babel/markers` uses a small keyword/acronym list per category for this; no LLM.

## 2. The markers

All markers are `{ value: 0-1, trend: "up" | "flat" | "down", evidence: EventRef[] }`. Transient markers decay with a half-life (they fade if the behaviour stops); session markers accumulate.

| ID | Question | Main inputs (+ raises, − lowers) | Decay | What the Director may do when high | Merchant KPI it links to |
|---|---|---|---|---|---|
| `purchaseIntent` (+ `stage`: browsing / researching / comparing / deciding) | How close are they to buying? | + `add_to_cart`, repeat views of one product, `policy_open` (delivery), `compare_add`, `checkout_start`; − `remove_from_cart` | session | `deciding` → `quick` need: prominent buy box, collapse the rest | add-to-cart rate, checkout starts |
| `priceSensitivity` | Is price driving the decision? | + `sort` by price, price `filter`, `hover_price`, views of cheaper alternatives, promotion clicks | session | `deals` need: price sort, real promotions, price per unit, cheaper alternatives | AOV vs category average |
| `infoAppetite` | How much detail do they want? | + `block_open` on specs, long `block_dwell` on tables, `compare_add`; − many views with zero opens | session | `specs` need: tables, compare matrix | spec-to-cart conversion |
| `jargonComfort` | Do technical words help them? | + acronyms/units in search, technical filters; − conversational queries, `why_open` on specs | session | sets `copyRegister` (plain / standard / technical) | — |
| `trustNeed` | Do they need reassurance? | + `review_open`, `policy_open` (returns, warranty), seller-info views; repeat visits without buying | session | `reassurance` need: returns/warranty/delivery up, review summaries, **promo badges removed** | returns-page-to-cart rate |
| `hesitation` | Are they stuck at a decision point? | + long `idle` near the buy box, add-then-remove, back-and-forth between 2 products, `hover_price` with no click | 30 s half-life | reassurance or compare block, guided chooser, offer chat | time-to-decision |
| `confusion` | Are they lost? | + many `page_view`s with zero `block_open`, high `back_nav`, search refinements with no click, `dead_click`, `rage_click` | 30 s | simpler dialect step, `assist` guided chooser, fewer items | bounce, search exits |
| `inspirationAppetite` | Browsing for ideas, not a product? | + fast `scroll`, `gallery_swipe`, `image_zoom`, category hopping, social referrer | session | `inspiration` need, `visual` dialect | engagement depth |
| `categoryAffinity` | Which categories pull them? | vector over categories: views, dwell, cart | session | order `productList` and `continuity` | category conversion |
| `featureInterest` | Which attributes matter? | vector over spec keys: opened rows, filters, search terms ("battery", "waterproof") | session | choose `fields` for `specs` and `compare` | — |
| `interactionFluency` | How at ease are they with this UI? | − `mis_tap`, OS zoom, coarse pointer with long hovers, `dead_click`; + keyboard use, filter combos, fast precise navigation | session | picks the **dialect** (`guided` ← low, `dense` ← high) | task completion time |
| `abandonmentRisk` | Will they leave without buying? | composite: `hesitation`, `confusion`, falling intent, long `idle`, cursor to tab bar (desktop) | 60 s | fix the cause (the marker behind it), never pressure | cart abandonment |
| `adaptationAcceptance` | Do they keep Babel's changes? | − `slide_undo`, `slide_prev`, `view_switch` to standard; + interaction with changed blocks | session | low → adapt less; this is the agent's own feedback | undo rate |

Weights and thresholds start as hand-tuned constants in `babel/markers/weights.ts` and are tuned on the 10 shopper fixtures.

### The trap to handle explicitly

**Volume is not interest.** Seven product views in four minutes with zero block opens and a high back rate is `confusion`, not research. Handing that shopper a denser page is the worst possible move. A unit test must cover this case (David's Elena fixture).

## 3. Triggers

A trigger asks the Director for a new slide at the next pause (see [SPEC §4.3](../SPEC.md#43-slide-boundaries-when-a-new-slide-can-happen)):

- `hesitation`, `confusion` or `trustNeed` crosses **0.6** upward;
- `purchaseIntent.stage` changes;
- the top need changes and holds for ≥ 10 s;
- the last slide's hypothesis window expired (score it either way);
- the shopper **zooms in** by 10% or more: an immediate trigger that skips the 20 s pause (still capped at 5 slides). Zoom is read as "the text is hard to read here", never as a trait of the person;
- a **check-in**: 15 s and at least 3 new events since the agent last looked.

Triggers are debounced (≥ 20 s between slides) and respect the change budget.

## 4. What markers may never do

Enforced in `babel/guardrails/policy.ts`, restated in every prompt. Details in [GUARDRAILS](GUARDRAILS.md).

- **High `hesitation` or `abandonmentRisk` never triggers urgency, scarcity, countdowns, or a discount.** The answer to hesitation is information (returns, compare, a guided chooser), not pressure.
- **No marker changes a price** or reveals a promotion that other shoppers don't get.
- `priceSensitivity` may surface **cheaper products and existing store-wide promotions**. It may not hide cheaper options from low-sensitivity shoppers.
- Markers are never shown to the shopper as labels ("you seem confused"). The **Why?** panel quotes behaviour ("you opened the returns policy twice"), not traits.
- No marker for vulnerability, health, age, or finances.

## 5. Merchant panel (`/merchant`)

| Area | Shows |
|---|---|
| Live sessions | One row per visit: persona, the 13 markers as small bars with trend, current slide index |
| Director trace | Per slide: observed (markers + evidence) → hypothesis → slide diff → result (hypothesis met? undone?) |
| Personas | Per persona: sessions, simulated add-to-cart rate, time-to-first-action, undo rate, slides per visit, **vs. a "Standard view" holdout** |
| Insights (P1) | Insights agent cards with evidence links and an **Approve as default** button |
| Cost meter (P1) | DeepSeek tokens (cache hit / miss / output) and cost so far ([SPEC §14](../SPEC.md#14-cost)) |

Every simulated number carries a "simulated" tag. A fabricated lift figure caught by a judge is fatal; a clearly labelled simulation with a real measurement plan (holdout vs. Babel per persona) is not.
