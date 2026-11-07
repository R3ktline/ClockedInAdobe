# Matei 2 — Advanced User Telemetry & Comprehensive Marker Engine

This folder contains the **v2 comprehensive telemetry engine** that collects **all markers** (environmental, behavioral, intent) with enhanced depth for both demographic inference and deep behavioral profiling.

## What is in `matei2/`

- **`demo/tracker.js`**: Standalone `UserDataCollector` class with zero external dependencies.
- **`demo/index.html`**: Live interactive testbench and dashboard displaying real-time sensor and biometric data feeds.

## Markers Collected

### 1. Account Profile (Verified Ground Truth)
- `account`: Exact user ID, verified age, name, role (100% confidence when authenticated).

### 2. Pre-Arrival (URL & Referrer Telemetry)
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`
- `referrer` URL

### 3. Environmental Sensors (Millisecond 0)
- `deviceType`: Mobile, Tablet, Desktop
- `screenResolution` & `viewport`
- `language`: Browser locale
- `localTime` & `timezone`: IANA system timezone
- `connection`: Effective connection type (e.g., 4g)
- `osScalingDetected`: OS-level zoom scaling (`devicePixelRatio > 1.25`)
- `prefersReducedMotion` & `prefersHighContrast`: Accessibility media queries
- `geo`: IP Geolocation (City, Country), current local weather API enrichment

### 4. Core Behavioral Biometrics
- `timeToFirstActionMs`: Milliseconds to initial interaction
- `scrollVelocityPxPerSec`: Real-time scroll speed
- `maxScrollDepthPercent`: Maximum page depth reached
- `cursorJiggleScore`: 0–100 agitation/hesitation score (rapid cursor reversals)
- `totalClicks`: Cumulative interactions
- `behaviorState`: Idle / Deliberate Reading / Active Scanning / High-Speed Skimming / Agitated

### 5. Enhanced Age & Intent Signals (v2 Additions)
- **Touch vs. Mouse & Tap Accuracy**:
  - `inputMethod`: `'touch' | 'mouse' | 'mixed'`
  - `pinchZoomCount`: Count of pinch-to-zoom gestures
  - `tapMissCount` / `tapTotalCount`: Tap precision on interactive vs non-interactive elements
- **Per-Section Dwell & Reading Time**:
  - `sectionDwellTimesMs`: Microsecond reading time per visible section
  - `avgDwellPerSectionMs` & `longestDwellSectionId`
- **In-Browser Zoom Tracking**:
  - `browserZoomLevel`: Detected zoom percentage
  - `zoomChangeCount`: Mid-session zoom adjustments
- **Navigation Pattern (Linear vs. Exploratory)**:
  - `navigationPath`: Traversed sections log
  - `pathLinearityScore`: Percentage representing linear vs jumping traversal
  - `backtrackCount`: Revisits to earlier sections
- **Payment Method Preference**:
  - `paymentMethodSelected`: Apple Pay / Google Pay / Klarna / Manual Card / Bank Transfer
- **Search Query NLP Style**:
  - `queryStyle`: `'conversational' | 'keyword_technical' | 'trend_slang' | 'generic'`
  - `lastQueryWordCount`
- **Session Duration & Lifetime Return Frequency**:
  - `currentSessionDurationSec`, `totalLifetimeSessions`, `avgSessionDurationSec`, `daysSinceFirstVisit`
