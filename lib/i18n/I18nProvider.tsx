"use client";
// The visitor's language, resolved on the server and handed to the client tree.
// Switching writes a cookie (through /api/locale) and reloads, so the very next paint is already in
// the new language: no flash of English, no client-side string swapping after hydration.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { translate, type Vars } from "./dictionaries";
import type { LocaleInfo } from "./geo";
import { DEFAULT_LANG, LOCALE_TAG, type Lang } from "./locales";

type I18n = {
  lang: Lang;
  tag: string;             // Intl tag matching the language
  country: string | null;
  demoIp: string | null;
  source: LocaleInfo["source"];
  t: (key: string, vars?: Vars, fallback?: string) => string;
  switchLang: (lang: Lang | null) => Promise<void>;
  switchDemoIp: (ip: string | null) => Promise<void>;
};

const fallback: I18n = {
  lang: DEFAULT_LANG,
  tag: LOCALE_TAG[DEFAULT_LANG],
  country: null,
  demoIp: null,
  source: "default",
  t: (key, vars, fb) => translate(DEFAULT_LANG, key, vars, fb),
  switchLang: async () => {},
  switchDemoIp: async () => {},
};

const Ctx = createContext<I18n>(fallback);

async function post(body: { lang?: Lang | null; demoIp?: string | null }) {
  await fetch("/api/locale", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
}

export function I18nProvider({ info, children }: { info: LocaleInfo; children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(info.lang);
  const [demoIp, setDemoIp] = useState<string | null>(info.demoIp);

  const t = useCallback(
    (key: string, vars?: Vars, fb?: string) => translate(lang, key, vars, fb),
    [lang],
  );

  const switchLang = useCallback(async (next: Lang | null) => {
    if (next) setLang(next);
    await post({ lang: next });
    if (typeof location !== "undefined") location.reload();
  }, []);

  const switchDemoIp = useCallback(async (ip: string | null) => {
    setDemoIp(ip);
    // A simulated visitor should be decided by the IP, so drop any earlier manual choice.
    await post({ demoIp: ip, lang: null });
    if (typeof location !== "undefined") location.reload();
  }, []);

  const value = useMemo<I18n>(
    () => ({ lang, tag: LOCALE_TAG[lang], country: info.country, demoIp, source: info.source, t, switchLang, switchDemoIp }),
    [lang, info.country, info.source, demoIp, t, switchLang, switchDemoIp],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  return useContext(Ctx);
}
