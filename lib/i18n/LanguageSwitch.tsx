"use client";
// The shopper's language control, plus the demo's simulated-IP picker.
// Changing either writes a cookie through /api/locale and reloads, so the server re-renders the
// whole storefront in the new language.
import { useEffect, useRef, useState } from "react";
import { useI18n } from "./I18nProvider";
import { DEMO_IPS, LANGS } from "./locales";

function Globe() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </svg>
  );
}

export function LanguageSwitch() {
  const { lang, t, country, demoIp, switchLang, switchDemoIp } = useI18n();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [open]);

  const pick = "rounded-full border px-2.5 py-1 text-sm font-semibold transition-colors";
  const on = "border-[var(--c-primary)] bg-[var(--c-primary)] text-white";
  const off = "border-black/15 text-[#14171f] hover:bg-black/5";

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t("lang.title")}
        className="flex items-center gap-1.5 rounded-full border border-white/40 px-2.5 py-1 text-sm font-bold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <Globe />
        {current.code.toUpperCase()}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t("lang.title")}
          className="absolute right-0 top-full z-[60] mt-2 w-[19rem] max-w-[calc(100vw-2rem)] rounded-xl border border-black/10 bg-white p-3 text-[#14171f] shadow-xl"
          style={{ fontSize: 15 }}
        >
          <p className="font-semibold">{t("lang.title")}</p>
          <p className="mt-0.5 text-xs text-[#5b6170]">{t("lang.hint")}</p>

          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={t("lang.label")}>
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                aria-pressed={l.code === lang}
                onClick={() => switchLang(l.code)}
                className={`${pick} ${l.code === lang ? on : off}`}
              >
                {l.native}
              </button>
            ))}
            <button type="button" onClick={() => switchLang(null)} className={`${pick} ${off}`}>
              {t("lang.auto")}
            </button>
          </div>

          <div className="mt-3 border-t border-black/10 pt-3">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              {t("lang.demo")}
              <select
                value={demoIp ?? ""}
                onChange={(e) => switchDemoIp(e.target.value || null)}
                className="rounded-[var(--babel-radius)] border border-black/20 bg-white px-2 py-1.5 text-sm font-normal"
              >
                <option value="">{t("lang.auto")}</option>
                {DEMO_IPS.map((entry) => (
                  <option key={entry.ip} value={entry.ip}>
                    {entry.label} · {entry.ip}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-xs text-[#5b6170]">
              {t("lang.current", { country: country ?? "—", lang: current.native })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
