# Spec — `UserProfile`

Status: **draft v1, not ratified.** Contract between workstreams — see the warning in
`specs/ui-intent-schema.md`.

## Purpose

What we believe about this visitor, and what they have explicitly told us. Input to the
Adaptation Engine; rendered in plain language in the Profile Viewer.

**Design constraint:** every field in this object must be explainable to the user in one
plain sentence on the profile viewer. If it can't be, it doesn't belong here. This is not
a nicety — it is what keeps the product on the right side of GDPR Art. 13/22 and the EU
AI Act transparency rules, and it is the differentiator (see `docs/01-feasibility.md`).

## Example

```json
{
  "userId": "anon_7f3c91a2",
  "createdAt": "2026-11-07T09:12:00Z",
  "updatedAt": "2026-11-07T09:41:00Z",

  "axes": {
    "domainExpertise":    { "electronics": 0.2 },
    "informationAppetite": 0.3,
    "jargonTolerance":     0.1,
    "priceSensitivity":    0.8,
    "intentStage":         "browsing"
  },

  "explicitPreferences": [
    {
      "id": "pref_01",
      "text": "Only general info about products, no component details.",
      "interpreted": { "verbosity": 2, "jargon": "avoid", "specs": "collapsed" },
      "scope": "global",
      "source": "chat",
      "setAt": "2026-11-07T09:41:00Z"
    }
  ],

  "signalsSummary": {
    "productViews": 6,
    "specTableOpens": 0,
    "sortByPriceCount": 2,
    "comparisonUses": 0,
    "avgDwellSeconds": 34
  },

  "consent": {
    "granted": true,
    "scope": "personalization",
    "grantedAt": "2026-11-07T09:12:00Z"
  }
}
```

## Fields

### `axes` — inferred, continuous, always uncertain
| Axis | Range | Meaning |
|---|---|---|
| `domainExpertise` | map, 0–1 per domain | Familiarity with the category's vocabulary. |
| `informationAppetite` | 0–1 | How much detail they want. Low = three bullets. |
| `jargonTolerance` | 0–1 | Whether technical terms help or alienate. |
| `priceSensitivity` | 0–1 | How much price drives the decision. |
| `intentStage` | `browsing` \| `researching` \| `comparing` \| `deciding` | Where in the funnel. |

Axes are **nudged**, never set hard, by behavioral signals. They decay toward neutral
over time without reinforcement.

### `explicitPreferences` — stated, discrete, authoritative
Per ADR-003 these **override the axes unconditionally**. `text` is the user's own words,
kept verbatim so the profile viewer can quote it back to them. `interpreted` is the
engine's structured reading of it — and if the user disagrees with the interpretation,
that disagreement is itself a new preference.

### `signalsSummary`
Aggregates only. **No raw event log in the profile**, and no PII. Shown to the user as
"what we noticed".

### `consent`
If `granted` is false, the engine returns the neutral intent for everything. No profiling,
no signal collection. The off switch must actually switch things off.

## Explicitly NOT in this schema

Age, gender, location beyond currency/locale, income, cross-site browsing history,
inferred health or financial status, anything sourced from a third-party data broker.

Per ADR-002 these are not collected, not inferred, and not accepted if offered.

## Profile fingerprint

For caching, axes are bucketed coarsely (e.g. each 0–1 axis into 3 bands) and hashed
together with `explicitPreferences`. Similar visitors therefore share cache entries,
which is what keeps the LLM out of the steady-state render path.
