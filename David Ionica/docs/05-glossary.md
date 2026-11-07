# 05 — Glossary

Shared vocabulary. Use these terms exactly, in docs, code and the pitch — ambiguity here
turns into merge conflicts later.

| Term | Meaning |
|---|---|
| **Chameleon** | Working codename for the product (provisional, ADR-006). |
| **UIIntent** | The JSON config describing how to render a page for one visitor. The only render-path output of the LLM. Contains no content. See `specs/ui-intent-schema.md`. |
| **UserProfile** | What we believe about a visitor plus what they explicitly told us. See `specs/profile-schema.md`. |
| **Axis** | One inferred, continuous profile dimension (e.g. `jargonTolerance`). Nudged by signals, never set hard. |
| **Explicit preference** | Something the visitor stated in chat. Durable and authoritative — overrides all axes (ADR-003). |
| **Signal** | One observed behavior (spec table opened, sorted by price, dwell time). Never PII. |
| **Adaptation Engine** | `(UserProfile, PageContext, Registry) → UIIntent`. Cache-first; LLM on miss. |
| **Component Registry** | Partner-side declaration of which blocks exist per page template and which variants each supports. The safety boundary — `UIIntent` can only reference what's declared. |
| **Block** | A nameable region of a page template (`hero`, `specs`, `reviews`, `price_cta`). |
| **Variant** | One declared way to render a block (`specs` → `table_full` \| `table_key` \| `prose_benefits` \| `hidden`). |
| **Neutral intent** | The normal, unpersonalized page for a template. The SSR output, the cold-start output, the low-confidence output, and the fallback for any validation failure. Must be a genuinely good page by itself. |
| **Profile fingerprint** | Coarse hash of profile axes plus explicit preferences. The cache key — makes similar visitors share cache entries. |
| **Settle-in** | The animated transition from neutral page to adapted page after hydration. Deliberate, not a compromise (ADR-004). |
| **Persona switcher** | Dev-only panel loading a prepared profile instantly, for demos and testing. |
| **Trust surface** | Profile viewer + consent gate + "why this layout?" + global off switch. Collectively P5. |
| **Rationale** | The plain-language, second-person explanation of why a page looks the way it does. Shown to the user, not internal. |
