// The languages the storefront can speak, and how a visitor's country maps to one.
// Kept dependency-free so the dictionary/geo tests can import it directly.

export const LANGS = [
  { code: "en", name: "English", native: "English" },
  { code: "ro", name: "Romanian", native: "Română" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "fr", name: "French", native: "Français" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "it", name: "Italian", native: "Italiano" },
] as const;

export type Lang = (typeof LANGS)[number]["code"];
export const DEFAULT_LANG: Lang = "en";
export const LANG_CODES: readonly Lang[] = LANGS.map((l) => l.code);

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANG_CODES as readonly string[]).includes(value);
}

// BCP 47 tag for Intl date formatting (guaranteed to exist, unlike bare language codes in some runtimes).
export const LOCALE_TAG: Record<Lang, string> = {
  en: "en-GB", ro: "ro-RO", de: "de-DE", fr: "fr-FR", es: "es-ES", it: "it-IT",
};

// Countries that get a translated storefront. Everything else stays English.
export const COUNTRY_LANG: Record<string, Lang> = {
  RO: "ro",
  MD: "ro",
  DE: "de", AT: "de", CH: "de", LI: "de", LU: "de",
  FR: "fr", BE: "fr", MC: "fr",
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", UY: "es", VE: "es",
  IT: "it", SM: "it", VA: "it",
  GB: "en", IE: "en", US: "en", CA: "en", AU: "en", NZ: "en", NL: "en", SE: "en", NO: "en", DK: "en", FI: "en", PL: "en", PT: "en", BR: "en", JP: "en", IN: "en",
};

export function langForCountry(country: string | null | undefined): Lang {
  if (!country) return DEFAULT_LANG;
  return COUNTRY_LANG[country.trim().toUpperCase()] ?? DEFAULT_LANG;
}

// Demo IPs: real-looking public prefixes, one per supported language. Matching is a prefix match so
// a whole /16-ish demo range resolves the same way. Used when the browser sends a fake visitor IP
// (the in-app "Simulated IP (demo)" picker) or a request carries a matching X-Forwarded-For.
export const DEMO_IPS = [
  { ip: "86.120.10.20", country: "RO", lang: "ro", label: "Romania" },
  { ip: "91.64.20.30", country: "DE", lang: "de", label: "Germany" },
  { ip: "92.184.30.40", country: "FR", lang: "fr", label: "France" },
  { ip: "88.0.40.50", country: "ES", lang: "es", label: "Spain" },
  { ip: "151.0.50.60", country: "IT", lang: "it", label: "Italy" },
  { ip: "8.8.8.8", country: "US", lang: "en", label: "United States" },
] as const;

export const DEMO_IP_PREFIXES: ReadonlyArray<{ prefix: string; country: string; lang: Lang }> = [
  { prefix: "86.120.", country: "RO", lang: "ro" },
  { prefix: "79.112.", country: "RO", lang: "ro" },
  { prefix: "188.24.", country: "RO", lang: "ro" },
  { prefix: "91.64.", country: "DE", lang: "de" },
  { prefix: "84.1.", country: "DE", lang: "de" },
  { prefix: "92.184.", country: "FR", lang: "fr" },
  { prefix: "90.85.", country: "FR", lang: "fr" },
  { prefix: "88.0.", country: "ES", lang: "es" },
  { prefix: "81.2.", country: "ES", lang: "es" },
  { prefix: "151.0.", country: "IT", lang: "it" },
  { prefix: "79.10.", country: "IT", lang: "it" },
];

export function demoCountryForIp(ip: string | null | undefined): { country: string; lang: Lang } | null {
  if (!ip) return null;
  const clean = ip.trim();
  const exact = DEMO_IPS.find((entry) => entry.ip === clean);
  if (exact) return { country: exact.country, lang: exact.lang };
  return demoPrefixCountryForIp(clean);
}

// Prefix-only variant: used for a real request address, where matching a single demo address
// (such as 8.8.8.8, a public resolver) must not count as a visitor.
export function demoPrefixCountryForIp(ip: string | null | undefined): { country: string; lang: Lang } | null {
  if (!ip) return null;
  const clean = ip.trim();
  const hit = DEMO_IP_PREFIXES.find((p) => clean.startsWith(p.prefix));
  return hit ? { country: hit.country, lang: hit.lang } : null;
}
