"use client";
// The Concierge chat (AI Act Art. 50: labelled as an AI). Answers come from the catalog; a request about the page
// ("simpler", "bigger photos", "show returns first") changes the open page at once, because the shopper asked.
import { useEffect, useRef, useState } from "react";
import { useBabel } from "./BabelProvider";

const EXAMPLES = ["Make the page simpler", "What is the warranty?", "Show me cheaper options", "Bigger photos please"];

export function ChatPanel() {
  const { chatOpen, setChatOpen, chatLog, ask, view } = useBabel();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [chatLog]);
  if (!chatOpen) return null;
  const send = async (m: string) => {
    if (!m.trim() || busy) return;
    setBusy(true); setText("");
    try { await ask(m.trim()); } finally { setBusy(false); }
  };
  return (
    <aside aria-label="AI shopping assistant" className="babel-ui fixed right-3 bottom-16 z-[70] flex max-h-[70vh] w-[min(380px,calc(100vw-24px))] flex-col rounded-xl bg-white text-[14px] text-[#14171f] shadow-2xl ring-1 ring-black/10">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3">
        <p className="font-bold">AI assistant <span className="ml-1 rounded-full bg-[#14171f] px-2 py-0.5 text-[11px] font-bold text-white">AI</span></p>
        <button aria-label="Close the assistant" onClick={() => setChatOpen(false)} className="rounded px-2 text-lg leading-none hover:bg-black/5">×</button>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3" aria-live="polite">
        {chatLog.length === 0 && (
          <>
            <p className="text-[#3d4352]">I am an AI. I answer from this store's catalog and can change how this page looks. I can't change prices.</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((e) => <button key={e} onClick={() => void send(e)} disabled={view.kind === "standard" && /simpler|bigger/i.test(e)} className="rounded-full border border-black/15 px-3 py-1 text-[13px] hover:bg-black/5 disabled:opacity-40">{e}</button>)}
            </div>
          </>
        )}
        {chatLog.map((m, i) => (
          <div key={i} className={m.from === "you" ? "ml-8 rounded-lg bg-[#eef0f6] px-3 py-2" : "mr-8 rounded-lg border border-black/10 px-3 py-2"}>
            <p className="text-[11px] font-bold text-[#5b6170]">{m.from === "you" ? "You" : "AI assistant"}</p>
            <p>{m.text}</p>
            {m.note && <p className="mt-1 text-[11px] text-[#5b6170]">{m.note}</p>}
          </div>
        ))}
        {busy && <p className="text-[#5b6170]">Thinking…</p>}
        <div ref={end} />
      </div>
      <form className="flex gap-2 border-t border-black/10 p-3" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
        <label className="sr-only" htmlFor="babel-chat">Ask the AI assistant</label>
        <input id="babel-chat" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Ask about a product or the page…" className="min-w-0 flex-1 rounded-lg border border-black/20 px-3 py-2" />
        <button disabled={busy || !text.trim()} className="rounded-lg bg-[#14171f] px-3 py-2 font-semibold text-white disabled:opacity-40">Send</button>
      </form>
    </aside>
  );
}
