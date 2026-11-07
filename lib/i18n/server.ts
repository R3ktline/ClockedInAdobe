// Server-side locale resolution: reads the request cookies and CDN headers and reaches the same
// decision as the pure helpers in ./geo. Reads happen per request; nothing is persisted except the
// visitor's own language choice (`babel.lang`) and, in demos, a simulated IP (`babel.demo-ip`).
import { cookies, headers } from "next/headers";
import {
  DEMO_IP_COOKIE, LANG_COOKIE, readClientIp, readCountryHeader, resolveLocale, type LocaleInfo,
} from "./geo";

export async function localeFromRequest(): Promise<LocaleInfo> {
  const [jar, h] = await Promise.all([cookies(), headers()]);
  return resolveLocale({
    langCookie: jar.get(LANG_COOKIE)?.value ?? null,
    demoIp: jar.get(DEMO_IP_COOKIE)?.value ?? null,
    country: readCountryHeader(h),
    ip: readClientIp(h),
  });
}
