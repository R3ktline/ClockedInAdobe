"use client";
// Clean shopper simulator dashboard: pick presets, adjust store context & consent, append actions,
// and watch traits, persona read, and composed page blueprint update live.
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { memoryKey } from "@/babel/sdk/LabPanel";
import { Category, BrandKit, Registry, type InteractionEvent } from "@/babel/schema";
import { SIGNALS, THRESHOLD, TRAIT_NAMES, TRAITS } from "@/babel/persona/signalModel";
import { BLANK, memoryOf, pageAfter, readAfter, templateOf, type Setup } from "@/babel/session/simulate";
import type { Shopper } from "@/data/shoppers";
import { storeConfigs } from "@/stores";

const cfg = { brand: BrandKit.parse(storeConfigs.taraba.brand), registry: Registry.parse(storeConfigs.taraba.registry) };

type Ev = Omit<InteractionEvent, "t">;

const PALETTE: [group: string, items: [label: string, ev: (product?: string) => Ev][]][] = [
  [
    "Looking",
    [
      ["Swipe gallery", (p) => ({ type: "gallery_swipe", blockId: "gallery", productId: p })],
      ["Zoom photo", (p) => ({ type: "image_zoom", blockId: "gallery", productId: p })],
      ["Fast scroll", () => ({ type: "scroll", value: "fast" })],
      ["Slow scroll", () => ({ type: "scroll", value: "slow" })],
      ["View only", (p) => ({ type: "page_view", productId: p })],
    ],
  ],
  [
    "Reading detail",
    [
      ["Open specs", (p) => ({ type: "block_open", blockId: "specs", productId: p })],
      ["Read specs 9s", (p) => ({ type: "block_dwell", blockId: "specs", productId: p, value: 9000 })],
      ["Add compare", (p) => ({ type: "compare_add", productId: p })],
      ["Tech filter", () => ({ type: "filter", value: "ram-16gb" })],
    ],
  ],
  [
    "Search & price",
    [
      ["Search “16GB DDR5”", () => ({ type: "search", value: "16GB DDR5" })],
      ["Search “TV for mum”", () => ({ type: "search", value: "good TV for my mum" })],
      ["Search “under 500 lei”", () => ({ type: "search", value: "cheapest under 500 lei" })],
      ["Sort price ↑", () => ({ type: "sort", value: "price_asc" })],
      ["Filter < 500", () => ({ type: "filter", value: "price<500" })],
    ],
  ],
  [
    "Checking trust",
    [
      ["Open reviews", (p) => ({ type: "review_open", blockId: "trust", productId: p })],
      ["Open delivery", (p) => ({ type: "policy_open", blockId: "trust", productId: p, value: "delivery" })],
      ["Open returns", (p) => ({ type: "policy_open", blockId: "trust", productId: p, value: "returns" })],
      ["Open warranty", (p) => ({ type: "policy_open", blockId: "trust", productId: p, value: "warranty" })],
    ],
  ],
  [
    "Struggling",
    [
      ["Mis-tap", () => ({ type: "mis_tap" })],
      ["Dead click", () => ({ type: "dead_click" })],
      ["Go back", () => ({ type: "back_nav" })],
    ],
  ],
  [
    "Deciding",
    [
      ["Add to cart", (p) => ({ type: "add_to_cart", blockId: "buyBox", productId: p })],
      ["Start checkout", () => ({ type: "checkout_start" })],
    ],
  ],
];

const SOURCES = ["", "pinterest", "instagram", "tiktok", "price-compare", "review-site", "google"];
const INTENTS = ["", "deal", "gift", "specs", "new-season"];
const AGE_BANDS = ["", "minor", "18-34", "35-54", "55+"];
const FORMATS = [
  "",
  ...(["guided", "standard", "dense", "visual"] as const).flatMap((d) =>
    (["balanced", "specs", "deals", "inspiration", "reassurance", "quick"] as const).map((n) => `${d}.${n}`),
  ),
];

const LABEL: Record<string, string> = {
  infoAppetite: "Wants detail",
  jargonComfort: "Technical comfort",
  priceSensitivity: "Price sensitivity",
  trustNeed: "Needs reassurance",
  inspirationAppetite: "Visual browsing",
  interactionFluency: "Site fluency",
  confusion: "Seems lost",
};

const describe = (e: Ev) =>
  `${e.type}${e.value !== undefined ? ` · ${e.value}` : ""}${e.blockId ? ` (${e.blockId})` : ""}`;
const withTimes = (evs: Ev[]): InteractionEvent[] => evs.map((e, i) => ({ ...e, t: i * 2500 }));

type Preset = Shopper;
function fromShopper(s: Preset, returning: boolean): Setup {
  const p = s.partner;
  const a = p.account;
  const base: Setup = {
    ...BLANK,
    personalization: p.consent.personalization,
    partnerData: p.consent.partnerData,
    utm: p.campaign?.utmSource ?? "",
    intent: p.campaign?.intentTag ?? "",
    orders: a?.orderCategories ?? [],
    largeText: !!a?.accessibility?.largeText,
    highContrast: !!a?.accessibility?.highContrast,
    reducedMotion: !!a?.accessibility?.reducedMotion,
    ageBand: a?.ageBand ?? "",
  };
  if (!returning || !s.revisit) {
    return { ...base, returning: p.visitor.returning, visits: p.visitor.visits, path: s.startPath, events: s.events };
  }
  return {
    ...base,
    returning: true,
    visits: p.visitor.visits + 1,
    path: s.revisit.startPath,
    events: s.revisit.events,
    memoryEvents: [...s.events, ...s.pages.flatMap((x) => x.events)],
  };
}

function MiniBars({ values, color = "#116b5f" }: { values: number[]; color?: string }) {
  const items = values.length ? values : [0.25, 0.4, 0.35, 0.5];
  const max = Math.max(...items, 1);
  return (
    <div className="flex h-8 items-end gap-1" aria-hidden="true">
      {items.slice(0, 7).map((v, i) => (
        <span
          key={i}
          className="w-2 rounded-t-xs transition-all"
          style={{
            height: `${Math.max(18, Math.round((v / max) * 100))}%`,
            backgroundColor: color,
            opacity: 0.35 + (i / items.length) * 0.65,
          }}
        />
      ))}
    </div>
  );
}

function SummaryCard({
  icon,
  iconBg,
  label,
  value,
  badge,
  sub,
  bars,
  barColor,
}: {
  icon: ReactNode;
  iconBg: string;
  label: string;
  value: string;
  badge?: string;
  sub: string;
  bars: number[];
  barColor: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#e6e4dc] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,20,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}>{icon}</span>
        <MiniBars values={bars} color={barColor} />
      </div>
      <div className="mt-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-[#6c746f]">{label}</span>
          <span className="rounded bg-[#fdf3df] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#8a5a0a] uppercase">
            simulated
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <span className="text-xl font-bold tracking-tight text-[#161c1a] tabular-nums">{value}</span>
          {badge && (
            <span className="rounded-full bg-[#dff0ec] px-2 py-0.5 text-[11px] font-semibold text-[#0f5c51]">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-[#707873]">{sub}</p>
      </div>
    </div>
  );
}

export function SimClient({ products, presets }: { products: { id: string; name: string }[]; presets: Preset[] }) {
  const [s, setS] = useState<Setup>(BLANK);
  const [activePreset, setActivePreset] = useState<string>("blank");
  const [target, setTarget] = useState<"events" | "memoryEvents">("events");
  const [activeGroup, setActiveGroup] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  const set = <K extends keyof Setup>(k: K, v: Setup[K]) => setS((o) => ({ ...o, [k]: v }));
  const toggle = (k: "largeText" | "highContrast" | "reducedMotion" | "personalization" | "partnerData" | "returning") =>
    set(k, !s[k]);

  const productId = s.path.match(/\/p\/([^/?]+)/)?.[1];
  const add = (ev: Ev) =>
    setS((o) => {
      const list = target === "memoryEvents" && o.returning ? "memoryEvents" : "events";
      return { ...o, [list]: [...o[list], { ...ev, t: o[list].length * 2500 }] };
    });
  const removeAt = (list: "events" | "memoryEvents", i: number) =>
    setS((o) => ({
      ...o,
      [list]: o[list].filter((_, j) => j !== i).map((e, j) => ({ ...e, t: j * 2500 })),
    }));
  const clearList = (list: "events" | "memoryEvents") => setS((o) => ({ ...o, [list]: [] }));

  const opening = useMemo(() => readAfter(s, 0), [s]);
  const end = useMemo(() => readAfter(s), [s]);
  const { slide, normal } = useMemo(() => pageAfter(s, cfg), [s]);
  const steps = useMemo(() => s.events.map((_, i) => readAfter(s, i + 1).model), [s]);
  const mem = useMemo(() => memoryOf(s), [s]);

  const changedBlock = (id: string, order: number, variant: string) => {
    const n = normal.blocks.find((b) => b.id === id);
    return !n || n.order !== order || n.variant !== variant;
  };

  const sortedBlocks = useMemo(() => [...slide.blocks].sort((a, b) => a.order - b.order), [slide.blocks]);
  const changedCount = useMemo(
    () => sortedBlocks.filter((b) => changedBlock(b.id, b.order, b.variant)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortedBlocks, normal.blocks],
  );

  const usedTraitsCount = useMemo(
    () => TRAITS.filter((t) => (end.profile?.traits[t]?.conf ?? 0) >= THRESHOLD).length,
    [end.profile],
  );

  const openStore = async () => {
    setBusy(true);
    const r = (await fetch("/api/sim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: s.path, partner: end.partner, events: withTimes(s.events) }),
    })
      .then((x) => x.json())
      .catch(() => null)) as { id?: string } | null;
    if (!r?.id) {
      setBusy(false);
      alert("Could not register the setup (is the dev server up?).");
      return;
    }
    if (mem) {
      try {
        localStorage.setItem(
          memoryKey(r.id),
          JSON.stringify({ groups: mem, savedAt: new Date().toISOString(), persona: {}, traits: [], pages: 1 }),
        );
      } catch {
        /* storage blocked */
      }
    }
    location.assign(
      `${s.path}?ghost=${r.id}&step=0&lab=1${s.returning ? "&visit=2" : ""}${s.variant ? `&variant=${s.variant}` : ""}`,
    );
  };

  const fired = Object.entries(end.signals).filter(([k]) => SIGNALS[k]);
  const selectCls =
    "w-full rounded-xl border border-[#dcdad0] bg-[#faf9f5] px-3 py-2 text-sm text-[#161c1a] focus:border-[#116b5f] focus:bg-white focus:outline-hidden disabled:opacity-45";

  const visibleGroups = activeGroup === "All" ? PALETTE : PALETTE.filter(([g]) => g === activeGroup);

  const renderTimeline = (list: "events" | "memoryEvents", title: string) => (
    <div className="rounded-xl border border-[#eceae2] bg-[#faf9f5] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold tracking-wide text-[#4b534f] uppercase">
          {title} ({s[list].length})
        </p>
        {s[list].length > 0 && (
          <button
            type="button"
            onClick={() => clearList(list)}
            className="text-xs font-semibold text-[#9e3528] hover:underline"
          >
            Clear all
          </button>
        )}
      </div>
      {s[list].length === 0 ? (
        <p className="mt-2 text-xs text-[#707873]">No actions added yet — click any action chip above.</p>
      ) : (
        <ol className="mt-2.5 flex flex-col gap-1.5">
          {s[list].map((e, i) => {
            const stepRead = list === "events" ? steps[i] : undefined;
            const prevRead =
              list === "events" ? (i === 0 ? opening.model : steps[i - 1]) : undefined;
            const shifted =
              stepRead && prevRead && (stepRead.dialect !== prevRead.dialect || stepRead.need !== prevRead.need);
            return (
              <li
                key={i}
                className="flex items-center justify-between gap-2 rounded-lg border border-[#e6e4dc] bg-white px-3 py-1.5 text-xs"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="font-semibold text-[#78807b] tabular-nums">{i + 1}.</span>
                  <span className="font-medium text-[#161c1a]">{describe(e)}</span>
                  {stepRead && (
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                        shifted ? "bg-[#dff0ec] text-[#0f5c51]" : "bg-[#f2f1eb] text-[#68706b]"
                      }`}
                    >
                      → {stepRead.dialect} × {stepRead.need}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Remove action ${i + 1}`}
                  onClick={() => removeAt(list, i)}
                  className="shrink-0 rounded px-1.5 py-0.5 text-sm font-bold text-[#9e3528] hover:bg-[#fdeaea]"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#f8f7f3] text-[#161c1a]">
      {/* Left Sidebar: Presets & Workspaces */}
      <aside
        aria-label="Simulator presets and navigation"
        className={`${
          mobileNav ? "fixed inset-y-0 left-0 z-40 flex" : "hidden lg:flex"
        } w-64 shrink-0 flex-col border-r border-[#e6e4dc] bg-[#f4f3ed]`}
      >
        <div className="flex h-16 items-center justify-between border-b border-[#e6e4dc] px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#116b5f] text-white shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-[#161c1a]">Babel</p>
              <p className="text-[10px] font-semibold tracking-[0.12em] text-[#707873] uppercase">Sim Panel</p>
            </div>
          </div>
          {mobileNav && (
            <button
              type="button"
              onClick={() => setMobileNav(false)}
              className="rounded-lg p-1 text-[#707873] hover:bg-[#e6e4dc] lg:hidden"
              aria-label="Close navigation"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
          <div>
            <p className="mb-2 px-2 text-[11px] font-semibold tracking-[0.08em] text-[#78807b] uppercase">
              Shopper Presets
            </p>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => {
                  setS(BLANK);
                  setActivePreset("blank");
                  setMobileNav(false);
                }}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${
                  activePreset === "blank"
                    ? "bg-[#dff0ec] font-semibold text-[#0f5c51]"
                    : "text-[#4b534f] hover:bg-[#eceae2] hover:text-[#161c1a]"
                }`}
              >
                <span>Blank first visit</span>
                <span className="text-xs text-[#707873]">Reset</span>
              </button>

              {presets.map((p) => {
                const name = p.id[0].toUpperCase() + p.id.slice(1);
                const isFirst = activePreset === p.id;
                const isReturn = activePreset === `${p.id}:return`;
                return (
                  <div key={p.id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title={p.label}
                        onClick={() => {
                          setS(fromShopper(p, false));
                          setActivePreset(p.id);
                          setMobileNav(false);
                        }}
                        className={`flex-1 truncate rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${
                          isFirst
                            ? "bg-[#dff0ec] font-semibold text-[#0f5c51]"
                            : "text-[#4b534f] hover:bg-[#eceae2] hover:text-[#161c1a]"
                        }`}
                      >
                        {name}
                      </button>
                      {p.revisit && (
                        <button
                          type="button"
                          title={`${name}'s return visit, with remembered behaviour`}
                          onClick={() => {
                            setS(fromShopper(p, true));
                            setActivePreset(`${p.id}:return`);
                            setMobileNav(false);
                          }}
                          className={`shrink-0 rounded-xl px-2.5 py-2 text-xs font-semibold transition-colors ${
                            isReturn
                              ? "bg-[#116b5f] text-white"
                              : "bg-[#e9e7df] text-[#4b534f] hover:bg-[#dcdad0]"
                          }`}
                        >
                          ↩ Return
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-auto border-t border-[#e6e4dc] pt-4">
            <p className="mb-2 px-2 text-[11px] font-semibold tracking-[0.08em] text-[#78807b] uppercase">Workspaces</p>
            <div className="flex flex-col gap-1 text-sm">
              <Link
                href="/merchant"
                className="flex items-center justify-between rounded-xl px-3 py-2 font-medium text-[#4b534f] hover:bg-[#eceae2] hover:text-[#161c1a]"
              >
                <span>Merchant Panel</span>
                <span className="text-xs text-[#78807b]">↗</span>
              </Link>
              <Link
                href="/taraba"
                className="flex items-center justify-between rounded-xl px-3 py-2 font-medium text-[#4b534f] hover:bg-[#eceae2] hover:text-[#161c1a]"
              >
                <span>Taraba Storefront</span>
                <span className="text-xs text-[#78807b]">↗</span>
              </Link>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 flex h-16 flex-wrap items-center justify-between gap-3 border-b border-[#e6e4dc] bg-[#faf9f5]/95 px-6 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNav(true)}
              className="rounded-lg border border-[#dcdad0] bg-white px-2.5 py-1.5 text-sm font-medium lg:hidden"
              aria-label="Open presets"
            >
              ☰ Presets
            </button>
            <div className="flex items-center gap-2 text-sm">
              <span className="hidden font-semibold text-[#707873] sm:inline">Landing page:</span>
              <select
                aria-label="Page"
                value={s.path}
                onChange={(e) => set("path", e.target.value)}
                className="max-w-xs rounded-xl border border-[#dcdad0] bg-white px-3 py-1.5 text-sm font-medium text-[#161c1a] focus:border-[#116b5f] focus:outline-hidden"
              >
                <option value="/taraba">Taraba · Home</option>
                {Category.options.map((c) => (
                  <option key={c} value={`/taraba/c/${c}`}>
                    Category · {c}
                  </option>
                ))}
                {products.map((p) => (
                  <option key={p.id} value={`/taraba/p/${p.id}`}>
                    Product · {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            <span className="hidden rounded-full border border-[#f2dba5] bg-[#fdf3df] px-2.5 py-1 font-semibold text-[#8a5a0a] sm:inline-block">
              Synthetic shoppers (simulated)
            </span>
            <span
              className={`rounded-full px-2.5 py-1 font-semibold ${
                s.personalization
                  ? "bg-[#dff0ec] text-[#0f5c51]"
                  : "bg-[#fdeaea] text-[#a62929]"
              }`}
            >
              {s.personalization ? "Consent active" : "No consent · standard view"}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={openStore}
              className="rounded-xl bg-[#116b5f] px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#0d564c] disabled:opacity-50 sm:text-sm"
            >
              {busy ? "Opening…" : "Open in Taraba →"}
            </button>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6">
          {/* Page Header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#161c1a]">Shopper Signal Simulator</h1>
            <p className="mt-0.5 text-sm text-[#68706b]">
              Adjust consented context, prior memory, and shopper interactions on the left — watch traits and the composed{" "}
              <strong className="font-semibold text-[#161c1a]">{templateOf(s.path)}</strong> blueprint update live on the right.
            </p>
          </div>

          {/* 4 KPI Summary Cards */}
          <section aria-label="Simulation summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              iconBg="bg-[#ecefe9] text-[#454d48]"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
                </svg>
              }
              label="Opening View"
              value={`${opening.model.dialect} × ${opening.model.need}`}
              badge={`conf ${opening.model.confidence.toFixed(2)}`}
              sub={mem ? "Before clicks (memory + context)" : "Before clicks (context only)"}
              bars={[opening.model.confidence, 0.5]}
              barColor="#5c6660"
            />

            <SummaryCard
              iconBg="bg-[#dff0ec] text-[#116b5f]"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M3 12h4l3-8 4 16 3-8h4" />
                </svg>
              }
              label="Resulting View"
              value={`${end.model.dialect} × ${end.model.need}`}
              badge={`conf ${end.model.confidence.toFixed(2)}`}
              sub={`After ${s.events.length} action${s.events.length === 1 ? "" : "s"} this visit`}
              bars={steps.length ? steps.map((st) => st.confidence) : [end.model.confidence]}
              barColor="#116b5f"
            />

            <SummaryCard
              iconBg="bg-[#e6eff5] text-[#24587a]"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 20V10" />
                  <path d="M18 20V4" />
                  <path d="M6 20v-4" />
                </svg>
              }
              label="Active Traits"
              value={`${usedTraitsCount} / ${TRAITS.length}`}
              badge={`≥ ${THRESHOLD} conf`}
              sub={`Stage: ${end.profile?.stage ?? "–"} · Copy: ${end.model.copyRegister}`}
              bars={TRAITS.map((t) => end.profile?.traits[t]?.conf ?? 0.1)}
              barColor="#24587a"
            />

            <SummaryCard
              iconBg="bg-[#fdf3df] text-[#b87a14]"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
              }
              label="Changed Blocks"
              value={`${changedCount} / ${sortedBlocks.length}`}
              badge={templateOf(s.path)}
              sub={`${slide.theme.density} density · ${slide.theme.typeScale}× text`}
              bars={sortedBlocks.map((b) => (changedBlock(b.id, b.order, b.variant) ? 1 : 0.3))}
              barColor="#d99b26"
            />
          </section>

          {/* Main 2-Column Builder & Live Readout */}
          <div className="grid gap-6 xl:grid-cols-[1.08fr_1fr]">
            {/* Left Column: Context + Action Palette + Timelines */}
            <div className="flex flex-col gap-6">
              {/* Card 1: Consent & Store-Shared Context */}
              <section className="rounded-2xl border border-[#e6e4dc] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,20,0.03)]">
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-[#161c1a]">1 · Consent & Store Context</h2>
                    <p className="text-xs text-[#707873]">Partner signals shared with Babel when personalization consent is granted</p>
                  </div>
                </div>

                {/* Consent & Visit toggles */}
                <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
                  {(
                    [
                      ["Personalization", "personalization", false],
                      ["Account sharing", "partnerData", !s.personalization],
                      ["Returning visitor", "returning", !s.personalization],
                    ] as const
                  ).map(([lbl, key, dis]) => (
                    <label
                      key={key}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                        dis ? "cursor-not-allowed opacity-40" : ""
                      } ${
                        s[key] && !dis
                          ? "border-[#116b5f]/40 bg-[#ecf7f5] text-[#0f5c51]"
                          : "border-[#e6e4dc] bg-[#faf9f5] text-[#4b534f]"
                      }`}
                    >
                      <span>{lbl}</span>
                      <input
                        type="checkbox"
                        checked={s[key]}
                        disabled={dis}
                        onChange={() => toggle(key)}
                        className="h-4 w-4 accent-[#116b5f]"
                      />
                    </label>
                  ))}
                </div>

                {/* Campaign & Visit Number */}
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <label className="flex flex-col gap-1 text-xs font-medium text-[#4b534f]">
                    <span>Traffic source (UTM)</span>
                    <select className={selectCls} value={s.utm} onChange={(e) => set("utm", e.target.value)}>
                      {SOURCES.map((x) => (
                        <option key={x} value={x}>
                          {x || "(direct)"}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-xs font-medium text-[#4b534f]">
                    <span>Campaign intent</span>
                    <select className={selectCls} value={s.intent} onChange={(e) => set("intent", e.target.value)}>
                      {INTENTS.map((x) => (
                        <option key={x} value={x}>
                          {x || "(none)"}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={`flex flex-col gap-1 text-xs font-medium text-[#4b534f] ${s.returning ? "" : "opacity-45"}`}>
                    <span>Visit count</span>
                    <input
                      type="number"
                      min={2}
                      max={20}
                      disabled={!s.returning}
                      value={s.visits}
                      onChange={(e) => set("visits", Number(e.target.value) || 2)}
                      className={selectCls}
                    />
                  </label>
                </div>

                {/* Consented Account Data */}
                <fieldset
                  disabled={!s.partnerData || !s.personalization}
                  className={`mt-4 rounded-xl border border-[#eceae2] bg-[#faf9f5] p-3.5 transition-opacity ${
                    s.partnerData && s.personalization ? "" : "opacity-45"
                  }`}
                >
                  <legend className="px-1 text-xs font-bold tracking-wide text-[#4b534f] uppercase">
                    Consented Account Data
                  </legend>

                  <p className="text-xs text-[#68706b]">Past order categories:</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {Category.options.map((c) => {
                      const on = s.orders.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() =>
                            set("orders", on ? s.orders.filter((x) => x !== c) : [...s.orders, c])
                          }
                          className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                            on
                              ? "border-[#116b5f] bg-[#116b5f] text-white"
                              : "border-[#dcdad0] bg-white text-[#4b534f] hover:bg-[#f0efe9]"
                          }`}
                        >
                          {on ? "✓ " : "+ "}
                          {c}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                    <div className="flex flex-wrap gap-3 text-xs font-medium text-[#2d3430]">
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={s.largeText}
                          onChange={() => toggle("largeText")}
                          className="accent-[#116b5f]"
                        />
                        Large text
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={s.highContrast}
                          onChange={() => toggle("highContrast")}
                          className="accent-[#116b5f]"
                        />
                        High contrast
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={s.reducedMotion}
                          onChange={() => toggle("reducedMotion")}
                          className="accent-[#116b5f]"
                        />
                        Reduced motion
                      </label>
                    </div>

                    <label className="flex items-center justify-between gap-2 text-xs font-medium text-[#4b534f]">
                      <span className="shrink-0">Declared age band:</span>
                      <select
                        value={s.ageBand}
                        onChange={(e) => set("ageBand", e.target.value)}
                        className="rounded-lg border border-[#dcdad0] bg-white px-2 py-1 text-xs text-[#161c1a]"
                      >
                        {AGE_BANDS.map((x) => (
                          <option key={x} value={x}>
                            {x || "(not shared)"}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </fieldset>

                <p className="mt-2.5 text-[11px] text-[#707873]">
                  Guardrail: Babel never infers age or demographics. Declared age band only prevents showing a &ldquo;deals&rdquo; view to a minor.
                </p>
              </section>

              {/* Card 2: Shopper Action Builder */}
              <section className="rounded-2xl border border-[#e6e4dc] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,20,0.03)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-[#161c1a]">2 · Shopper Actions</h2>
                    <p className="text-xs text-[#707873]">Append interaction events to simulate behaviour step by step</p>
                  </div>

                  {s.returning && (
                    <div className="flex rounded-xl bg-[#f2f1eb] p-1 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setTarget("events")}
                        className={`rounded-lg px-2.5 py-1 transition-colors ${
                          target === "events" ? "bg-white text-[#0f5c51] shadow-2xs" : "text-[#68706b]"
                        }`}
                      >
                        This visit ({s.events.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTarget("memoryEvents")}
                        className={`rounded-lg px-2.5 py-1 transition-colors ${
                          target === "memoryEvents" ? "bg-white text-[#0f5c51] shadow-2xs" : "text-[#68706b]"
                        }`}
                      >
                        Prior memory ({s.memoryEvents.length})
                      </button>
                    </div>
                  )}
                </div>

                {/* Group Filter Tabs */}
                <div className="mt-3.5 flex flex-wrap gap-1 border-b border-[#efede6] pb-3">
                  {["All", ...PALETTE.map(([g]) => g)].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setActiveGroup(g)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                        activeGroup === g
                          ? "bg-[#116b5f] text-white"
                          : "bg-[#f4f3ed] text-[#4b534f] hover:bg-[#e8e6de]"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>

                {/* Action Chips */}
                <div className="mt-3 flex flex-col gap-3">
                  {visibleGroups.map(([group, items]) => (
                    <div key={group}>
                      {activeGroup === "All" && (
                        <p className="mb-1 text-[11px] font-semibold tracking-wider text-[#78807b] uppercase">{group}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {items.map(([label, make]) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => add(make(productId))}
                            className="rounded-lg border border-[#dedcd3] bg-[#faf9f5] px-2.5 py-1 text-xs font-semibold text-[#161c1a] transition-colors hover:border-[#116b5f] hover:bg-[#ecf7f5] hover:text-[#0f5c51]"
                          >
                            + {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Custom Search Action */}
                <form
                  className="mt-4 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (query.trim()) {
                      add({ type: "search", value: query.trim() });
                      setQuery("");
                    }
                  }}
                >
                  <input
                    className="flex-1 rounded-xl border border-[#dcdad0] bg-[#faf9f5] px-3 py-1.5 text-sm placeholder:text-[#8c948f] focus:border-[#116b5f] focus:bg-white focus:outline-hidden"
                    placeholder="Type a custom search query…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="rounded-xl border border-[#dcdad0] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#161c1a] hover:bg-[#f2f0e8]"
                  >
                    + Search
                  </button>
                </form>

                {/* Timelines */}
                <div className="mt-4 flex flex-col gap-3">
                  {renderTimeline("events", "This Visit Timeline")}
                  {s.returning && renderTimeline("memoryEvents", "Remembered Prior Visit")}
                </div>
              </section>
            </div>

            {/* Right Column (Sticky): Trait Chart + Composed Page Blueprint */}
            <div className="flex flex-col gap-6 xl:sticky xl:top-20 xl:self-start">
              {/* Card 1: Signal Model Read & Horizontal Trait Bars */}
              <section className="rounded-2xl border border-[#e6e4dc] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,20,0.03)]">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-[#161c1a]">Signal Model Read</h2>
                    <p className="text-xs text-[#707873]">
                      Traits shape the page once confidence reaches {THRESHOLD}
                    </p>
                  </div>
                  {end.model.giftContext && (
                    <span className="rounded-full bg-[#fdf3df] px-2.5 py-0.5 text-xs font-semibold text-[#8a5a0a]">
                      Buying for someone else
                    </span>
                  )}
                </div>

                {!s.personalization && (
                  <div className="mt-3 rounded-xl border border-[#f2dba5] bg-[#fdf3df] px-3 py-2 text-xs font-semibold text-[#8a5a0a]">
                    Personalization consent is off: nothing is collected and Taraba serves its standard page.
                  </div>
                )}

                <div className="mt-3 grid gap-1.5 rounded-xl border border-[#eceae2] bg-[#faf9f5] p-3 text-xs text-[#4b534f]">
                  <p>
                    <span className="font-semibold text-[#161c1a]">Dialect ({end.model.dialect}):</span> {end.model.dialectWhy}
                  </p>
                  <p>
                    <span className="font-semibold text-[#161c1a]">Need ({end.model.need}):</span> {end.model.needWhy}
                  </p>
                </div>

                <ul className="mt-4 flex flex-col gap-3">
                  {TRAITS.map((t) => {
                    const tr = end.profile?.traits[t];
                    const used = !!tr && tr.conf >= THRESHOLD;
                    const name = TRAIT_NAMES[t];
                    const isConfusion = name === "confusion";
                    const barColor = !used
                      ? "bg-[#cbd2ce]"
                      : isConfusion && (tr?.value ?? 0) >= 0.6
                        ? "bg-[#d99b26]"
                        : "bg-[#116b5f]";
                    return (
                      <li key={t} className="grid grid-cols-[8.5rem_1fr_7.25rem] items-center gap-3 text-xs">
                        <span className={used ? "font-semibold text-[#161c1a]" : "text-[#78807b]"}>
                          {LABEL[name] ?? name}
                        </span>
                        <div className="relative h-3 overflow-hidden rounded-full bg-[#f0efe9]">
                          <div className="absolute top-0 bottom-0 z-10 w-px bg-[#161c1a]/25" style={{ left: "50%" }} />
                          <div
                            className={`h-full rounded-full transition-all duration-200 ${barColor}`}
                            style={{ width: `${Math.round((tr?.value ?? 0.5) * 100)}%` }}
                          />
                        </div>
                        <span className="text-right text-[#4b534f] tabular-nums">
                          {tr ? (
                            <>
                              {tr.value.toFixed(2)} ·{" "}
                              <span className={used ? "font-bold text-[#0f5c51]" : "text-[#858d88]"}>
                                {used ? `✓ ${tr.conf.toFixed(2)}` : `c ${tr.conf.toFixed(2)}`}
                              </span>
                            </>
                          ) : (
                            "–"
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {fired.length > 0 && (
                  <details className="mt-4 rounded-xl border border-[#eceae2] bg-[#faf9f5] p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-[#2d3430]">
                      Signals fired ({fired.length})
                    </summary>
                    <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      {fired.map(([k, n]) => (
                        <li key={k} className="rounded-md border border-[#e2e0d8] bg-white px-2 py-1 text-[#4b534f]">
                          <strong className="font-semibold text-[#161c1a]">
                            {k} ×{n}
                          </strong>{" "}
                          → {SIGNALS[k][1].map(([t, sign]) => `${TRAIT_NAMES[t]} ${sign > 0 ? "+" : "−"}`).join(", ")}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>

              {/* Card 2: Composed Page Blueprint */}
              <section className="rounded-2xl border border-[#e6e4dc] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,20,0.03)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-[#161c1a]">
                      Page Blueprint · <span className="text-[#116b5f]">{templateOf(s.path)}</span>
                    </h2>
                    <p className="text-xs text-[#707873]">Highlighted blocks differ from Taraba&apos;s standard layout</p>
                  </div>
                  <select
                    aria-label="Force a format"
                    value={s.variant}
                    onChange={(e) => set("variant", e.target.value)}
                    className="rounded-xl border border-[#dcdad0] bg-[#faf9f5] px-2.5 py-1.5 text-xs font-medium text-[#161c1a] focus:border-[#116b5f] focus:outline-hidden"
                  >
                    {FORMATS.map((x) => (
                      <option key={x} value={x}>
                        {x ? `Force: ${x.replace(".", " × ")}` : "Format: Auto (model)"}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="mt-2.5 rounded-xl bg-[#f8f7f3] px-3 py-2 text-xs text-[#4b534f]">{slide.rationale}</p>

                <ol className="mt-3 flex flex-col gap-1.5">
                  {sortedBlocks.map((b) => {
                    const isChanged = changedBlock(b.id, b.order, b.variant);
                    return (
                      <li
                        key={b.id}
                        className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs transition-colors ${
                          isChanged
                            ? "border-[#116b5f]/35 bg-[#ecf7f5] font-semibold text-[#0f5c51]"
                            : "border-[#eceae2] bg-[#faf9f5] text-[#4b534f]"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="w-4 text-[#78807b] tabular-nums">{b.order}.</span>
                          <span className="text-[#161c1a]">{cfg.registry[slide.template]?.[b.id]?.label ?? b.id}</span>
                          {isChanged && (
                            <span className="rounded bg-[#116b5f] px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                              Adapted
                            </span>
                          )}
                        </span>
                        <code className="rounded bg-white/80 px-2 py-0.5 font-mono text-[11px] text-[#2d3430]">
                          {b.variant}
                        </code>
                      </li>
                    );
                  })}
                </ol>

                {/* Theme Tokens Strip */}
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-[#4b534f]">
                  <span className="rounded-md bg-[#f3f2ec] px-2 py-1">
                    Density: <strong>{slide.theme.density}</strong>
                  </span>
                  <span className="rounded-md bg-[#f3f2ec] px-2 py-1">
                    Text: <strong>{slide.theme.typeScale}×</strong>
                  </span>
                  <span className="rounded-md bg-[#f3f2ec] px-2 py-1">
                    Contrast: <strong>{slide.theme.contrast}</strong>
                  </span>
                  <span className="rounded-md bg-[#f3f2ec] px-2 py-1">
                    Motion: <strong>{slide.theme.motion}</strong>
                  </span>
                  <span className="rounded-md bg-[#f3f2ec] px-2 py-1">
                    Copy: <strong>{slide.copyRegister}</strong>
                  </span>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={openStore}
                  className="mt-4 w-full rounded-xl bg-[#116b5f] px-5 py-3 text-sm font-bold text-white shadow-xs transition-colors hover:bg-[#0d564c] disabled:opacity-50"
                >
                  {busy ? "Opening Taraba…" : "Open the real store with this setup →"}
                </button>
                <p className="mt-1.5 text-center text-[11px] text-[#707873]">
                  Replays these actions live in Taraba with the Lab indicator sidebar.
                </p>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
