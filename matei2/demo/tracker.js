/**
 * Babel Advanced User Data & Age Inference Collector v2
 * 
 * Full telemetry collection with ALL markers:
 *   - Account profile (if logged in)
 *   - Pre-Arrival UTMs & referrer
 *   - Environmental (device, screen, timezone, local time, IP geolocation, weather)
 *   - Behavioral biometrics (cursor jiggle, scroll velocity/depth, time-to-first-action)
 * 
 * PLUS enhanced age-relevant markers:
 *   - Touch vs Mouse detection & pinch-to-zoom frequency
 *   - Per-section dwell / reading time
 *   - In-browser zoom detection (Ctrl+scroll / pinch zoom)
 *   - Navigation pattern tracking (linear vs exploratory path)
 *   - Payment method preference capture
 *   - Session duration & multi-visit return frequency
 */

class UserDataCollector {
  constructor(options = {}) {
    this.storageKey = options.storageKey || 'babel_telemetry_v2';
    this.sessionKey = options.sessionKey || 'babel_sessions_v2';
    this.startTime = performance.now();
    this.firstActionTime = null;

    // The complete data store
    this.data = {
      // 1. Account (if logged in)
      account: options.currentUser || null,

      // 2. Pre-Arrival
      preArrival: this._extractPreArrival(),

      // 3. Environmental (Millisecond 0)
      environmental: this._extractEnvironmental(),

      // 4. Core Behavioral Biometrics
      biometrics: {
        timeToFirstActionMs: null,
        scrollVelocityPxPerSec: 0,
        maxScrollDepthPercent: 0,
        cursorJiggleScore: 0,
        totalClicks: 0,
        behaviorState: 'Idle'
      },

      // 5. NEW: Enhanced Age-Relevant Markers
      ageMarkers: {
        // Touch vs Mouse & tap accuracy
        inputMethod: 'unknown',           // 'touch' | 'mouse' | 'mixed'
        pinchZoomCount: 0,                // How often user pinch-zooms (mobile)
        tapMissCount: 0,                  // Taps that land outside interactive elements
        tapTotalCount: 0,                 // All taps / clicks on interactive elements

        // Per-section dwell / reading time
        sectionDwellTimesMs: {},           // { "hero": 4200, "specs": 12800, ... }
        avgDwellPerSectionMs: 0,
        longestDwellSectionId: null,

        // In-browser zoom detection
        browserZoomLevel: 100,             // Current detected zoom %
        zoomChangeCount: 0,               // How many times user changed zoom mid-session

        // Navigation pattern (linear vs exploratory)
        navigationPath: [],                // Ordered list of visited sections / pages
        pathLinearityScore: 100,           // 100 = perfectly linear, 0 = erratic jumping
        backtrackCount: 0,                 // How many times user went "back" to a previous section

        // Payment method preference
        paymentMethodSelected: null,       // 'apple_pay' | 'google_pay' | 'klarna' | 'card_manual' | 'bank_transfer'

        // Session duration & return frequency
        currentSessionDurationSec: 0,
        totalLifetimeSessions: 0,
        avgSessionDurationSec: 0,
        daysSinceFirstVisit: 0,

        // Search query analysis
        searchQueries: [],
        lastQueryWordCount: 0,
        queryStyle: 'none'                // 'conversational' | 'keyword' | 'trend_slang' | 'none'
      },

      lastUpdated: new Date().toISOString()
    };

    // Internal state
    this._lastScrollY = window.scrollY;
    this._lastScrollTime = performance.now();
    this._mouseCoords = [];
    this._visibleSection = null;
    this._sectionEntryTime = null;
    this._lastBrowserZoom = Math.round(window.outerWidth / window.innerWidth * 100);
    this._touchCount = 0;
    this._mouseCount = 0;

    this._initListeners();
    this._initSectionObserver();
    this._initZoomDetection();
    this._initInputMethodDetection();
    this._loadSessionHistory();
    this._fetchGeoAndWeather();
    this._save();

    // Session timer
    this._sessionInterval = setInterval(() => {
      this.data.ageMarkers.currentSessionDurationSec = Math.round((performance.now() - this.startTime) / 1000);
      this._save();
    }, 5000);
  }

  // ────────────────────────────────────────────
  // 2. PRE-ARRIVAL UTM EXTRACTION
  // ────────────────────────────────────────────
  _extractPreArrival() {
    const params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get('utm_source') || 'direct',
      utm_medium: params.get('utm_medium') || 'none',
      utm_campaign: params.get('utm_campaign') || 'none',
      utm_content: params.get('utm_content') || 'none',
      referrer: document.referrer || 'direct'
    };
  }

  // ────────────────────────────────────────────
  // 3. INSTANT ENVIRONMENTAL DATA
  // ────────────────────────────────────────────
  _extractEnvironmental() {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    return {
      deviceType: isMobile ? 'Mobile' : (window.innerWidth < 1024 ? 'Tablet' : 'Desktop'),
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language || 'en-US',
      localTime: new Date().toLocaleTimeString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      connection: navigator.connection ? (navigator.connection.effectiveType || '4g') : 'unknown',
      osScalingDetected: window.devicePixelRatio > 1.25,
      prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      prefersHighContrast: window.matchMedia('(prefers-contrast: more)').matches,
      geo: { city: 'Pending...', country: 'Pending...', weather: 'Pending...', ip: 'Pending...' }
    };
  }

  // ────────────────────────────────────────────
  // GEO & WEATHER (Async API Enrichment)
  // ────────────────────────────────────────────
  async _fetchGeoAndWeather() {
    try {
      const ipRes = await fetch('https://ipapi.co/json/');
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        this.data.environmental.geo.ip = ipData.ip;
        this.data.environmental.geo.city = ipData.city;
        this.data.environmental.geo.country = ipData.country_name;

        const lat = ipData.latitude;
        const lon = ipData.longitude;
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        if (weatherRes.ok) {
          const wData = await weatherRes.json();
          this.data.environmental.geo.weather = `${wData.current_weather.temperature}°C`;
        }
      }
    } catch {
      this.data.environmental.geo = { city: 'Unavailable', country: 'Unavailable', weather: 'Unavailable', ip: 'Blocked' };
    }
    this._save();
  }

  // ────────────────────────────────────────────
  // 4. CORE BEHAVIORAL BIOMETRICS
  // ────────────────────────────────────────────
  _recordFirstAction() {
    if (this.firstActionTime === null) {
      this.firstActionTime = Math.round(performance.now() - this.startTime);
      this.data.biometrics.timeToFirstActionMs = this.firstActionTime;
    }
  }

  _initListeners() {
    // A. Scroll Velocity & Depth
    window.addEventListener('scroll', () => {
      this._recordFirstAction();
      const now = performance.now();
      const deltaY = Math.abs(window.scrollY - this._lastScrollY);
      const deltaTime = (now - this._lastScrollTime) / 1000;

      if (deltaTime > 0.05) {
        this.data.biometrics.scrollVelocityPxPerSec = Math.round(deltaY / deltaTime);
        this._lastScrollY = window.scrollY;
        this._lastScrollTime = now;
      }

      const totalDocHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalDocHeight > 0) {
        const depth = Math.min(100, Math.round((window.scrollY / totalDocHeight) * 100));
        if (depth > this.data.biometrics.maxScrollDepthPercent) {
          this.data.biometrics.maxScrollDepthPercent = depth;
        }
      }

      // Update behavior state label
      const v = this.data.biometrics.scrollVelocityPxPerSec;
      const j = this.data.biometrics.cursorJiggleScore;
      if (j > 35) {
        this.data.biometrics.behaviorState = 'Agitated (Cursor Jiggle)';
      } else if (v > 900) {
        this.data.biometrics.behaviorState = 'High-Speed Skimming';
      } else if (v > 200) {
        this.data.biometrics.behaviorState = 'Active Scanning';
      } else {
        this.data.biometrics.behaviorState = 'Deliberate Reading';
      }

      this._save();
    }, { passive: true });

    // B. Cursor Movement & Jiggle Detection
    window.addEventListener('mousemove', (e) => {
      this._recordFirstAction();
      const now = performance.now();
      this._mouseCoords.push({ x: e.clientX, y: e.clientY, time: now });
      if (this._mouseCoords.length > 15) this._mouseCoords.shift();

      if (this._mouseCoords.length >= 6) {
        let reversals = 0;
        let totalDist = 0;
        for (let i = 2; i < this._mouseCoords.length; i++) {
          const dx1 = this._mouseCoords[i - 1].x - this._mouseCoords[i - 2].x;
          const dx2 = this._mouseCoords[i].x - this._mouseCoords[i - 1].x;
          if ((dx1 > 0 && dx2 < 0) || (dx1 < 0 && dx2 > 0)) reversals++;
          totalDist += Math.hypot(dx2, this._mouseCoords[i].y - this._mouseCoords[i - 1].y);
        }
        if (reversals >= 3 && totalDist > 130) {
          this.data.biometrics.cursorJiggleScore = Math.min(100, this.data.biometrics.cursorJiggleScore + 15);
        } else {
          this.data.biometrics.cursorJiggleScore = Math.max(0, this.data.biometrics.cursorJiggleScore - 1);
        }
      }
      this._save();
    });

    // C. Click counter + tap accuracy tracking
    window.addEventListener('click', (e) => {
      this._recordFirstAction();
      this.data.biometrics.totalClicks++;

      // Tap accuracy: did the click land on an interactive element?
      const tag = e.target.tagName.toLowerCase();
      const isInteractive = ['a', 'button', 'input', 'select', 'textarea', 'label'].includes(tag)
        || e.target.closest('a, button, [role="button"], [onclick]');
      
      this.data.ageMarkers.tapTotalCount++;
      if (!isInteractive) {
        this.data.ageMarkers.tapMissCount++;
      }
      this._save();
    });
  }

  // ────────────────────────────────────────────
  // 5a. TOUCH vs MOUSE DETECTION
  // ────────────────────────────────────────────
  _initInputMethodDetection() {
    window.addEventListener('touchstart', () => {
      this._touchCount++;
      this._updateInputMethod();
    }, { passive: true });

    window.addEventListener('mousedown', (e) => {
      // Ignore simulated mouse events from touch
      if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
      this._mouseCount++;
      this._updateInputMethod();
    });

    // Pinch-to-zoom detection on touch devices
    let lastTouchDistance = null;
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (lastTouchDistance !== null) {
          const delta = Math.abs(dist - lastTouchDistance);
          if (delta > 15) {
            this.data.ageMarkers.pinchZoomCount++;
            this._save();
          }
        }
        lastTouchDistance = dist;
      }
    }, { passive: true });

    window.addEventListener('touchend', () => { lastTouchDistance = null; }, { passive: true });
  }

  _updateInputMethod() {
    if (this._touchCount > 0 && this._mouseCount > 0) {
      this.data.ageMarkers.inputMethod = 'mixed';
    } else if (this._touchCount > 0) {
      this.data.ageMarkers.inputMethod = 'touch';
    } else {
      this.data.ageMarkers.inputMethod = 'mouse';
    }
  }

  // ────────────────────────────────────────────
  // 5b. PER-SECTION DWELL / READING TIME
  // ────────────────────────────────────────────
  _initSectionObserver() {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = entry.target.dataset.section || entry.target.id;
        if (!id) continue;

        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          // Entering a section
          if (this._visibleSection !== id) {
            this._flushDwell();
            this._visibleSection = id;
            this._sectionEntryTime = performance.now();

            // Navigation path tracking
            this._recordNavigation(id);
          }
        }
      }
    }, { threshold: 0.5 });

    // Observe all elements with data-section or id
    requestAnimationFrame(() => {
      document.querySelectorAll('[data-section], section[id], [id]').forEach(el => {
        if (el.id || el.dataset.section) observer.observe(el);
      });
    });
  }

  _flushDwell() {
    if (this._visibleSection && this._sectionEntryTime) {
      const elapsed = Math.round(performance.now() - this._sectionEntryTime);
      const id = this._visibleSection;
      const existing = this.data.ageMarkers.sectionDwellTimesMs[id] || 0;
      this.data.ageMarkers.sectionDwellTimesMs[id] = existing + elapsed;

      // Recalculate averages
      const entries = Object.entries(this.data.ageMarkers.sectionDwellTimesMs);
      if (entries.length > 0) {
        const total = entries.reduce((sum, [, v]) => sum + v, 0);
        this.data.ageMarkers.avgDwellPerSectionMs = Math.round(total / entries.length);

        let maxId = null, maxVal = 0;
        for (const [k, v] of entries) {
          if (v > maxVal) { maxVal = v; maxId = k; }
        }
        this.data.ageMarkers.longestDwellSectionId = maxId;
      }
      this._save();
    }
  }

  // ────────────────────────────────────────────
  // 5c. IN-BROWSER ZOOM DETECTION
  // ────────────────────────────────────────────
  _initZoomDetection() {
    const checkZoom = () => {
      // Method: compare outerWidth to innerWidth (desktop)
      // On mobile this is less reliable, so also check visualViewport
      let zoomLevel;
      if (window.visualViewport) {
        zoomLevel = Math.round(window.visualViewport.scale * 100);
      } else {
        zoomLevel = Math.round((window.outerWidth / window.innerWidth) * 100);
      }

      if (Math.abs(zoomLevel - this._lastBrowserZoom) > 5) {
        this.data.ageMarkers.zoomChangeCount++;
        this._lastBrowserZoom = zoomLevel;
      }
      this.data.ageMarkers.browserZoomLevel = zoomLevel;
      this._save();
    };

    window.addEventListener('resize', checkZoom);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', checkZoom);
    }
  }

  // ────────────────────────────────────────────
  // 5d. NAVIGATION PATTERN (Linear vs Exploratory)
  // ────────────────────────────────────────────
  _recordNavigation(sectionId) {
    const path = this.data.ageMarkers.navigationPath;
    path.push(sectionId);

    // Count backtracks (revisiting an earlier section)
    if (path.length >= 2) {
      const previousSections = path.slice(0, -1);
      if (previousSections.includes(sectionId)) {
        this.data.ageMarkers.backtrackCount++;
      }
    }

    // Linearity: ratio of unique sections to total navigations
    // 100 = every step is a new section (linear), lower = jumping back and forth
    const unique = new Set(path).size;
    this.data.ageMarkers.pathLinearityScore = Math.round((unique / path.length) * 100);

    this._save();
  }

  // ────────────────────────────────────────────
  // 5e. PAYMENT METHOD PREFERENCE
  // ────────────────────────────────────────────
  recordPaymentMethod(method) {
    // Call this when user selects a payment method at checkout
    // method: 'apple_pay' | 'google_pay' | 'klarna' | 'card_manual' | 'bank_transfer' | 'revolut'
    this.data.ageMarkers.paymentMethodSelected = method;
    this._save();
  }

  // ────────────────────────────────────────────
  // 5f. SEARCH QUERY ANALYSIS
  // ────────────────────────────────────────────
  recordSearchQuery(query) {
    if (!query || !query.trim()) return;
    const q = query.trim();
    this.data.ageMarkers.searchQueries.push(q);
    this.data.ageMarkers.lastQueryWordCount = q.split(/\s+/).length;

    // Classify query style
    const lower = q.toLowerCase();
    const wordCount = q.split(/\s+/).length;

    const isConversational = wordCount >= 5 ||
      /(how to|how do|what is|can i|make it|help me|where|which one|should i|for my)/i.test(lower);
    const isSpec = /(anc|ldac|aptx|latency|thd|driver|beryllium|dac|frequency|ohm|hz|khz|impedance|snr|codec)/i.test(lower);
    const isTrend = /(dupe|viral|aesthetic|cheap|tiktok|hack|fire|goated|bussin|slay|under \$|best budget)/i.test(lower);

    if (isConversational) {
      this.data.ageMarkers.queryStyle = 'conversational';
    } else if (isSpec) {
      this.data.ageMarkers.queryStyle = 'keyword_technical';
    } else if (isTrend) {
      this.data.ageMarkers.queryStyle = 'trend_slang';
    } else {
      this.data.ageMarkers.queryStyle = 'generic';
    }

    this._save();
  }

  // ────────────────────────────────────────────
  // 5g. SESSION HISTORY & RETURN FREQUENCY
  // ────────────────────────────────────────────
  _loadSessionHistory() {
    try {
      const raw = localStorage.getItem(this.sessionKey);
      const history = raw ? JSON.parse(raw) : { sessions: [], firstVisit: null };

      if (!history.firstVisit) {
        history.firstVisit = new Date().toISOString();
      }

      // Add current session
      history.sessions.push({
        start: new Date().toISOString(),
        durationSec: 0
      });

      this.data.ageMarkers.totalLifetimeSessions = history.sessions.length;

      // Average session duration from previous sessions (exclude current)
      const previous = history.sessions.slice(0, -1);
      if (previous.length > 0) {
        const totalDuration = previous.reduce((sum, s) => sum + (s.durationSec || 0), 0);
        this.data.ageMarkers.avgSessionDurationSec = Math.round(totalDuration / previous.length);
      }

      // Days since first visit
      const firstDate = new Date(history.firstVisit);
      const now = new Date();
      this.data.ageMarkers.daysSinceFirstVisit = Math.floor((now - firstDate) / (1000 * 60 * 60 * 24));

      // Update session duration on page unload
      window.addEventListener('beforeunload', () => {
        const current = history.sessions[history.sessions.length - 1];
        if (current) {
          current.durationSec = Math.round((performance.now() - this.startTime) / 1000);
        }
        localStorage.setItem(this.sessionKey, JSON.stringify(history));
      });

      localStorage.setItem(this.sessionKey, JSON.stringify(history));
    } catch {}
  }

  // ────────────────────────────────────────────
  // STORAGE
  // ────────────────────────────────────────────
  _save() {
    this.data.lastUpdated = new Date().toISOString();
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    } catch {}
  }

  // Flush any pending dwell time and save final state
  flush() {
    this._flushDwell();
    this.data.ageMarkers.currentSessionDurationSec = Math.round((performance.now() - this.startTime) / 1000);
    this._save();
  }

  // Read stored data
  static getStoredData(key = 'babel_telemetry_v2') {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  // Cleanup
  destroy() {
    if (this._sessionInterval) clearInterval(this._sessionInterval);
    this.flush();
  }
}
