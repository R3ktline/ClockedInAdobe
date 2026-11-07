"use client";
import { useMemo, useState } from "react";
import { memoryKey } from "@/babel/sdk/LabPanel";
import { Category, BrandKit, Registry, type InteractionEvent } from "@/babel/schema";
import { SIGNALS, THRESHOLD, TRAIT_NAMES, TRAITS } from "@/babel/persona/signalModel";
import { BLANK, memoryOf, pageAfter, readAfter, templateOf, type Setup } from "@/babel/session/simulate";
import type { Shopper } from "@/data/shoppers";
import { storeConfigs } from "@/stores";

const cfg = { brand: BrandKit.parse(storeConfigs.taraba.brand), registry: Registry.parse(storeConfigs.taraba.registry) };

type Ev = Omit<InteractionEvent, "t">;
// What a shopper can do, grouped. Each button appends one event to the timeline.
const PALETTE: [group: string, items: [label: string, ev: (product?: string) => Ev][]][] = [
  ["Looking", [
    ["Swipe gallery", (p) => ({ type: "gallery_swipe", blockId: "gallery", productId: p })],
    ["Zoom a photo", (p) => ({ type: "image_zoom", blockId: "gallery", productId: p })],
    ["Fast scroll", () => ({ type: "scroll", value: "fast" })],
    ["Slow scroll", () => ({ type: "scroll", value: "slow" })],
    ["View, open nothing", (p) => ({ type: "page_view", productId: p })],
  ]],
  ["Reading detail", [
    ["Open specs", (p) => ({ type: "block_open", blockId: "specs", productId: p })],
    ["Read specs 9 s", (p) => ({ type: "block_dwell", blockId: "specs", productId: p, value: 9000 })],
    ["Add to compare", (p) => ({ type: "compare_add", productId: p })],
    ["Technical filter", () => ({ type: "filter", value: "ram-16gb" })],
  ]],
  ["Search and price", [
    ["Search “16GB DDR5”", () => ({ type: "search", value: "16GB DDR5" })],
    ["Search “good TV for my mum”", () => ({ type: "search", value: "good TV for my mum" })],
    ["Search “cheapest under 500 lei”", () => ({ type: "search", value: "cheapest under 500 lei" })],
    ["Sort by price", () => ({ type: "sort", value: "price_asc" })],
    ["Filter by price", () => ({ type: "filter", value: "price<500" })],
  ]],
  ["Checking trust", [
    ["Open reviews", (p) => ({ type: "review_open", blockId: "trust", productId: p })],
    ["Open delivery", (p) => ({ type: "policy_open", blockId: "trust", productId: p, value: "delivery" })],
    ["Open returns", (p) => ({ type: "policy_open", blockId: "trust", productId: p, value: "returns" })],
    ["Open warranty", (p) => ({ type: "policy_open", blockId: "trust", productId: p, value: "warranty" })],
  ]],
  ["Struggling", [
    ["Mis-tap", () => ({ type: "mis_tap" })],
    ["Dead click", () => ({ type: "dead_click" })],
    ["Go back", () => ({ type: "back_nav" })],
  ]],
  ["Deciding", [
    ["Add to cart", (p) => ({ type: "add_to_cart", blockId: "buyBox", productId: p })],
    ["Start checkout", () => ({ type: "checkout_start" })],
  ]],
];

const SOURCES = ["", "pinterest", "instagram", "tiktok", "price-compare", "review-site", "google"];
const INTENTS = ["", "deal", "gift", "specs", "new-season"];
const AGE_BANDS = ["", "minor", "18-34", "35-54", "55+"];
const FORMATS = ["", ...(["guided", "standard", "dense", "visual"] as const).flatMap((d) => (["balanced", "specs", "deals", "inspiration", "reassurance", "quick"] as const).map((n) => `${d}.${n}`))];
const LABEL: Record<string, string> = {
  infoAppetite: "Wants detail", jargonComfort: "Comfortable with technical words", priceSensitivity: "Price matters",
  trustNeed: "Needs reassurance", inspirationAppetite: "Browses by photos", interactionFluency: "At ease with the site", confusion: "Seems lost",
};

const describe = (e: Ev) => `${e.type}${e.value !== undefined ? ` · ${e.value}` : ""}${e.blockId ? ` (${e.blockId})` : ""}`;
const withTimes = (evs: Ev[]): InteractionEvent[] => evs.map((e, i) => ({ ...e, t: i * 2500 }));

type Preset = Shopper;
function fromShopper(s: Preset, returning: boolean): Setup {
  const p = s.partner, a = p.account;
  const base: Setup = {
    ...BLANK, personalization: p.consent.personalization, partnerData: p.consent.partnerData,
    utm: p.campaign?.utmSource ?? "", intent: p.campaign?.intentTag ?? "", orders: a?.orderCategories ?? [],
    largeText: !!a?.accessibility?.largeText, highContrast: !!a?.accessibility?.highContrast, reducedMotion: !!a?.accessibility?.reducedMotion,
    ageBand: a?.ageBand ?? "",
  };
  if (!returning || !s.revisit) return { ...base, returning: p.visitor.returning, visits: p.visitor.visits, path: s.startPath, events: s.events };
  // Last time = the whole first visit across its pages (the lab keeps per-page sums; merged is close enough for a demo).
  return {
    ...base, returning: true, visits: p.visitor.visits + 1, path: s.revisit.startPath, events: s.revisit.events,
    memoryEvents: [...s.events, ...s.pages.flatMap((x) => x.events)],
  };
}

const card = "rounded-xl border border-black/10 bg-white p-4 shadow-sm";
const h2 = "text-sm font-bold tracking-wider text-[#5b6170] uppercase";
const chip = (on: boolean) => `rounded-full border px-3 py-1 text-sm font-semibold ${on ? "border-[#2346d8] bg-[#2346d8] text-white" : "border-black/15 bg-white text-[#14171f]"}`;

export function SimClient({ products, presets }: { products: { id: string; name: string }[]; presets: Preset[] }) {
  const [s, setS] = useState<Setup>(BLANK);
  const [target, setTarget] = useState<"events" | "memoryEvents">("events");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Setup>(k: K, v: Setup[K]) => setS((o) => ({ ...o, [k]: v }));
  const toggle = (k: "largeText" | "highContrast" | "reducedMotion" | "personalization" | "partnerData" | "returning") => set(k, !s[k]);

  const productId = s.path.match(/\/p\/([^/?]+)/)?.[1];
  const add = (ev: Ev) => setS((o) => {
    const list = target === "memoryEvents" && o.returning ? "memoryEvents" : "events";
    return { ...o, [list]: [...o[list], { ...ev, t: o[list].length * 2500 }] };
  });
  const removeAt = (list: "events" | "memoryEvents", i: number) => setS((o) => ({ ...o, [list]: o[list].filter((_, j) => j !== i).map((e, j) => ({ ...e, t: j * 2500 })) }));

  const opening = useMemo(() => readAfter(s, 0), [s]);
  const end = useMemo(() => readAfter(s), [s]);
  const { slide, normal } = useMemo(() => pageAfter(s, cfg), [s]);
  const steps = useMemo(() => s.events.map((_, i) => readAfter(s, i + 1).model), [s]);
  const mem = useMemo(() => memoryOf(s), [s]);
  const changedBlock = (id: string, order: number, variant: string) => {
    const n = normal.blocks.find((b) => b.id === id);
    return !n || n.order !== order || n.variant !== variant;
  };

  const openStore = async () => {
    setBusy(true);
    const r = await fetch("/api/sim", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: s.path, partner: end.partner, events: withTimes(s.events) }),
    }).then((x) => x.json()).catch(() => null) as { id?: string } | null;
    if (!r?.id) { setBusy(false); alert("Could not register the setup (is the dev server up?)."); return; }
    // The lab reads the shopper's remembered group sums from this browser on a return visit.
    if (mem) {
      try {
        localStorage.setItem(memoryKey(r.id), JSON.stringify({ groups: mem, savedAt: new Date().toISOString(), persona: {}, traits: [], pages: 1 }));
      } catch { /* storage blocked: the visit starts without memory */ }
    }
    location.assign(`${s.path}?ghost=${r.id}&step=0&lab=1${s.returning ? "&visit=2" : ""}${s.variant ? `&variant=${s.variant}` : ""}`);
  };

  const fired = Object.entries(end.signals).filter(([k]) => SIGNALS[k]);
  const field = "rounded-md border border-black/15 bg-white px-2 py-1 text-sm";
  const check = (label: string, k: Parameters<typeof toggle>[0], disabled = false) => (
    <label className={`flex items-center gap-2 text-sm ${disabled ? "opacity-40" : ""}`}>
      <input type="checkbox" checked={s[k]} disabled={disabled} onChange={() => toggle(k)} /> {label}
    </label>
  );
  const timeline = (list: "events" | "memoryEvents", title: string) => (
    <div>
      <p className="text-sm font-semibold">{title} ({s[list].length})</p>
      {s[list].length === 0 ? <p className="text-sm text-[#5b6170]">Nothing yet. Add actions from the list above.</p> : (
        <ol className="mt-1 flex flex-col gap-1">
          {s[list].map((e, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-[#f3f5fb] px-2 py-1 text-sm">
              <span>{i + 1}. {describe(e)}{list === "events" && steps[i] && <b className="ml-2 text-[#2346d8]">→ {steps[i].dialect} × {steps[i].need}</b>}</span>
              <button aria-label={`Remove action ${i + 1}`} onClick={() => removeAt(list, i)} className="px-1 font-bold text-[#a3341f]">×</button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f3f5fb] text-[#14171f]">
      <main className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-sm font-bold tracking-wider text-[#5b6170] uppercase">Babel simulator · Taraba</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Change what Babel knows, see the page it builds</h1>
        <p className="mt-1 text-[#3c4250]">Every input the shopper read uses is below: what the store shares, consent, what was remembered from last time, and what the shopper does. The right side recomputes live with the real code. All shoppers are synthetic.</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Start from:</span>
          <button className={chip(false)} onClick={() => setS(BLANK)}>Blank first visit</button>
          {presets.map((p) => (
            <span key={p.id} className="flex gap-1">
              <button className={chip(false)} title={p.label} onClick={() => setS(fromShopper(p, false))}>{p.id[0].toUpperCase() + p.id.slice(1)}</button>
              {p.revisit && <button className={chip(false)} title="Her return visit, with what she did last time remembered" onClick={() => setS(fromShopper(p, true))}>{p.id[0].toUpperCase() + p.id.slice(1)}, back later</button>}
            </span>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="flex flex-col gap-4">
            <section className={card}>
              <h2 className={h2}>1 · Where they land</h2>
              <select className={`${field} mt-2 w-full`} value={s.path} onChange={(e) => set("path", e.target.value)} aria-label="Page">
                <option value="/taraba">Home</option>
                {Category.options.map((c) => <option key={c} value={`/taraba/c/${c}`}>Category · {c}</option>)}
                {products.map((p) => <option key={p.id} value={`/taraba/p/${p.id}`}>Product · {p.name}</option>)}
              </select>
            </section>

            <section className={card}>
              <h2 className={h2}>2 · What the store shares</h2>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {check("Accepted personalization", "personalization")}
                {check("Accepted sharing account data", "partnerData", !s.personalization)}
                {check("Has been here before", "returning", !s.personalization)}
                <label className={`flex items-center gap-2 text-sm ${s.returning ? "" : "opacity-40"}`}>
                  Visit number <input type="number" min={2} max={20} className={`${field} w-16`} disabled={!s.returning} value={s.visits} onChange={(e) => set("visits", Number(e.target.value) || 2)} />
                </label>
                <label className="flex items-center gap-2 text-sm">Came from
                  <select className={field} value={s.utm} onChange={(e) => set("utm", e.target.value)}>{SOURCES.map((x) => <option key={x} value={x}>{x || "(direct)"}</option>)}</select>
                </label>
                <label className="flex items-center gap-2 text-sm">Campaign says
                  <select className={field} value={s.intent} onChange={(e) => set("intent", e.target.value)}>{INTENTS.map((x) => <option key={x} value={x}>{x || "(nothing)"}</option>)}</select>
                </label>
              </div>
              <fieldset disabled={!s.partnerData || !s.personalization} className={`mt-3 border-t border-black/10 pt-3 ${s.partnerData && s.personalization ? "" : "opacity-40"}`}>
                <legend className="text-sm font-semibold">Account data (only sent with consent)</legend>
                <div className="flex flex-wrap gap-1">
                  {Category.options.map((c) => (
                    <button key={c} className={chip(s.orders.includes(c))} onClick={() => set("orders", s.orders.includes(c) ? s.orders.filter((x) => x !== c) : [...s.orders, c])}>bought {c}</button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-4">
                  {check("Large text on", "largeText")}{check("High contrast on", "highContrast")}{check("Reduced motion on", "reducedMotion")}
                  <label className="flex items-center gap-2 text-sm">Age band, if the store declares it
                    <select className={field} value={s.ageBand} onChange={(e) => set("ageBand", e.target.value)}>{AGE_BANDS.map((x) => <option key={x} value={x}>{x || "(not shared)"}</option>)}</select>
                  </label>
                </div>
              </fieldset>
              <p className="mt-2 text-xs text-[#5b6170]">Babel never infers age or demographics; the age band only matters if the store declares it (a minor never gets the &quot;deals&quot; view).</p>
            </section>

            <section className={card}>
              <h2 className={h2}>3 · What the shopper does</h2>
              {s.returning && (
                <div className="mt-2 flex gap-2">
                  <button className={chip(target === "events")} onClick={() => setTarget("events")}>This visit</button>
                  <button className={chip(target === "memoryEvents")} onClick={() => setTarget("memoryEvents")}>Last time (remembered)</button>
                </div>
              )}
              <p className="mt-2 text-sm text-[#5b6170]">Adding to: <b>{s.returning && target === "memoryEvents" ? "last time" : "this visit"}</b></p>
              {PALETTE.map(([group, items]) => (
                <div key={group} className="mt-2">
                  <p className="text-xs font-bold text-[#5b6170] uppercase">{group}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {items.map(([label, make]) => <button key={label} className={chip(false)} onClick={() => add(make(productId))}>+ {label}</button>)}
                  </div>
                </div>
              ))}
              <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (query.trim()) { add({ type: "search", value: query.trim() }); setQuery(""); } }}>
                <input className={`${field} flex-1`} placeholder="Type any search…" value={query} onChange={(e) => setQuery(e.target.value)} />
                <button className={chip(false)}>+ Search</button>
              </form>
              <div className="mt-4 flex flex-col gap-3">
                {timeline("events", "This visit")}
                {s.returning && timeline("memoryEvents", "Last time (becomes the memory)")}
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
            <section className={card}>
              <h2 className={h2}>What the model reads</h2>
              <p className="mt-2 text-sm text-[#5b6170]">Before any click{mem ? " (from memory + context)" : " (from context only)"}</p>
              <p className="text-lg font-extrabold">{opening.model.dialect} × {opening.model.need} <span className="text-sm font-normal text-[#5b6170]">· confidence {opening.model.confidence.toFixed(2)}</span></p>
              <p className="mt-2 text-sm text-[#5b6170]">After this visit&apos;s {s.events.length} actions</p>
              <p className="text-2xl font-extrabold text-[#2346d8]">{end.model.dialect} × {end.model.need} <span className="text-sm font-normal text-[#5b6170]">· confidence {end.model.confidence.toFixed(2)}</span></p>
              <p className="text-sm text-[#3c4250]">Why: {end.model.dialectWhy}; {end.model.needWhy}. Copy: {end.model.copyRegister}. Stage: {end.profile?.stage ?? "–"}{end.model.giftContext ? ", buying for someone else" : ""}.</p>
              {!s.personalization && <p className="mt-1 text-sm font-semibold text-[#9a6b00]">No consent: nothing is collected, the store&apos;s normal page.</p>}
              <ul className="mt-3 flex flex-col gap-1">
                {TRAITS.map((t) => {
                  const tr = end.profile?.traits[t];
                  const used = !!tr && tr.conf >= THRESHOLD;
                  return (
                    <li key={t} className={`text-sm ${used ? "font-semibold" : "text-[#5b6170]"}`}>
                      <div className="flex justify-between"><span>{LABEL[TRAIT_NAMES[t]]}</span><span>{tr ? `${tr.value.toFixed(2)} · conf ${tr.conf.toFixed(2)} ${used ? "✓ used" : "neutral"}` : "–"}</span></div>
                      <div className="relative h-1.5 rounded bg-black/10"><div className={`h-full rounded ${used ? "bg-[#2346d8]" : "bg-black/30"}`} style={{ width: `${(tr?.value ?? 0.5) * 100}%` }} /></div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-[#5b6170]">A trait only shapes the page once its confidence reaches {THRESHOLD}.</p>
              {fired.length > 0 && (
                <details className="mt-2"><summary className="cursor-pointer text-sm font-semibold">Signals that fired ({fired.length})</summary>
                  <ul className="mt-1 text-sm text-[#3c4250]">
                    {fired.map(([k, n]) => <li key={k}>{k} × {n} → {SIGNALS[k][1].map(([t, sign]) => `${TRAIT_NAMES[t]} ${sign > 0 ? "+" : "−"}`).join(", ")}</li>)}
                  </ul>
                </details>
              )}
            </section>

            <section className={card}>
              <h2 className={h2}>The page it builds ({templateOf(s.path)})</h2>
              <label className="mt-2 flex items-center gap-2 text-sm">Force a format
                <select className={field} value={s.variant} onChange={(e) => set("variant", e.target.value)}>{FORMATS.map((x) => <option key={x} value={x}>{x ? x.replace(".", " × ") : "(let the model decide)"}</option>)}</select>
              </label>
              <p className="mt-2 text-sm text-[#3c4250]">{slide.rationale}</p>
              <ol className="mt-2 flex flex-col gap-1">
                {[...slide.blocks].sort((a, b) => a.order - b.order).map((b) => (
                  <li key={b.id} className={`flex justify-between rounded-md px-2 py-1 text-sm ${changedBlock(b.id, b.order, b.variant) ? "bg-[#fff4d6] font-semibold" : "bg-[#f3f5fb]"}`}>
                    <span>{b.order}. {cfg.registry[slide.template]?.[b.id]?.label ?? b.id}</span><span>{b.variant}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-1 text-xs text-[#5b6170]">Highlighted = differs from the store&apos;s normal page.</p>
              <p className="mt-2 text-sm text-[#3c4250]">Look: {slide.theme.density} spacing, text ×{slide.theme.typeScale}, {slide.theme.contrast} contrast, {slide.theme.motion} motion, copy {slide.copyRegister}.</p>
              <p className="mt-2 text-xs text-[#5b6170]">This is the opening page from the rules. The agent&apos;s later changes and the store&apos;s learned defaults only appear in the real store.</p>
              <button disabled={busy} onClick={openStore} className="mt-3 w-full rounded-lg bg-[#2346d8] px-5 py-3 font-bold text-white disabled:opacity-50">
                {busy ? "Opening…" : "Open the real store with this setup"}
              </button>
              <p className="mt-1 text-xs text-[#5b6170]">It replays the actions with the indicator panel on the left. {s.returning && mem ? "The remembered behaviour is handed to the store the way a returning browser would." : ""}</p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
