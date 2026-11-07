# Matei's Planning & Architecture Notes

## Multi-Tier Customer Age & Intent Resolution Engine

For the **Babel** adaptive storefront hackathon demo, we need to adapt layout, typography, pricing models, and value propositions based on customer age cohorts without violating privacy laws or alienating unauthenticated guests.

The system uses a **6-Tier Hierarchy of Determination**:

```
Tier 1: Authenticated User Account (100% Conf.) ──► If logged in with age/birthdate, use it directly.
   │ [Not logged in]
Tier 2: Pre-Arrival Marketing Telemetry (85-95%) ──► Read ad set / UTM campaign taxonomy (e.g. ?utm_content=18-24).
   │ [No ad parameters]
Tier 3: Hardware & OS Ergonomics (75-80%)        ──► Detect 125-150% OS text zoom, high contrast, tablet usage.
   │ [Normal desktop/mobile]
Tier 4: On-Site Search NLP & Route (75-85%)      ──► Classify search syntax (conversational vs specs vs trends).
   │ [No search query yet]
Tier 5: Behavioral Biometrics (60-70%)           ──► Scroll velocity (fast skimmer vs reader) & cursor jiggles.
   │ [Cold start]
Tier 6: First-Party LocalStorage Persistence     ──► Restores previous visit inferences with 0ms latency and $0 API cost.
```

---

### Detailed Tier Breakdown

#### 1. Tier 1: Authenticated Account Profile (Exact, 100% Confidence)
*   **Trigger**: The user logs in or creates an account with birthdate/age on file.
*   **Execution**:
    *   `Age < 25` $\rightarrow$ Map to `deals` persona (Student discounts, Klarna/Apple Pay).
    *   `Age 25–42` $\rightarrow$ Map to `specs` persona (Technical details, benchmark metrics).
    *   `Age 43–59` $\rightarrow$ Map to `balanced` persona (Durability, ergonomics, premium design).
    *   `Age 60+` $\rightarrow$ Map to `simple` persona (High readability, spoken-word clarity, 1-on-1 phone setup).
*   **Outcome**: Overrides all other tiers with 100% verified certainty.

#### 2. Tier 2: Pre-Arrival Marketing Telemetry (85–95% Confidence)
*   **Trigger**: Incoming traffic from targeted ad networks (Meta, Google, TikTok, Snapchat).
*   **Execution**: Ad set macros inject demographic cohort names directly into URL query strings (`?utm_content={{adset.name}}`).
*   **Taxonomy Parsing**:
    *   Matches regex `/(18-24|25-34|35-44|45-54|55plus|gen_z|senior)/i`.
    *   Platform statistical priors: TikTok/Snapchat $\rightarrow$ 65%+ Gen Z prior; Facebook Newsfeed $\rightarrow$ 50+ prior.

#### 3. Tier 3: Hardware & Environmental Ergonomics (75–80% Confidence)
*   **Trigger**: User arrives organically without campaign parameters.
*   **Execution**: Check client-side display scaling and accessibility media queries at Millisecond 0:
    ```javascript
    const isEnlargedText = window.devicePixelRatio > 1.25 && window.innerWidth <= 1366;
    const prefersHighContrast = window.matchMedia('(prefers-contrast: more)').matches;
    ```
*   **Outcome**: If user has increased system font scaling or high-contrast mode, automatically boost the `simple` persona (enlarged type, higher contrast, fewer dense tables).

#### 4. Tier 4: On-Site Search Query NLP (75–85% Confidence)
*   **Trigger**: User uses the site's search bar.
*   **Query Syntax NLP**:
    *   *Natural Language / Conversational* (e.g. *"how to make dialogue clear on my TV"* or queries $\ge 5$ words) $\rightarrow$ Older demographic / comfort & assistance priority.
    *   *Acronym & Spec Dense* (e.g. *"ANC LDAC 45mm beryllium low latency"*) $\rightarrow$ Tech enthusiast / specs priority.
    *   *Trends & Slang* (e.g. *"cheap viral tiktok dupe"*) $\rightarrow$ Younger demographic / deal priority.

#### 5. Tier 5: Behavioral Biometrics (60–70% Confidence)
*   **Trigger**: Active browsing on the page.
*   **Signals**:
    *   Scroll velocity $>900$ px/s $\rightarrow$ High-speed skimmer.
    *   Erratic mouse jiggles / direction reversals $\rightarrow$ User hesitation or frustration.

#### 6. Tier 6: First-Party LocalStorage Persistence
*   **Trigger**: Any subsequent visit.
*   **Execution**: Inferred profile is cached as a JSON object in browser `localStorage`. On return visits, personalized view renders with zero network latency and zero AI API costs.

---

### Interactive Demo Files

- **Live Storefront & Telemetry Testbench**: [`matei/demo/index.html`](demo/index.html)
- **Modular Multi-Tier Tracking SDK**: [`matei/demo/tracker.js`](demo/tracker.js)
