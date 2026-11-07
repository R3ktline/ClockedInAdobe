# Demo questions: what judges will ask

The weak points a judge is likely to press on, with the honest answer. Read it before rehearsal. **Never overclaim:** a judge who catches one inflated claim stops trusting the rest.

---

## Product and market

**1. "Isn't this Adobe Target / Dynamic Yield / Optimizely?"**
They choose *which content* a segment sees, among variants a marketer authored. Babel changes *how the page is shaped* for one shopper (density, dialect, what's emphasised) and composes the variant itself, inside the store's brand. They are complementary: Babel's slides are JSON, which is the format those tools already deliver.

**2. "Fibr, New Gen and others already say 'AI reshapes the page per visitor'."**
True; we are not first to that sentence. What we do differently: the **web-dialect** axis (how a person reads the web, not just what they want), changes as reversible **slides** with a stated hypothesis the agent checks, **brand bounds enforced in code**, and the same catalog opened to **shopping agents**. Don't claim "nobody does this."

**3. "Why would a store let an AI change its pages?"**
It can't change the brand: colours and fonts are fixed, ranges are clamped in code, and it can only pick blocks and variants the store declared. Prices, stock and copy never pass through it. The clamp log shows this live.

**4. "How does a real store integrate?"**
A store declares a registry (blocks and variants) and a brand kit, and wraps its sections in `<BabelBlock>`. Honest caveat: today that's a React adapter on our own demo stores; a script-tag adapter for any site is roadmap. We have not integrated with a real store.

**5. "What's the business model?"**
Per-visit SaaS pricing on adapted sessions, plus the agent channel. Cost per 1,000 visits comes from real DeepSeek usage measured during the build (see the cost slide). Don't quote a revenue lift we haven't measured.

## "What the customer is"

**6. "How do you know who I am? Do you guess my age?"**
No. We never infer age. Persona = **dialect** (how you interact: zoom, mis-taps, search wording, filter use) × **need** (what you look at: specs, price, returns). A store may pass context it already has, with consent. If a store sends an age band, it's a weak prior only and is never used for prices or offers.

**7. "What if you get it wrong? A big-button page for an engineer is insulting."**
Low confidence means *no* change, not a guess. Minor slides change at most two blocks. Every slide is reversible with ◀, **Standard view** is one tap away, and an undo blocks that kind of change for the rest of the visit. The rationale describes the view, never the person.

**8. "Doesn't a page that keeps changing disorient people?"**
That's why changes are slides, not morphing: they land at pauses or page changes, never mid-scroll, at most every 20 s, with anchors (header, search, cart, price) fixed. Big re-compositions happen only on a return visit, and even then the blocks you used most stay put.

**9. "Your data is synthetic. How do you know any of this works?"**
We don't yet, and we say so. The demo proves the mechanism. The measurement plan is a holdout per persona (Standard view vs. Babel) on add-to-cart and time-to-decision, which the merchant panel is already built to show. The cheapest real test is a ~20-person preference study.

**10. "Any conversion numbers?"**
Only simulated, and labelled as such on screen. No invented lift figures.

## AI and agents

**11. "Is the AI essential, or is it a rules engine with a chatbot?"**
Rules only make the first paint instant and act as the fallback. Every slide after that is chosen by the Director agent: it reads markers, bets on a hypothesis, acts through tools, repairs its own invalid proposals, and checks the result at the next boundary. The trace shows each step.

**12. "What's agentic about it?"**
A goal (reduce friction to a confident decision), tools that change the world (slides), memory (the timeline and hypothesis results), feedback from outside the model (markers, undos), a stopping rule, and hard limits (change budget). Plus a second loop across sessions (Insights) and real agent-to-agent traffic over A2A.

**13. "What stops the LLM inventing a spec or a price?"**
It never writes them. A slide has no field for prices, stock, ratings or copy; components render those from the catalog. Copy comes in three pre-written registers and the agent only picks one. Numbers in chat narration are checked against tool results.

**14. "Prompt injection?"**
Two entry points: chat and incoming A2A text. Both pass an input guard, are fenced as data, and can only produce validated JSON. Tools are read-only. "Give me 90% off" is in the demo.

**15. "Latency?"**
First paint never waits for an LLM: slide 0 comes from cache or rules. The Director runs at pauses, with a 6 s budget, and the slide applies when ready.

**16. "Why DeepSeek? Isn't the data processed in China?"**
Cost, and it's OpenAI-compatible, so the provider is swappable in one place. We send no personal data, only marker numbers, slide JSON and catalog facts.

**17. "Do OpenAI or Anthropic agents actually speak A2A?"**
Be precise: A2A is an open agent-to-agent protocol with an official SDK. Today's assistant products most commonly connect to external tools through MCP, which is why the same tools are also exposed as an MCP server. Don't claim specific vendor A2A support unless checked on the day.

**18. "Will agents negotiate with your store?"**
No. Same prices and promotions as humans. Negotiating would be personalised pricing.

## Legal and ethics

**19. "Is this legal under GDPR and ePrivacy?"**
Consent before collecting signals; no personal data in the profile; the Why? panel explains; Standard view is the off switch. See [GUARDRAILS §2](GUARDRAILS.md#2-legal-checklist).

**20. "EU AI Act: aren't you exploiting older or less confident shoppers?"**
The opposite is enforced in code: the `guided` view gets clearer information and never more pressure, no add-on is pushed harder to any persona, and hesitation is answered with information, never urgency.

**21. "Couldn't a store use your markers to manipulate people, e.g. hit hesitant shoppers with countdowns?"**
Not through Babel: there is no countdown or urgency variant, the policy layer rejects the language, and no marker can change a price or unlock a private discount.

**22. "Different shoppers see different products. Filter bubble? Unfair?"**
Same catalog and same prices for everyone. Order and emphasis change; nothing is hidden that you can't reach in one tap, and Standard view is always available.

**23. "What about minors?"**
If a store flags a minor, no profiling-based promoted placements and no deals emphasis (DSA Art. 28).

**24. "Remembering my last visit is tracking."**
First-party only, on your device, after consent, resettable from the Why? panel.

**25. "Isn't the simple view an accessibility overlay, like accessiBe?"**
No. We don't claim it makes a site accessible or compliant. Every dialect is built on accessible components; `guided` is about cognitive load and comfort.

## Honesty list (say it before they find it)

- Data is synthetic; numbers are simulated.
- The stores are ours and fictional, inspired by real ones.
- No real store integration; React adapter only.
- Scripted beats replay recorded model responses; the live beat is marked.
