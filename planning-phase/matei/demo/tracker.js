/**
 * Standalone User Data & Telemetry Collector
 * Captures:
 * 1. Account Profile (if present)
 * 2. Pre-Arrival (UTMs & Referrer)
 * 3. Environmental (Device, Screen, Timezone, Local Time, IP Geo & Weather)
 * 4. Behavioral Biometrics (Cursor Jiggle/Tracking, Scroll Velocity, Scroll Depth, First-Action Latency)
 * 5. Stores everything in localStorage
 */

class UserDataCollector {
  constructor(options = {}) {
    this.storageKey = options.storageKey || 'user_telemetry_profile';
    this.startTime = performance.now();
    this.firstActionTime = null;

    // The complete data store
    this.data = {
      // 1. Account (if logged in)
      account: options.currentUser || null, // e.g. { id: 101, name: "Alice", age: 19 }

      // 2. Pre-Arrival (URL & Referrer)
      preArrival: this.extractPreArrival(),

      // 3. Environmental (Millisecond 0)
      environmental: this.extractEnvironmental(),

      // 4. Behavioral Biometrics (Real-Time)
      biometrics: {
        timeToFirstActionMs: null,
        scrollVelocityPxPerSec: 0,
        maxScrollDepthPercent: 0,
        cursorJiggleScore: 0, // 0 to 100 (urgency / frustration)
        totalClicks: 0
      },

      lastUpdated: new Date().toISOString()
    };

    // Internal trackers
    this.lastScrollY = window.scrollY;
    this.lastScrollTime = performance.now();
    this.mouseCoords = [];

    this.initListeners();
    this.fetchGeoAndWeather(); // Async IP & weather lookup
    this.save();
  }

  // --- 2. Pre-Arrival UTM Extraction ---
  extractPreArrival() {
    const params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get('utm_source') || 'direct',
      utm_medium: params.get('utm_medium') || 'none',
      utm_campaign: params.get('utm_campaign') || 'none',
      utm_content: params.get('utm_content') || 'none',
      referrer: document.referrer || 'direct'
    };
  }

  // --- 3. Instant Environmental Data ---
  extractEnvironmental() {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    return {
      deviceType: isMobile ? 'Mobile' : (window.innerWidth < 1024 ? 'Tablet' : 'Desktop'),
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language || 'en-US',
      localTime: new Date().toLocaleTimeString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      osScalingDetected: window.devicePixelRatio > 1.25,
      geo: { city: 'Pending...', country: 'Pending...', weather: 'Pending...', ip: 'Pending...' }
    };
  }

  // --- Server-Side / Free API Geo & Weather Enrichment ---
  async fetchGeoAndWeather() {
    try {
      // 1. Get approximate IP & Location (free API)
      const ipRes = await fetch('https://ipapi.co/json/');
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        this.data.environmental.geo.ip = ipData.ip;
        this.data.environmental.geo.city = ipData.city;
        this.data.environmental.geo.country = ipData.country_name;

        // 2. Get Weather via Open-Meteo using coords
        const lat = ipData.latitude;
        const lon = ipData.longitude;
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        if (weatherRes.ok) {
          const wData = await weatherRes.json();
          this.data.environmental.geo.weather = `${wData.current_weather.temperature}°C`;
        }
      }
    } catch (e) {
      // Fallback if blocked by ad-blocker / offline
      this.data.environmental.geo = { city: 'Bucharest', country: 'Romania', weather: '14°C', ip: 'Simulated' };
    }
    this.save();
  }

  // --- 4. Behavioral Biometrics Listeners ---
  initListeners() {
    const recordFirstAction = () => {
      if (this.firstActionTime === null) {
        this.firstActionTime = Math.round(performance.now() - this.startTime);
        this.data.biometrics.timeToFirstActionMs = this.firstActionTime;
      }
    };

    // A. Scroll Velocity & Depth
    window.addEventListener('scroll', () => {
      recordFirstAction();
      const now = performance.now();
      const deltaY = Math.abs(window.scrollY - this.lastScrollY);
      const deltaTime = (now - this.lastScrollTime) / 1000;

      if (deltaTime > 0.05) {
        this.data.biometrics.scrollVelocityPxPerSec = Math.round(deltaY / deltaTime);
        this.lastScrollY = window.scrollY;
        this.lastScrollTime = now;
      }

      const totalDocHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalDocHeight > 0) {
        const currentDepth = Math.min(100, Math.round((window.scrollY / totalDocHeight) * 100));
        if (currentDepth > this.data.biometrics.maxScrollDepthPercent) {
          this.data.biometrics.maxScrollDepthPercent = currentDepth;
        }
      }
      this.save();
    }, { passive: true });

    // B. Cursor Movement & Jiggle Detection
    window.addEventListener('mousemove', (e) => {
      recordFirstAction();
      const now = performance.now();
      this.mouseCoords.push({ x: e.clientX, y: e.clientY, time: now });
      if (this.mouseCoords.length > 15) this.mouseCoords.shift();

      if (this.mouseCoords.length >= 6) {
        let directionReversals = 0;
        let totalDistance = 0;

        for (let i = 2; i < this.mouseCoords.length; i++) {
          const dx1 = this.mouseCoords[i - 1].x - this.mouseCoords[i - 2].x;
          const dx2 = this.mouseCoords[i].x - this.mouseCoords[i - 1].x;
          // Detected horizontal zig-zag
          if ((dx1 > 0 && dx2 < 0) || (dx1 < 0 && dx2 > 0)) {
            directionReversals++;
          }
          totalDistance += Math.hypot(dx2, this.mouseCoords[i].y - this.mouseCoords[i - 1].y);
        }

        // Rapid zig-zag cursor shaking = frustration / urgency
        if (directionReversals >= 3 && totalDistance > 130) {
          this.data.biometrics.cursorJiggleScore = Math.min(100, this.data.biometrics.cursorJiggleScore + 15);
        } else {
          this.data.biometrics.cursorJiggleScore = Math.max(0, this.data.biometrics.cursorJiggleScore - 1);
        }
      }
      this.save();
    });

    // C. Click Counter
    window.addEventListener('click', () => {
      recordFirstAction();
      this.data.biometrics.totalClicks++;
      this.save();
    });
  }

  // --- 5. Storage ---
  save() {
    this.data.lastUpdated = new Date().toISOString();
    localStorage.setItem(this.storageKey, JSON.stringify(this.data));
  }

  // Helper to read stored data
  static getStoredData(key = 'user_telemetry_profile') {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }
}
