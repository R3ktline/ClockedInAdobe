// Where a visitor's language comes from. Pure helpers only (no next/headers), so they can be tested.
//
// Resolution order (first hit wins):
//   1. babel.lang cookie            -> the visitor picked a language themselves
//   2. babel.demo-ip cookie         -> the demo picker simulated a visitor from another country
//   3. CDN country header           -> x-vercel-ip-country / cf-ipcountry / x-country-code
//   4. request IP from the demo table -> lets local demos use a matching X-Forwarded-For
//   5. optional external IP lookup  -> BABEL_IP_LOOKUP=1 only, off by default
//   6. English
//
// The IP is read to pick a language and then thrown away: it is not written to disk, logged or
// attached to a visit. Only the language choice is remembered (cookie `babel.lang`).
import { DEFAULT_LANG, demoCountryForIp, demoPrefixCountryForIp, isLang, langForCountry, type Lang } from "./locales";

export type LocaleSource = "chosen" | "demo-ip" | "header-country" | "request-ip" | "lookup" | "default";

export type LocaleInfo = {
  lang: Lang;
  country: string | null;
  ip: string | null;       // effective visitor IP (real or simulated)
  demoIp: string | null;   // set only when the demo picker is active
  source: LocaleSource;
};

export const LANG_COOKIE = "babel.lang";
export const DEMO_IP_COOKIE = "babel.demo-ip";

// CDN/proxy headers that carry a visitor's country code (uppercase ISO 3166-1 alpha-2).
const COUNTRY_HEADERS = ["x-vercel-ip-country", "cf-ipcountry", "x-country-code", "x-geo-country"];

// Headers that carry the visitor's address, in order of trustworthiness for this demo.
const IP_HEADERS = ["x-forwarded-for", "x-real-ip", "x-vercel-forwarded-for", "cf-connecting-ip"];

export function readCountryHeader(headers: Headers): string | null {
  for (const name of COUNTRY_HEADERS) {
    const value = headers.get(name)?.trim();
    if (value && /^[A-Za-z]{2}$/.test(value)) return value.toUpperCase();
  }
  return null;
}

export function readClientIp(headers: Headers): string | null {
  for (const name of IP_HEADERS) {
    const raw = headers.get(name);
    if (!raw) continue;
    const first = raw.split(",")[0]?.trim();
    if (first) return first.replace(/^\[|\]$/g, "");
  }
  return null;
}

export function isPrivateIp(ip: string | null | undefined): boolean {
  if (!ip) return true;
  const clean = ip.trim().toLowerCase();
  if (clean === "::1" || clean === "::" || clean === "localhost") return true;
  if (clean.startsWith("::ffff:")) return isPrivateIp(clean.slice(7));
  if (clean.includes(":")) return clean.startsWith("fc") || clean.startsWith("fd") || clean.startsWith("fe80");
  const parts = clean.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

// Best-effort public-IP geolocation, only when explicitly enabled. Cached in memory per process.
const lookupCache = new Map<string, { country: string | null; at: number }>();
const LOOKUP_TTL_MS = 6 * 60 * 60_000;
const LOOKUP_TIMEOUT_MS = 1_500;

export async function lookupCountry(ip: string | null): Promise<string | null> {
  if (!ip || isPrivateIp(ip)) return null;
  const hit = lookupCache.get(ip);
  if (hit && Date.now() - hit.at < LOOKUP_TTL_MS) return hit.country;
  const endpoint = (process.env.BABEL_IP_LOOKUP_URL ?? "https://ipapi.co/{ip}/country/").replace("{ip}", encodeURIComponent(ip));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, { signal: controller.signal, headers: { accept: "text/plain" }, cache: "no-store" });
    const text = (await res.text()).trim().toUpperCase();
    const country = res.ok && /^[A-Z]{2}$/.test(text) ? text : null;
    lookupCache.set(ip, { country, at: Date.now() });
    return country;
  } catch {
    lookupCache.set(ip, { country: null, at: Date.now() });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function resolveLocaleFrom(input: {
  langCookie?: string | null;
  demoIp?: string | null;
  country?: string | null;
  ip?: string | null;
  lookupCountry?: string | null; // already fetched, if the caller allowed a lookup
}): LocaleInfo {
  const demoIp = input.demoIp?.trim() || null;
  const realIp = input.ip?.trim() || null;
  const ip = demoIp ?? realIp;

  // 1. An explicit choice always wins.
  if (isLang(input.langCookie)) {
    return { lang: input.langCookie, country: input.country ?? demoCountryForIp(ip)?.country ?? null, ip, demoIp, source: "chosen" };
  }

  // 2. A simulated visitor address.
  const demo = demoCountryForIp(demoIp);
  if (demo) return { lang: demo.lang, country: demo.country, ip, demoIp, source: "demo-ip" };

  // 3. A country the CDN already resolved.
  const country = input.country?.trim().toUpperCase() || null;
  if (country) return { lang: langForCountry(country), country, ip, demoIp, source: "header-country" };

  // 4. The request's own public address against the demo table (local demos).
  if (realIp && !isPrivateIp(realIp)) {
    const fromIp = demoPrefixCountryForIp(realIp);
    if (fromIp) return { lang: fromIp.lang, country: fromIp.country, ip, demoIp, source: "request-ip" };
  }

  // 5. Optional external lookup.
  const looked = input.lookupCountry?.trim().toUpperCase() || null;
  if (looked) return { lang: langForCountry(looked), country: looked, ip, demoIp, source: "lookup" };

  // 6. Every failure has a deterministic fallback.
  return { lang: DEFAULT_LANG, country: country ?? null, ip, demoIp, source: "default" };
}

export async function resolveLocale(input: {
  langCookie?: string | null;
  demoIp?: string | null;
  country?: string | null;
  ip?: string | null;
}): Promise<LocaleInfo> {
  const allowed = process.env.BABEL_IP_LOOKUP === "1";
  const needLookup =
    allowed && !isLang(input.langCookie) && !demoCountryForIp(input.demoIp) && !input.country && !demoPrefixCountryForIp(input.ip);
  const looked = needLookup ? await lookupCountry(input.ip ?? null) : null;
  return resolveLocaleFrom({ ...input, lookupCountry: looked });
}
