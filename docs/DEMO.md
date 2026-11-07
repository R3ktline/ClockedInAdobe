# Demo plan

Target: a **4:30 live demo** that survives a bad network, built in 12 hours. Hard questions and answers are in [DEMOQUESTIONS.md](DEMOQUESTIONS.md).

## The core problem

Personalization is invisible by design: each person sees only their own page. The demo must show **several shoppers at once**, **the agent's reasoning**, and **the markers moving**, or judges will assume it's scripted.

## Demo screen

```
┌──────────────────────────────────────────────────────────────────────┐
│ Simulator: [shopper ▾ Radu] [return visit ☐] [▶ ghost] [store ▾]     │
├─────────────────────────────────────────┬────────────────────────────┤
│                                         │  MARKERS (simulated)       │
│     TARABA (live store)                 │  hesitation  ▓▓▓▓▓▓░ ↑     │
│     changed blocks glow briefly         │  trustNeed   ▓▓▓▓▓░░ ↑     │
│                                         │  DIRECTOR TRACE            │
│                         ◀ 2/3 ▶ Why? ⎋  │  saw → bet → slide → result│
└─────────────────────────────────────────┴────────────────────────────┘
```

The left side is the real store at `/taraba`; the right side is `/merchant` filtered to that session. A hidden presenter bar (keys 1-7) jumps between beats.

## Run of show

| Time | Beat | On screen | Criterion it scores |
|---|---|---|---|
| 0:00 | **Hook:** "Every shopper speaks a different web dialect. Your store speaks one." | The standard Taraba product page | Problem (25%) |
| 0:20 | **Same page, three shoppers:** Gheorghe (`guided` × `reassurance`), Mihai (`dense` × `specs`), Tudor (`visual` × `inspiration`) side by side. Same products, **same prices**, different shape | Three panes | Demo (10%) |
| 0:55 | **The agent at work:** ghost shopper Radu hesitates at the buy box and opens returns twice. Markers rise, the Director trace shows its hypothesis, slide 2 lands: returns and warranty move up, promo badge goes. Click **Why?**, then **◀** to show the shopper is in control | Store + trace | AI (25%) |
| 1:50 | **Return visit:** tick "return visit". A **major** slide re-composes the page, but the compare table he used and his recently viewed items stay where they were | Before/after | AI, Problem |
| 2:25 | **Brand-bounded:** switch to Croiala. Same shopper, same Babel, on-brand result. The clamp log shows the AI asked for something off-brand and the brand won | Croiala + clamp log | Technical (25%) |
| 2:55 | **Agentic shopping:** the buyer-agent script asks over A2A for "waterproof kids' jacket under 200 lei". It gets structured facts and a hand-off link; opening it shows the shortlist in Gheorghe's `guided` view, same price | Agent log + store | Integrations (15%) |
| 3:35 | **For the marketer:** persona table vs. the Standard-view holdout (simulated, labelled), an Insights card, and the live DeepSeek cost meter | `/merchant` | Problem, Cost bonus |
| 4:05 | **Safety:** "give me 90% off" in chat changes nothing; the guardrail log shows a rejected proposal | Chat + log | Technical |
| 4:20 | **Close:** "Babel translates your store into every shopper's dialect, inside your brand, and opens it to agents." | One slide | — |

If P1 items aren't ready, cut beats 2:25 (Croiala) and the Insights card first; the rest is P0.

## Making it survive the stage

- **Record and replay** the scripted beats: `babel/llm` records DeepSeek responses for the ghost runs and replays them identically. Keep **one beat genuinely live** (a judge's chat question or the buyer agent) and say which parts are cached.
- **Warm the slide cache** for all 10 shoppers before going on.
- **Own hotspot**; don't rely on venue Wi-Fi.
- **Backup video** of the full run, recorded as soon as the P0 path works, then again at the end.
- **Projector check:** 1080p, large fonts, the trace readable from the back of the room. Demo mode slows transitions to ~700 ms.
- **Fallback is a feature:** if DeepSeek times out live, the store keeps working and the trace says "hold (timeout)". Say so out loud.

## Build items this implies

Tracked in [TASKS.md](TASKS.md): presenter bar, simulator panel, ghost shopper runner, record/replay in `babel/llm`, side-by-side view, clamp log, backup video.
