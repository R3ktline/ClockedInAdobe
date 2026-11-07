import { describe, expect, it } from "vitest";
import { DICTIONARIES, ENGLISH_KEYS, translate } from "./dictionaries";
import {
  demoCountryForIp, isLang, langForCountry, LANGS, LANG_CODES, LOCALE_TAG,
} from "./locales";
import {
  DEMO_IP_COOKIE, LANG_COOKIE, isPrivateIp, readClientIp, readCountryHeader, resolveLocale,
  resolveLocaleFrom,
} from "./geo";
import { describeDiff } from "@/babel/schema/diff";
import type { Slide } from "@/babel/schema";

const headers = (pairs: Record<string, string>) => new Headers(pairs);

describe("country to language", () => {
  it("maps the supported countries to their language", () => {
    expect(langForCountry("RO")).toBe("ro");
    expect(langForCountry("de")).toBe("de");
    expect(langForCountry("FR")).toBe("fr");
    expect(langForCountry("ES")).toBe("es");
    expect(langForCountry("IT")).toBe("it");
  });

  it("keeps everyone else in English", () => {
    expect(langForCountry("US")).toBe("en");
    expect(langForCountry("GB")).toBe("en");
    expect(langForCountry("JP")).toBe("en");
    expect(langForCountry("ZZ")).toBe("en");
    expect(langForCountry(null)).toBe("en");
  });

  it("has a native name and an Intl tag for every language", () => {
    for (const lang of LANGS) {
      expect(lang.native.length).toBeGreaterThan(0);
      expect(LOCALE_TAG[lang.code]).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    }
    expect(LANG_CODES).toEqual(["en", "ro", "de", "fr", "es", "it"]);
    expect(isLang("ro")).toBe(true);
    expect(isLang("xx")).toBe(false);
    expect(isLang(undefined)).toBe(false);
  });
});

describe("demo IPs", () => {
  it("resolves the documented demo prefixes", () => {
    expect(demoCountryForIp("86.120.10.20")).toEqual({ country: "RO", lang: "ro" });
    expect(demoCountryForIp("91.64.20.30")).toEqual({ country: "DE", lang: "de" });
    expect(demoCountryForIp("92.184.30.40")).toEqual({ country: "FR", lang: "fr" });
    expect(demoCountryForIp("88.0.40.50")).toEqual({ country: "ES", lang: "es" });
    expect(demoCountryForIp("151.0.50.60")).toEqual({ country: "IT", lang: "it" });
    expect(demoCountryForIp("8.8.8.8")).toEqual({ country: "US", lang: "en" });
  });

  it("does not guess for an unknown address", () => {
    expect(demoCountryForIp("203.0.113.9")).toBeNull();
    expect(demoCountryForIp("")).toBeNull();
    expect(demoCountryForIp(null)).toBeNull();
  });

  it("treats loopback, private and link-local addresses as private", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.1.10", "172.20.0.1", "169.254.1.1", "::1", "fe80::1", "fd00::1", "100.64.0.1", "not-an-ip", null]) {
      expect(isPrivateIp(ip), String(ip)).toBe(true);
    }
    expect(isPrivateIp("86.120.10.20")).toBe(false);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
  });
});

describe("request headers", () => {
  it("reads the first supported country header", () => {
    expect(readCountryHeader(headers({ "cf-ipcountry": "ro" }))).toBe("RO");
    expect(readCountryHeader(headers({ "x-vercel-ip-country": "de", "cf-ipcountry": "fr" }))).toBe("DE");
    expect(readCountryHeader(headers({ "cf-ipcountry": "not-a-code" }))).toBeNull();
    expect(readCountryHeader(headers({}))).toBeNull();
  });

  it("takes the first address from X-Forwarded-For", () => {
    expect(readClientIp(headers({ "x-forwarded-for": "86.120.10.20, 10.0.0.1" }))).toBe("86.120.10.20");
    expect(readClientIp(headers({ "x-real-ip": "91.64.20.30" }))).toBe("91.64.20.30");
    expect(readClientIp(headers({ "cf-connecting-ip": "92.184.30.40" }))).toBe("92.184.30.40");
    expect(readClientIp(headers({}))).toBeNull();
  });
});

describe("locale resolution order", () => {
  it("lets an explicit language choice win over everything", () => {
    const info = resolveLocaleFrom({ langCookie: "fr", demoIp: "91.64.20.30", country: "DE", ip: "91.64.20.30" });
    expect(info).toMatchObject({ lang: "fr", source: "chosen" });
  });

  it("uses the simulated IP before the CDN country header", () => {
    const info = resolveLocaleFrom({ demoIp: "88.0.40.50", country: "DE", ip: "91.64.20.30" });
    expect(info).toMatchObject({ lang: "es", country: "ES", source: "demo-ip", demoIp: "88.0.40.50" });
  });

  it("uses the country header when there is no demo IP", () => {
    const info = resolveLocaleFrom({ country: "IT", ip: "8.8.8.8" });
    expect(info).toMatchObject({ lang: "it", country: "IT", source: "header-country" });
  });

  it("matches a public request IP against the demo table", () => {
    const info = resolveLocaleFrom({ ip: "86.120.44.1" });
    expect(info).toMatchObject({ lang: "ro", country: "RO", source: "request-ip" });
  });

  it("never language-matches loopback or private addresses", () => {
    expect(resolveLocaleFrom({ ip: "127.0.0.1" })).toMatchObject({ lang: "en", source: "default" });
    expect(resolveLocaleFrom({ ip: "192.168.0.5" })).toMatchObject({ lang: "en", source: "default" });
    expect(resolveLocaleFrom({})).toMatchObject({ lang: "en", source: "default" });
  });

  it("uses an external lookup result when one was allowed", () => {
    expect(resolveLocaleFrom({ ip: "8.8.8.8", lookupCountry: "fr" })).toMatchObject({ lang: "fr", source: "lookup" });
  });

  it("keeps the lookup off unless asked for", async () => {
    const info = await resolveLocale({ ip: "8.8.8.8" });
    expect(info.source).toBe("default");
  });

  it("does not require cookies or a network to answer", () => {
    expect(LANG_COOKIE).toBe("babel.lang");
    expect(DEMO_IP_COOKIE).toBe("babel.demo-ip");
  });
});

describe("dictionaries", () => {
  it("cover every English key in every language", () => {
    for (const lang of LANG_CODES) {
      const missing = ENGLISH_KEYS.filter((key) => !DICTIONARIES[lang][key]);
      expect(missing, `${lang} is missing ${missing.join(", ")}`).toEqual([]);
    }
  });

  it("only contains keys the English source knows", () => {
    for (const lang of LANG_CODES) {
      const extra = Object.keys(DICTIONARIES[lang]).filter((key) => !(key in DICTIONARIES.en));
      expect(extra, `${lang} has stray keys ${extra.join(", ")}`).toEqual([]);
    }
  });

  it("interpolates variables and leaves unknown placeholders alone", () => {
    expect(translate("ro", "common.reviews", { count: 12 })).toBe("12 recenzii");
    expect(translate("de", "control.whatChanged", { from: 1, to: 2 })).toContain("1 → 2");
    expect(translate("en", "common.reviews", {})).toBe("{count} reviews");
  });

  it("falls back to English, then to the caller's fallback, then to the key", () => {
    expect(translate("xx" as never, "hero.eyebrow")).toBe(DICTIONARIES.en["hero.eyebrow"]);
    expect(translate("it", "no.such.key", undefined, "plain")).toBe("plain");
    expect(translate("it", "no.such.key")).toBe("no.such.key");
  });

  it("translates the shopper-facing diff lines too", () => {
    const prev = { blocks: [], persona: { dialect: "guided", need: "trust" }, copyRegister: "plain", theme: {} } as unknown as Slide;
    const next = {
      blocks: [],
      persona: { dialect: "dense", need: "trust" },
      copyRegister: "plain",
      theme: {},
    } as unknown as Slide;
    expect(describeDiff(prev, next, {}, (key, vars) => translate("ro", key, vars))).toEqual([
      "stilul vederii: guided → dense",
    ]);
    expect(describeDiff(prev, next)).toEqual(["view style: guided → dense"]);
  });
});
