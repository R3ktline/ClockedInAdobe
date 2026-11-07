# Spec — `UIIntent`

Status: **draft v1, not ratified.** This is a contract between workstreams. Changing it
breaks other people's code — propose changes in `docs/06-open-questions.md` first, and
record the change as an ADR.

## Purpose

The complete output of the Adaptation Engine, and the complete input to the renderer.
It is the only thing the LLM produces in the render path.

**`UIIntent` contains no content.** No product names, no specs, no prose. Only
instructions about which declared blocks to render, in what order, at what variant, and
with what verbosity. All content comes from the partner catalog. See the "never fabricate
product facts" rule in `CLAUDE.md`.

## Example

```json
{
  "version": 1,
  "pageTemplate": "product_detail",
  "global": {
    "density": "compact",
    "verbosity": 2,
    "jargon": "avoid",
    "tone": "plain"
  },
  "blocks": [
    { "id": "hero",      "variant": "single_image",   "order": 1 },
    { "id": "benefits",  "variant": "prose_benefits", "order": 2, "maxItems": 3 },
    { "id": "price_cta", "variant": "prominent",      "order": 3 },
    { "id": "specs",     "variant": "table_key",      "order": 4,
      "collapsed": true, "fields": ["battery_life", "weight", "screen_size"] },
    { "id": "reviews",   "variant": "summary_only",   "order": 5 },
    { "id": "compare",   "variant": "hidden",         "order": 6 }
  ],
  "rationale": "You've looked at 6 laptops without opening a spec table, and sorted by price twice — so this page leads with plain-language benefits and the price, and keeps the full specs one tap away.",
  "confidence": 0.62,
  "source": "inferred"
}
```

## Fields

| Field | Type | Notes |
|---|---|---|
| `version` | int | Schema version. Bump on breaking change. |
| `pageTemplate` | string | Must match a template in the registry. |
| `global.density` | `comfortable` \| `compact` | Spacing and information density. |
| `global.verbosity` | int 1–5 | 1 = minimum words, 5 = everything. |
| `global.jargon` | `prefer` \| `allow` \| `avoid` | Picks the catalog's technical vs. plain-language field for the same fact. Never rewrites it. |
| `global.tone` | `technical` \| `neutral` \| `plain` | Selects a pre-authored copy register. |
| `blocks[]` | array | Only ids declared by the registry. Unknown ids are dropped and logged. |
| `blocks[].variant` | string | Must be declared by the registry for that block. Invalid → block falls back to its neutral variant. |
| `blocks[].order` | int | Render order. Ties broken by registry default order. |
| `blocks[].collapsed` | bool | Rendered but behind a disclosure. |
| `blocks[].maxItems` | int | Optional cap for list-shaped blocks. |
| `blocks[].fields` | string[] | Optional subset of catalog fields, for table-shaped blocks. |
| `rationale` | string | **Plain language, shown to the user** in the "why this layout?" affordance. Second person. No jargon. |
| `confidence` | float 0–1 | Below the threshold, the engine must return the neutral intent instead. |
| `source` | `neutral` \| `inferred` \| `explicit` \| `mixed` | `explicit` means a user instruction drove this. Shown in the UI. |

## Validation rules (renderer MUST enforce these)

1. Unknown `blocks[].id` → drop the block, log it.
2. Unknown `blocks[].variant` → fall back to that block's neutral variant, log it.
3. A block declared `required` by the registry cannot be `hidden`. Downgrade to
   `collapsed` instead.
4. Any missing field falls back to the neutral intent's value for that field.
5. **The renderer never errors on a bad `UIIntent`.** Worst case it renders the neutral
   page. A model mistake must never produce a broken page.

## Neutral intent

Every page template declares a `neutral` `UIIntent` — the normal, unpersonalized page.
This is the SSR output, the cold-start output, the low-confidence output, and the
fallback for every validation failure. It must be a genuinely good page on its own.
