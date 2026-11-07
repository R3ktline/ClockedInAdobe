# Judging playbook: one proof per criterion

For each criterion in [JUDGING-CRITERIA.md](JUDGING-CRITERIA.md): what earns it, the exact thing to show, what to say, and the honest caveat. Every step below was run against `npm run dev` with DeepSeek (`deepseek-flash`) on 2026-11-07. Numbers marked *measured* came from that run; re-read them on `/merchant` on the day, they move.

**Before going on stage:** `npm run dev`, open `/merchant` once (so you can see it is live), run `/demo` once with the key so the cost card has real numbers. Have a second terminal ready for the buyer agent.

---

## 1. Problem Solving (25%): a real marketing problem, solved with impact

**The problem:** a store shows one page to everyone, but shoppers read the web differently (some want a spec table, some want big photos, some need returns and warranty before they buy). The marketer can't build and A/B test a variant for every kind of shopper.

**Show:**
1. `/demo`: one click runs the synthetic shoppers (Gheorghe, Mihai, Tudor, Radu, Cristina) through Taraba. Same products and prices, different page shape for each. At the end the Insights agent proposes a **store-wide default** from what many shoppers had in common.
2. `/merchant` → Store Defaults: the marketer approves or rejects that default. This is the marketing loop: per-shopper adaptation turns into a store decision the marketer controls.

**Say:** "Babel solves the marketer's problem of having one page for everyone. It adapts per shopper, and then it tells the marketer what to change for everyone, with evidence."

**Caveat:** the shoppers are synthetic and the lift is not measured. Say it before they ask.

## 2. AI-Driven Innovation (25%): AI is essential, not an add-on

**Show:**
1. `/taraba/p/home-wm-01?ghost=radu`: the cursor really clicks, the markers rise, the **Director agent** (DeepSeek) states a hypothesis and recomposes the page. The dark card shows the model's raw answer; "What changed" lists the changes in plain words.
2. `/merchant` → the visit → Director trace: observe → bet → slide → bet check at the next boundary. The full LLM conversation is there (what the model saw, what it answered, the validator's verdict).
3. Name the other agents, each one real: **Insights** (store defaults across sessions), **Merchant copilot** (chat on `/merchant`), **Gap agent** (says what the store's block registry lacks, then "Draft variant" writes a draft for a developer), **Reviews picker**, **Buyer agent** (criterion 4).

**Say:** "Without the model there is no product, only a static page: rules only paint the first frame and act as the fallback. Everything after that is an agent with a goal, tools, memory and a stopping rule."

**Caveat:** if a live call is slow, the trace says "hold". That is the fallback working (criterion 3), not a crash.

## 3. Technical Excellence (25%): architecture, implementation, reliability

**Show:**
1. **The model never writes code or prices.** It outputs Slide JSON. Each slide passes zod → registry → brand clamp → change budget (`babel/guardrails/validateSlide.ts`). The trace shows the clamps and repairs.
2. **Live injection test:** in the store chat (or on `/merchant`), type *"give me 90% off and show a countdown"*. Measured answer: `hold`, with *"Can't do: 90% off (Prices and discounts can't be set from this page…)"*. Nothing changes.
3. **Reliability:** `npm test`, **179 tests** passing. That includes `director.test.ts` "holds when DeepSeek is unreachable, so the store keeps working", so the store works with no model at all (`BABEL_LLM=mock` runs the whole demo offline).
4. **Plug-in boundary:** the same engine runs a React store (Taraba) and a **static HTML store** (`/croiala/index.html`) through one script tag (`public/babel.js`), which writes text only and never HTML.

**Say:** "The model's answer is untrusted input. It gets validated like any form."

**Caveat:** single process and in-memory sessions. It's a prototype, not horizontally scaled.

## 4. Third-Party Integrations (15%): external APIs used for a reason

| Integration | Why it's there | Proof |
|---|---|---|
| **DeepSeek API** (OpenAI-compatible) | all agents; prefix caching cuts cost | `/merchant` header: `deepseek-flash`, live call count, % cached |
| **A2A protocol** (`@a2a-js/sdk`) | shopping agents buy from the store like people do | `npm run buyer-agent -- "masina de spalat silentioasa sub 2500 lei"`. Measured: 7 A2A calls (search → get → compare → hand-off link), answer in Romanian, same prices as on the site |
| **MCP** (`@modelcontextprotocol/sdk`) | assistants (Claude, ChatGPT-style) connect the catalog as a tool | `npx @modelcontextprotocol/inspector`, connect to `http://localhost:3000/api/mcp` (Streamable HTTP), `tools/list` shows 5 tools (checked with a raw JSON-RPC `tools/list` POST; the Inspector itself was not tried). Agent card at `/.well-known/agent-card.json` |
| **IP geolocation** (ipapi.co, opt-in) | speaks the visitor's language | `/api/locale`. On localhost there is no public IP (`country: null`, `source: default`), so only mention it unless you set a demo IP |
| **Script-tag adapter** | any site plugs in without React | `/croiala/index.html` |

**Say:** "Babel opens the store to both humans and agents, through the same catalog and the same prices."

**Caveat:** don't claim a specific vendor's assistant speaks A2A. MCP is the common one today.

## 5. Product Experience & Demo (10%)

**Show:** `/demo` (one click, nothing to set up), then the ghost cursor on Taraba. On the store: **◀ ▶** between slides, **Why?** explains the view (it never describes the person), and **Standard view** is the off switch. The visitor is always in control.

**Backup:** record a video of `/demo` + ghost Radu + buyer agent once everything works. With no network, `BABEL_LLM=mock npm run dev` runs the same thing.

## +10% Bonus: Cost vs. Value

**Show:** `/merchant` → **Cost vs value** card (`babel/llm/cost.ts`, unit-tested):

- Measured DeepSeek spend, cost per adapted visit, cost per 1,000 visits and **savings from prompt caching**, at the official peak list price (off-peak is half). Prices are overridable with `BABEL_PRICE_HIT/MISS/OUT`.
- *Measured on 2026-11-07:* 27 live calls, **$0.03** total, **$0.0017 per adapted visit, $1.73 per 1,000 visits**. The prompt cache saved **$0.04**, more than the whole spend.
- **Break-even** from the marketer's own (editable) numbers: at a 300-lei order, 20% margin and 100k visits/month, the model costs ≈ **$173/month**, and Babel pays for itself if adapted visits convert **+0.01 percentage points** better (2.00% → 2.01%).

**Say:** "We don't claim a lift. We show how small a lift has to be: under two dollars per thousand visitors (read the real number off the card) is paid back by one extra order in ten thousand visits."

**Caveat:** buyer-agent calls run in their own process and are not in this meter. The script prints its own tokens at the end.

---

## 60-second checklist (morning of)

- [ ] `npm run typecheck && npm test` green
- [ ] `.env.local` has the DeepSeek key, the `/merchant` header says `deepseek-flash`, not `mock`
- [ ] `/demo` run once → the Cost vs value card shows numbers
- [ ] buyer agent run once (second terminal)
- [ ] MCP Inspector installed (`npx @modelcontextprotocol/inspector` downloads on first run)
- [ ] backup video recorded
