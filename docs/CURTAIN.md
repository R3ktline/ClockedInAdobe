# Curtain mode (prototype)

Branch `d/calibration-curtain`, built from `main` at `32f86ec`. **Prototype, not reviewed by the other tracks.**

## What it is

While Babel works out who the shopper is, the page does not move. When the signal model is confident that a different format would serve them, the store shows a **glass curtain** (the page behind stays visible but blurred, with a short message), swaps the whole page, and lifts the glass. The same curtain plays when the shopper asks for something in the chat. A shopper Babel has already profiled gets their page from the first paint, with no curtain.

Turn it on per tab with `?curtain=1` (it sticks for the tab; `?curtain=0` turns it off). Off by default, and never in `/lab`. Everything else behaves as before.

## The three moments

| Moment | Trigger | Who decides | LLM? |
|---|---|---|---|
| **Profile clear** | `/api/events` returns `restyle: true` once the read is confident and different from the page; the client plays the curtain at a safe moment and calls `/api/restyle` | `babel/session/calibration.ts` | No. Rules build the slide from the signal model's read, so the curtain always lifts on a finished page |
| **Shopper asks in chat** | the chat box | the Director, as kind `explicit` (no change budget; may change the dialect and many blocks) | Yes (mock offline) |
| **Shopper comes back** | `/api/visit` restores the remembered profile as slide 0; the client holds a glass pane with no card until it arrives, so the neutral page never flashes | memory | No |

## Rules that make it rare

- First big change: needs 6 s on the page, 4 meaningful actions and confidence ≥ 0.55.
- A later one needs confidence ≥ 0.65, a 45 s pause and at most 3 per visit.
- A format the shopper stepped back from (◀) is never proposed again this visit.
- What the shopper asked for in chat wins over our own read for the rest of the visit (ADR-003).
- Not while typing, scrolling, or on the buy box. Standard view switches it all off.
- A zoom is still answered at once, as before: the shopper asked for it.
- Tunable: `BABEL_CAL_MIN_MS`, `BABEL_CAL_MIN_EVIDENCE`, `BABEL_CAL_COOLDOWN_MS`, `BABEL_CAL_MAX_RESTYLES`. All `[ASSUMPTION]`.

## Files, by owner

New: `babel/session/calibration.ts` (+ test), `app/api/restyle/route.ts`, `babel/sdk/Curtain.tsx`.

| Track | File | Change |
|---|---|---|
| A (schema, guardrails, session) | `babel/schema/index.ts` | `Slide.trigger` gains `"calibration"` |
| A | `babel/guardrails/validateSlide.ts` | a major slide with trigger `calibration` is allowed without a return visit (it also has no block cap) |
| A | `babel/session/index.ts` | per-visit curtain state; no live Director triggers in curtain mode except zoom |
| B (SDK, styles) | `babel/sdk/BabelProvider.tsx`, `app/globals.css` | curtain state machine, safe-moment check, chat through the curtain |
| C (agents, prompts) | `babel/agents/director.ts`, `prompts/director.md` (v11) | `big` option for chat; offline stand-in for typed requests |
| C | `app/api/visit`, `app/api/slide`, `app/api/events` | `curtain` flag; `restyle` in the events reply; chat pinned as explicit |

Rule 9 in `AGENTS.md` says major slides only happen on a return visit. This prototype adds the calibration case, so it **needs a new entry in `docs/DECISIONS.md`** (Track A) before merging.

## Known limits

- Tested only with the mock LLM. The chat path with a live model, and prompt v11, are untried.
- The first big change is limited by what Taraba's registry offers (5 product blocks, 2 to 3 variants each). A shopper whose read is only a need (Radu) sees blocks move; one whose dialect is confident (Tudor, Gheorghe) sees a different look.
- A remembered shopper's page can be one frame late before the glass appears.
- Thresholds are guesses; tune them on real runs.

## Understanding typed requests (added after the first chat test went wrong)

The first chat test ("make my photos smaller and sort the products by reviews") made the photos bigger and dropped the
star ratings. Cause: no API key, so the offline keyword stand-in answered; it matched "photos" and chose the image-first
look. On the home and category pages that look switches the product list to a mosaic with no star rating, and nothing
there can resize photos or sort. Four changes so a real model is not set up to fail the same way:

1. **Every variant is described in plain words** (`BlockSpec.describe`, `BlockSpec.cannot`, filled in for Taraba in
   `stores/taraba/registry.ts`), including what it leaves out ("no star rating") and what a block can never do ("sort the
   products"). The Director sees it in REGISTRY. Anything not described cannot be done.
2. **Interpret first.** A typed request is split into wishes (`understood`: do / already / cannot, with the block and
   variant that make each true). Prompt `director.md` v12 explains it and what each lever (dialect, need, theme) does.
3. **Check, then reply.** `babel/agents/understanding.ts` holds that list against the slide: a "do" the slide does not do,
   an "already" that is not so, or a block changed that nobody asked for is sent back to the model as an error to repair.
   The reply the shopper reads is built from the checked list ("Done: … Already so: … Can't do: …"), never from the
   model's free text. If no checked answer is reached, the shopper is told so and the page stays as it is.
4. **A request test set**: `babel/agents/requests.eval.ts` (28 cases: opposites, impossible asks, unsafe asks, indirect
   wording, Romanian, home/category pages) and `requests.eval.test.ts`.

Run against a live model (no assertions; prints a pass rate and writes `.babel/eval-requests.json`):

    BABEL_EVAL=live BABEL_DIRECTOR_BUDGET_MS=30000 DEEPSEEK_API_KEY=... DEEPSEEK_MODEL=... npx vitest run babel/agents/requests.eval.test.ts --silent=false

The offline stand-in passes the 17 cases marked `mock: true` and fails the 11 that need real understanding (for example it
reads "the picture is tiny" as a request for smaller photos). A live model is expected to beat it; that is the point of the set.

The cases and what counts as right are `[ASSUMPTION]`s written before any live run. `Understood.sets` allows up to 12 entries.
