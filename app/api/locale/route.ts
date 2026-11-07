// Locale endpoints for the header switcher.
//   GET  /api/locale           -> what the current request resolves to
//   POST /api/locale {lang?, demoIp?} -> sets the cookies and returns the new resolution
// Cookies hold only the visitor's own language choice and, for demos, a simulated IP. The real
// visitor IP is read per request and never stored.
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  DEMO_IP_COOKIE, LANG_COOKIE, readClientIp, readCountryHeader, resolveLocale, resolveLocaleFrom,
} from "@/lib/i18n/geo";
import { isLang } from "@/lib/i18n/locales";

const IP_RE = /^[0-9a-fA-F:.]{3,45}$/;
const YEAR = 60 * 60 * 24 * 365;

function current(jar: Awaited<ReturnType<typeof cookies>>, h: Headers) {
  return {
    langCookie: jar.get(LANG_COOKIE)?.value ?? null,
    demoIp: jar.get(DEMO_IP_COOKIE)?.value ?? null,
    country: readCountryHeader(h),
    ip: readClientIp(h),
  };
}

export async function GET() {
  const [jar, h] = await Promise.all([cookies(), headers()]);
  return NextResponse.json(await resolveLocale(current(jar, h)));
}

export async function POST(req: Request) {
  let body: { lang?: unknown; demoIp?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const [jar, h] = await Promise.all([cookies(), headers()]);
  const now = current(jar, h);

  const wantsLang = Object.prototype.hasOwnProperty.call(body, "lang");
  const wantsDemoIp = Object.prototype.hasOwnProperty.call(body, "demoIp");

  if (wantsLang && body.lang !== null && !isLang(body.lang)) {
    return NextResponse.json({ error: "unknown language" }, { status: 400 });
  }
  if (wantsDemoIp && body.demoIp !== null && body.demoIp !== "" && (typeof body.demoIp !== "string" || !IP_RE.test(body.demoIp))) {
    return NextResponse.json({ error: "invalid demo IP" }, { status: 400 });
  }

  const nextLang = wantsLang ? (body.lang as string | null) : now.langCookie;
  const nextDemoIp = wantsDemoIp ? (typeof body.demoIp === "string" && body.demoIp ? body.demoIp : null) : now.demoIp;

  const res = NextResponse.json(resolveLocaleFrom({ ...now, langCookie: nextLang, demoIp: nextDemoIp }));

  if (wantsLang) {
    if (nextLang) res.cookies.set(LANG_COOKIE, nextLang, { path: "/", sameSite: "lax", maxAge: YEAR });
    else res.cookies.delete(LANG_COOKIE);
  }
  if (wantsDemoIp) {
    if (nextDemoIp) res.cookies.set(DEMO_IP_COOKIE, nextDemoIp, { path: "/", sameSite: "lax", maxAge: YEAR });
    else res.cookies.delete(DEMO_IP_COOKIE);
  }
  return res;
}
