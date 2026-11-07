# 01 — Feasibility analysis

Author: Claude. Date: 2026-11-07. Status: opinion, open to challenge.

## Verdict

**The demo is very buildable. The product has three genuinely hard problems, none of
which are blockers, and all of which have known mitigations.** The project is a good
hackathon choice *provided* two conditions hold, both of which are architectural
decisions you make up front and cannot retrofit:

1. The LLM must not generate UI at request time. It emits a config. (See ADR-001.)
2. The segmentation must be expertise/intent-based, not demographic. (See `00-concept.md`.)

Get those two right and this is a strong project. Get them wrong and it becomes a slow,
unsafe demo that falls apart under one question from a judge.

## What is easy

- **The visual payoff.** Same product page, three visitors, three genuinely different
  pages. This is a 10-second demo that lands instantly. Few hackathon projects have a
  money shot this clean.
- **The chat → re-layout loop.** Sounds like the hard part. It isn't. The model emits a
  JSON patch against a config; React re-renders. ~1.5s end to end. Cheap and reliable.
- **Explainability.** Because the config is small and declarative, you can show the
  user *exactly* why their page looks like it does. Most AI products cannot do this.
  It is nearly free here and it is worth a lot in Q&A.

## What is genuinely hard

### 1. Latency (hard, solved)
An LLM in the critical path of page render is 1–8s. Unacceptable; nobody waits.

**Mitigation:** three layers. (a) Server-render a neutral canonical page immediately —
never block first paint. (b) Apply the adaptation on hydration, so the page visibly
"settles in" (which reads as magic rather than lag). (c) Cache aggressively: the cache
key is a *profile fingerprint* + page template, not a user id, so similar users share
cache entries. In steady state the great majority of page loads make zero LLM calls.

### 2. Privacy and automated decision-making (hard, and actually an opportunity)
"Extract the user's data and change what they see" is, in regulatory terms, profiling
plus automated decision-making. GDPR Art. 13/22 and the EU AI Act transparency
obligations both bite. Phrased carelessly, the whole concept sounds like surveillance.

**Mitigation, and this is the interesting part:** invert it. The profile is *the user's*.
They can read it in plain language, edit it, export it, reset it, and switch the whole
thing off. Every adapted page carries an "adapted for you — why?" affordance that shows
the actual reasoning. The chat interface is the editing surface.

This turns the biggest liability into the main differentiator. Every incumbent in this
space profiles users invisibly. "Personalization you can see and argue with" is a real
position, not a fig leaf. **Build the profile viewer. Do not cut it.**

### 3. Merchant adoption cost (hard, unsolved, and the real business risk)
Why would a site integrate this? Every page template needs to declare its blocks and
the variants each block supports. That is real engineering work on the merchant's side,
and merchants are rightly paranoid about anything touching their product pages.

**Mitigation for the hackathon:** make integration look trivial — one script tag plus a
declarative schema file — and show the schema on a slide. **Honest caveat:** we will not
have proven this on a real third-party site, and you should say so rather than imply
otherwise. Frame it as "designed for progressive adoption: block-level opt-in, neutral
fallback if a block is undeclared."

## Lesser problems worth knowing

- **SEO / CDN caching.** Personalized DOM breaks shared caching and confuses crawlers.
  Solved by the same canonical-SSR-then-adapt approach as latency. Worth one slide; a
  technical judge may well ask.
- **Brand and legal safety.** No merchant will accept a model rewriting product copy —
  think regulated categories, warranty claims, pricing. Hence the "never fabricate
  product facts" rule: we filter, order, and set verbosity over the merchant's own
  catalog data. We never author claims.
- **Cold start.** First-ever visitor has no profile. Render neutral, adapt within the
  session from behavior. This is fine and normal; don't over-engineer it.
- **Disorientation.** A page that rearranges itself can feel broken. Needs animated
  transitions, a visible badge, and an undo. This is a UX problem, not a tech one, and
  it is the one most likely to make the demo feel bad rather than good.
- **Proving it works.** Real validation is an A/B test measuring conversion lift, which
  is impossible in a hackathon. Design the metric, build the dashboard, and **label the
  numbers as simulated.** Fabricating a conversion-lift figure and getting caught is
  fatal; showing a well-designed measurement plan with honest placeholder data is not.

## Where this sits against existing products

Adobe Target, Optimizely, and Dynamic Yield all do segment-and-rule personalization: a
marketer hand-authors variants, visitors get bucketed. The ceiling is the marketer's
patience.

Our difference is twofold and both halves matter:
- **Generative instead of authored** — adaptation is synthesized per visitor rather than
  picked from a short list of hand-built variants.
- **Conversational and inspectable** — the visitor is a participant in their own
  personalization, not a target of it. This is the half nobody ships, and it is the
  defensible one.

If asked "isn't this just Adobe Target with an LLM?", the answer is: Target changes what
the *marketer* decided for a *segment*; we change what the *visitor* needs, and the
visitor can correct us.

## My honest reservations

1. **Scope is the real enemy, not difficulty.** Nothing here is technically out of reach.
   Everything here is easy to half-build. The failure mode is five components at 60%
   and no working demo. Build the vertical slice first: one page template, three blocks,
   one working chat instruction, end to end. Then widen.
2. **"ChatGPT wrapper" is the critique to pre-empt.** The config/registry architecture,
   the explainability surface, and the measurement plan are what distinguish this from a
   re-skin. They are also the parts most tempting to skip. Don't.
3. **The original age-based example is a liability.** It is the weakest sentence in the
   pitch and the first thing a sharp judge will push on. Reframing on expertise and
   intent costs nothing and is strictly more accurate.
4. **One-of-one personalization may be worse than segments at small scale.** With little
   data, inference is noisy, and a confidently wrong layout is more annoying than a
   neutral one. Hence: default to neutral, adapt only above a confidence threshold, and
   let explicit user instructions always override inference. Low confidence should mean
   *less* adaptation, not a guess.
