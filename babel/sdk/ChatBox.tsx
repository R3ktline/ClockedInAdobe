"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useBabel } from "./BabelProvider";

type Msg = { from: "you" | "babel"; text: string };

function BabelIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
      <path d="M9 10.5h6M9 14h3.5" />
    </svg>
  );
}

// A small chat with Babel. The shopper types how they want the page ("show me returns first"); Babel answers by
// re-composing it from the store's own blocks. Babel also speaks first: when it changes the page on its own,
// it says so here. It never writes page content.
export function ChatBox() {
  const { chat, visitId, slides, ghost } = useBabel();
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(() => [{ from: "babel", text: t("chat.hello") }]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState<string | null>(null); // Babel's latest unprompted message while the chat is closed
  const busyRef = useRef(false);
  const openRef = useRef(false);
  const seen = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  openRef.current = open;

  // A new slide the shopper did not ask for = Babel's own initiative. Say what it did, in its own words.
  useEffect(() => {
    const n = slides.length;
    if (seen.current && n > seen.current && !busyRef.current) {
      const said = slides[n - 1].rationale;
      setMsgs((m) => [...m, { from: "babel", text: said }]);
      if (!openRef.current) setUnread(said);
    }
    seen.current = n;
  }, [slides]);

  useEffect(() => { end.current?.scrollIntoView?.({ block: "end" }); }, [msgs, open]);

  const ask = async (raw: string) => {
    const message = raw.trim();
    if (!message || busyRef.current) return;
    busyRef.current = true;
    setText("");
    setBusy(true);
    setMsgs((m) => [...m, { from: "you", text: message }]);
    const reply = await chat(message);
    setMsgs((m) => [...m, { from: "babel", text: reply }]);
    busyRef.current = false;
    setBusy(false);
  };

  const show = () => { setOpen(true); setUnread(null); };
  // In the lab the left side is the indicators panel, so the chat moves next to it.
  const pos = ghost?.lab ? "left-[386px]" : "left-4";

  return (
    <div className={`fixed bottom-4 ${pos} z-50 max-w-[calc(100vw-2rem)]`} style={{ fontSize: 15 }}>
      {!open ? (
        <div className="flex items-end gap-2">
          <button onClick={show} disabled={!visitId} aria-label={unread ? t("chat.openUnread") : t("chat.open")}
            className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--c-primary)] text-white shadow-lg disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-primary)]">
            <BabelIcon size={24} />
            {unread && <span className="absolute top-0 right-0 size-3 rounded-full border-2 border-white bg-amber-400" />}
          </button>
          {unread && (
            <button onClick={show} className="max-w-64 rounded-2xl rounded-bl-sm border border-black/10 bg-white px-3 py-2 text-left text-[#14171f] shadow-lg">
              <span className="block text-xs font-semibold text-[#5b6170]">Babel</span>
              <span className="line-clamp-3">{unread}</span>
            </button>
          )}
        </div>
      ) : (
        <section aria-label={t("chat.title")} className="flex max-h-[min(30rem,calc(100vh-2rem))] w-80 max-w-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-white text-[#14171f] shadow-xl">
          <header className="flex items-center gap-2 bg-[var(--c-primary)] px-3 py-2 text-white">
            <span className="flex size-8 items-center justify-center rounded-full bg-white/20"><BabelIcon /></span>
            <span className="flex-1 font-semibold">Babel</span>
            <button type="button" onClick={() => setOpen(false)} aria-label={t("chat.close")} className="rounded px-2 text-lg leading-none hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white">×</button>
          </header>
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto bg-[#f3f5fb] p-3" role="log" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={`flex items-end gap-1.5 ${m.from === "you" ? "justify-end" : ""}`}>
                {m.from === "babel" && <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--c-primary)] text-white"><BabelIcon size={14} /></span>}
                <p className={`max-w-[80%] rounded-2xl px-3 py-2 ${m.from === "you" ? "rounded-br-sm bg-[var(--c-primary)] text-white" : "rounded-bl-sm bg-white"}`}>{m.text}</p>
              </div>
            ))}
            {busy && <p className="pl-8 text-xs text-[#5b6170]">{t("chat.thinking")}</p>}
            <div ref={end} />
          </div>
          {msgs.length === 1 && (
            <div className="flex flex-wrap gap-1.5 border-t border-black/10 px-3 pt-2">
              {[t("chat.suggestion1"), t("chat.suggestion2")].map((s) => (
                <button key={s} onClick={() => ask(s)} disabled={busy} className="rounded-full border border-black/15 px-2.5 py-1 text-xs hover:bg-black/5 disabled:opacity-40">{s}</button>
              ))}
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); ask(text); }} className="flex gap-2 p-3">
            <label htmlFor="babel-chat" className="sr-only">{t("chat.inputLabel")}</label>
            <input id="babel-chat" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} autoComplete="off" placeholder={t("chat.placeholder")}
              className="min-w-0 flex-1 rounded-full border border-black/20 px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-[var(--c-primary)]" />
            <button type="submit" disabled={busy || !text.trim()} className="rounded-full bg-[var(--c-primary)] px-3 py-1.5 font-semibold text-white disabled:opacity-40">{t("chat.send")}</button>
          </form>
        </section>
      )}
    </div>
  );
}
