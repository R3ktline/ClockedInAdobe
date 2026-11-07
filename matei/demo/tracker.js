/**
 * Babel Multi-Tier Age & Intent Detection Engine (Hackathon Demo SDK)
 * 
 * Hierarchy of Determination:
 *  Tier 1: Authenticated Account Profile (Exact Age, 100% Confidence)
 *  Tier 2: Pre-Arrival Marketing Telemetry (UTM Taxonomy & Ad Set Target Metadata, 85-95%)
 *  Tier 3: Hardware & Environmental Ergonomics (OS Text Zoom, Accessibility Media Queries, 70-80%)
 *  Tier 4: Organic Search & Landing Route Semantics (NLP on Search Queries & SEO Paths, 75%)
 *  Tier 5: Behavioral Biometrics (Scroll velocity, cursor jiggles, reading latency, 65%)
 *  Tier 6: First-Party LocalStorage Persistence (Instant return visit cache)
 */

class BabelAgeAndPersonaEngine {
  constructor(options = {}) {
    this.storageKey = options.storageKey || 'babel_visitor_demographics';
    this.consentKey = options.consentKey || 'babel_gdpr_consent';
    this.onUpdate = options.onUpdate || (() => {});
    
    // Account state (Tier 1)
    this.currentUser = options.initialUser || null; // e.g. { name: 'Eleanor', age: 68, memberSince: 2021 }

    // Telemetry state
    this.hasConsent = true;
    this.preArrival = { utm_source: 'direct', utm_campaign: 'none', utm_content: 'none', referrer: 'direct' };
    this.searchQuery = '';
    this.landingPath = window.location.pathname || '/';
    
    this.biometrics = {
      scrollVelocity: 0,
      maxScrollDepth: 0,
      mouseJiggleScore: 0,
      timeToFirstActionMs: null,
      behaviorState: 'Idle'
    };

    this.evaluation = {
      tierUsed: 'None',
      estimatedAge: null,
      ageBracket: 'Unknown',
      inferredPersona: 'balanced',
      confidence: 0,
      reasons: []
    };

    this.startTime = performance.now();
    this.lastScrollY = 0;
    this.lastScrollTime = performance.now();
    this.mouseHistory = [];
  }

  // --- TIER 1: Authenticated Account Profile ---
  setAccountUser(user) {
    this.currentUser = user; // pass null to simulate guest/logged-out
    this.evaluate();
  }

  getAccountTier() {
    if (this.currentUser && typeof this.currentUser.age === 'number') {
      const age = this.currentUser.age;
      let bracket = '25-39';
      let persona = 'balanced';

      if (age < 25) {
        bracket = '18-24 (Gen Z)';
        persona = 'deals';
      } else if (age <= 42) {
        bracket = '25-42 (Millennial)';
        persona = 'specs';
      } else if (age <= 59) {
        bracket = '43-59 (Gen X)';
        persona = 'balanced';
      } else {
        bracket = '60+ (Senior / Boomer)';
        persona = 'simple';
      }

      return {
        active: true,
        tier: 'Tier 1: Authenticated User Profile',
        age: age,
        bracket: bracket,
        persona: persona,
        confidence: 100,
        reason: `Direct profile verification: Logged in as ${this.currentUser.name} (Age: ${age})`
      };
    }
    return { active: false };
  }

  // --- TIER 2: Marketing & UTM Demographics ---
  setCampaignParams(source = 'direct', campaign = 'none', content = 'none', referrer = 'direct') {
    this.preArrival = { utm_source: source, utm_campaign: campaign, utm_content: content, referrer };
    this.evaluate();
  }

  getMarketingTier() {
    const combined = `${this.preArrival.utm_campaign} ${this.preArrival.utm_content} ${this.preArrival.utm_source}`.toLowerCase();
    
    // Explicit age tags in adset/campaign names
    const ageMatch = combined.match(/(18-24|25-34|35-44|45-54|55-64|65\+|55plus|gen_?z|student|senior|retiree)/i);
    if (ageMatch) {
      const tag = ageMatch[0].toLowerCase();
      if (tag.includes('18-24') || tag.includes('student') || tag.includes('gen_z') || tag.includes('genz')) {
        return {
          active: true,
          tier: 'Tier 2: Ad Set Demographic Telemetry',
          age: '18-24',
          bracket: '18-24 (Gen Z)',
          persona: 'deals',
          confidence: 90,
          reason: `Ad Set target cohort matched explicit parameter: '${ageMatch[0]}'`
        };
      }
      if (tag.includes('25-34') || tag.includes('35-44')) {
        return {
          active: true,
          tier: 'Tier 2: Ad Set Demographic Telemetry',
          age: '25-40',
          bracket: '25-40 (Millennial)',
          persona: 'specs',
          confidence: 88,
          reason: `Ad Set target cohort matched explicit parameter: '${ageMatch[0]}'`
        };
      }
      if (tag.includes('45-54')) {
        return {
          active: true,
          tier: 'Tier 2: Ad Set Demographic Telemetry',
          age: '45-54',
          bracket: '45-54 (Gen X)',
          persona: 'balanced',
          confidence: 85,
          reason: `Ad Set target cohort matched explicit parameter: '${ageMatch[0]}'`
        };
      }
      if (tag.includes('55') || tag.includes('65') || tag.includes('senior') || tag.includes('retiree')) {
        return {
          active: true,
          tier: 'Tier 2: Ad Set Demographic Telemetry',
          age: '60+',
          bracket: '60+ (Senior / Boomer)',
          persona: 'simple',
          confidence: 92,
          reason: `Ad Set target cohort matched explicit parameter: '${ageMatch[0]}'`
        };
      }
    }

    // Platform statistical baseline
    const source = this.preArrival.utm_source.toLowerCase();
    if (source === 'tiktok' || source === 'snapchat') {
      return {
        active: true,
        tier: 'Tier 2: Platform Prior Probability',
        age: '18-24',
        bracket: '18-24 (Gen Z skew)',
        persona: 'deals',
        confidence: 72,
        reason: `Traffic source '${source}' has 65%+ Gen Z user base`
      };
    }
    if (source === 'facebook') {
      return {
        active: true,
        tier: 'Tier 2: Platform Prior Probability',
        age: '50+',
        bracket: '50+ (Gen X / Boomer skew)',
        persona: 'simple',
        confidence: 70,
        reason: `Facebook Newsfeed traffic skews 45-65+`
      };
    }

    return { active: false };
  }

  // --- TIER 3: Hardware & Accessibility Ergonomics ---
  getHardwareTier() {
    const isEnlargedText = window.devicePixelRatio > 1.25 && window.innerWidth <= 1366;
    const prefersHighContrast = window.matchMedia && window.matchMedia('(prefers-contrast: more)').matches;
    const isTablet = /(iPad|Tablet|(Android(?!.*Mobile)))/i.test(navigator.userAgent);

    if (isEnlargedText || prefersHighContrast) {
      return {
        active: true,
        tier: 'Tier 3: Hardware & OS Ergonomics',
        age: '55+',
        bracket: '55+ (Presbyopia / Vision Ergonomics)',
        persona: 'simple',
        confidence: 78,
        reason: `Detected OS Display Scaling (>125%) or High Contrast mode`
      };
    }
    if (isTablet) {
      return {
        active: true,
        tier: 'Tier 3: Device Footprint',
        age: '45+',
        bracket: '45+ (Tablet / Relaxed Browsing)',
        persona: 'balanced',
        confidence: 65,
        reason: `Tablet device footprint (higher statistical age correlation)`
      };
    }

    return { active: false };
  }

  // --- TIER 4: On-Site Search & Organic Route Semantics ---
  setSearchQuery(query) {
    this.searchQuery = query;
    this.evaluate();
  }

  getSearchAndRouteTier() {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return { active: false };

    // 1. Natural language / conversational queries (Older demographic)
    const isConversational = q.split(' ').length >= 5 || 
      /(how to|make (it|voices) (clear|louder)|hearing|dialogue|easy to connect|television|simple to use|for my ear)/i.test(q);

    if (isConversational) {
      return {
        active: true,
        tier: 'Tier 4: Search Syntax NLP',
        age: '55+',
        bracket: '55+ (Conversational Natural Language)',
        persona: 'simple',
        confidence: 82,
        reason: `Long-form conversational query: "${this.searchQuery}" indicates assistance/comfort focus`
      };
    }

    // 2. Technical specs / acronym-dense queries (Millennial / Tech Enthusiast)
    const isSpecDense = /(anc|ldac|aptx|latency|thd|driver|beryllium|dac|frequency|ohm|hz|khz|bluetooth 5\.)/i.test(q);
    if (isSpecDense) {
      return {
        active: true,
        tier: 'Tier 4: Search Syntax NLP',
        age: '25-42',
        bracket: '25-42 (Technical Specs Enthusiast)',
        persona: 'specs',
        confidence: 84,
        reason: `Acoustic/hardware spec acronyms detected in query: "${this.searchQuery}"`
      };
    }

    // 3. Slang, trends, discount keywords (Gen Z)
    const isTrendOrDeal = /(dupe|viral|aesthetic|cheap|student|discount|tiktok|best under|bass heavy)/i.test(q);
    if (isTrendOrDeal) {
      return {
        active: true,
        tier: 'Tier 4: Search Syntax NLP',
        age: '18-24',
        bracket: '18-24 (Price & Trend Sensitive)',
        persona: 'deals',
        confidence: 80,
        reason: `Trend/bargain vocabulary in query: "${this.searchQuery}"`
      };
    }

    return { active: false };
  }

  // --- TIER 5: Behavioral Biometrics ---
  getBiometricsTier() {
    const { scrollVelocity, mouseJiggleScore } = this.biometrics;
    if (scrollVelocity > 900) {
      return {
        active: true,
        tier: 'Tier 5: Behavioral Biometrics',
        age: '18-30',
        bracket: '18-30 (High-Speed Skimmer)',
        persona: 'deals',
        confidence: 68,
        reason: `Fast scroll velocity (${scrollVelocity}px/s) aligns with mobile-native scanning behavior`
      };
    }
    if (mouseJiggleScore > 40) {
      return {
        active: true,
        tier: 'Tier 5: Behavioral Biometrics',
        age: 'Unknown',
        bracket: 'Indeterminate',
        persona: 'deals',
        confidence: 60,
        reason: `Erratic mouse movement / hesitation indicates hesitation or friction`
      };
    }
    return { active: false };
  }

  // --- TIER 6: LocalStorage Cache ---
  getStoredProfile() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  saveProfile(result) {
    if (!this.hasConsent) return;
    try {
      const payload = {
        tierUsed: result.tierUsed,
        estimatedAge: result.estimatedAge,
        ageBracket: result.ageBracket,
        inferredPersona: result.inferredPersona,
        confidence: result.confidence,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(payload));
    } catch {}
  }

  // --- Master Evaluation Engine ---
  evaluate() {
    // 1. Check Tier 1: Logged In Account
    const t1 = this.getAccountTier();
    if (t1.active) {
      this.setResult(t1.tier, t1.age, t1.bracket, t1.persona, t1.confidence, [t1.reason]);
      return;
    }

    // 2. Check Tier 4: Active Search Query (if user just typed)
    const t4 = this.getSearchAndRouteTier();
    if (t4.active) {
      this.setResult(t4.tier, t4.age, t4.bracket, t4.persona, t4.confidence, [t4.reason]);
      return;
    }

    // 3. Check Tier 2: Marketing UTMs
    const t2 = this.getMarketingTier();
    if (t2.active) {
      this.setResult(t2.tier, t2.age, t2.bracket, t2.persona, t2.confidence, [t2.reason]);
      return;
    }

    // 4. Check Tier 3: Hardware & Accessibility
    const t3 = this.getHardwareTier();
    if (t3.active) {
      this.setResult(t3.tier, t3.age, t3.bracket, t3.persona, t3.confidence, [t3.reason]);
      return;
    }

    // 5. Check Tier 5: Behavioral Biometrics
    const t5 = this.getBiometricsTier();
    if (t5.active) {
      this.setResult(t5.tier, t5.age, t5.bracket, t5.persona, t5.confidence, [t5.reason]);
      return;
    }

    // 6. Check Tier 6: Restored Returning Visitor Profile
    const stored = this.getStoredProfile();
    if (stored && stored.estimatedAge) {
      this.setResult(
        'Tier 6: LocalStorage Returning Profile',
        stored.estimatedAge,
        stored.ageBracket,
        stored.inferredPersona,
        stored.confidence,
        [`Restored from previous session profile (Cached)`]
      );
      return;
    }

    // Default Fallback
    this.setResult(
      'Baseline Fallback',
      '25-45 (Estimated)',
      'General Adult',
      'balanced',
      50,
      ['No strong demographic signals present. Serving neutral baseline balanced layout.']
    );
  }

  setResult(tier, age, bracket, persona, confidence, reasons) {
    this.evaluation = {
      tierUsed: tier,
      estimatedAge: age,
      ageBracket: bracket,
      inferredPersona: persona,
      confidence,
      reasons
    };
    this.saveProfile(this.evaluation);
    this.onUpdate({ ...this.evaluation });
  }

  initBiometrics(scrollContainer) {
    const handleScroll = (scrollY, scrollHeight) => {
      const now = performance.now();
      const deltaY = Math.abs(scrollY - this.lastScrollY);
      const deltaT = (now - this.lastScrollTime) / 1000;
      if (deltaT > 0.05) {
        this.biometrics.scrollVelocity = Math.round(deltaY / deltaT);
        this.lastScrollY = scrollY;
        this.lastScrollTime = now;
      }
      if (this.biometrics.scrollVelocity > 800) {
        this.evaluate();
      }
    };

    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', () => handleScroll(scrollContainer.scrollTop, scrollContainer.scrollHeight), { passive: true });
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BabelAgeAndPersonaEngine;
}
