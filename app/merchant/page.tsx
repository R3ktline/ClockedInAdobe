"use client";
// Clean merchant dashboard: live sessions, behavioral markers, signal model traits, Director trace,
// learned store defaults, registry gaps, and merchant copilot.
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { MarkerId, Markers, Persona } from "@/babel/schema";
import type { TraceEntry } from "@/babel/session";

type Feed = {
  llm: {
    mocked: boolean;
    model: string;
    calls: number;
    errors: number;
    cacheHitTokens: number;
    cacheMissTokens: number;
    outputTokens: number;
  };
  defaults: {
    id: string;
    store: string;
    template: string;
    rationale: string;
    evidence: string[];
    simulated: boolean;
    mocked: boolean;
    at: number;
    active: boolean;
    pending?: boolean;
    changes: { id: string; variant?: string; order?: number; collapsed?: boolean }[];
  }[];
  gaps: {
    id: string;
    store: string;
    template: string;
    block: string;
    wanted: string;
    why: string;
    count: number;
    mocked: boolean;
    draft?: string;
  }[];
  visits: {
    id: string;
    store: string;
    template: string;
    productId?: string;
    returning: boolean;
    standardView: boolean;
    ageMs: number;
    persona: Persona;
    markers: Markers;
    events: number;
    eventCounts?: Record<string, number>;
    trace: TraceEntry[];
    shopper: Shopper | null;
    slides: { index: number; kind: string; source: string; rationale: string }[];
  }[];
};

type Shopper = {
  suggested: {
    dialect: string;
    need: string;
    confidence: number;
    dialectWhy: string;
    needWhy: string;
    copyRegister: string;
    giftContext: boolean;
  };
  traits: Record<string, { value: number; confidence: number }>;
  stage: string;
  buyingFor: string;
};

type ChatTurn = {
  role: "merchant" | "agent";
  text: string;
  outcome?: "applied" | "reverted" | "answer" | "hold" | "error";
  evidence?: string[];
};

type NavTab = "overview" | "visits" | "defaults" | "gaps";
type TraceFilter = "all" | "slide" | "trigger" | "other";

const TRAIT_LABEL: Record<string, string> = {
  infoAppetite: "Wants detail",
  jargonComfort: "Technical comfort",
  priceSensitivity: "Price sensitivity",
  trustNeed: "Needs reassurance",
  inspirationAppetite: "Visual browsing",
  interactionFluency: "Site fluency",
  confusion: "Seems lost",
};

const MARKER_LABEL: Record<string, string> = {
  hesitation: "Hesitation",
  confusion: "Confusion",
  trustNeed: "Reassurance need",
  priceSensitivity: "Price focus",
  specDepth: "Spec depth",
  visualBrowse: "Visual browsing",
  abandonmentRisk: "Exit risk",
  decisiveness: "Decisiveness",
};

const KIND_BADGE: Record<TraceEntry["kind"], { label: string; cls: string; dot: string }> = {
  visit: { label: "Opened", cls: "bg-[#eef0ec] text-[#454d48]", dot: "bg-[#7c857f]" },
  trigger: { label: "Trigger", cls: "bg-[#fdf3df] text-[#8a5a0a]", dot: "bg-[#d99b26]" },
  slide: { label: "Slide", cls: "bg-[#dff0ec] text-[#0f5c51]", dot: "bg-[#116b5f]" },
  hold: { label: "Hold", cls: "bg-[#ecefe9] text-[#4b534f]", dot: "bg-[#8a938d]" },
  result: { label: "Bet check", cls: "bg-[#e3f3e8] text-[#166534]", dot: "bg-[#16a34a]" },
  skip: { label: "Skipped", cls: "bg-[#f2f3ef] text-[#707873]", dot: "bg-[#b0b7b2]" },
};

const ARROW = { up: "↑", down: "↓", flat: "→" } as const;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatChangeChip(c: { id: string; variant?: string; order?: number; collapsed?: boolean }): string {
  const parts = [c.id];
  if (c.variant) parts.push(`→ ${c.variant.replaceAll("_", " ")}`);
  if (c.collapsed !== undefined) parts.push(c.collapsed ? "(collapsed)" : "(expanded)");
  if (c.order !== undefined) parts.push(`#${c.order}`);
  return parts.join(" ");
}

function MiniSparkline({ values, color = "#116b5f", fill = "#116b5f" }: { values: number[]; color?: string; fill?: string }) {
  const pts = values.length >= 2 ? values : values.length === 1 ? [values[0] * 0.6, values[0]] : [0, 0, 0, 0];
  const max = Math.max(...pts, 1);
  const w = 88;
  const h = 32;
  const coords = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * w;
    const y = h - 4 - (v / max) * (h - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linePath = `M ${coords.join(" L ")}`;
  const areaPath = `${linePath} L ${w},${h} L 0,${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0 overflow-visible">
      <path d={areaPath} fill={fill} fillOpacity={0.12} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KpiCard({
  icon,
  iconBg,
  label,
  value,
  badge,
  badgeTone = "teal",
  sub,
  simulated,
  sparkValues,
  sparkColor,
}: {
  icon: ReactNode;
  iconBg: string;
  label: string;
  value: string;
  badge?: string;
  badgeTone?: "teal" | "amber" | "slate" | "red";
  sub: string;
  simulated?: boolean;
  sparkValues: number[];
  sparkColor: string;
}) {
  const tones = {
    teal: "bg-[#dff0ec] text-[#0f5c51]",
    amber: "bg-[#fdf3df] text-[#8a5a0a]",
    slate: "bg-[#eef0ec] text-[#4b534f]",
    red: "bg-[#fdeaea] text-[#a62929]",
  };
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#e6e4dc] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,20,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}>{icon}</span>
        <MiniSparkline values={sparkValues} color={sparkColor} fill={sparkColor} />
      </div>
      <div className="mt-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-[#6c746f]">{label}</span>
          {simulated && (
            <span className="rounded bg-[#fdf3df] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#8a5a0a] uppercase">
              simulated
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-[#161c1a] tabular-nums">{value}</span>
          {badge && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[badgeTone]}`}>{badge}</span>}
        </div>
        <p className="mt-1 truncate text-xs text-[#707873]">{sub}</p>
      </div>
    </div>
  );
}

export default function Merchant() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<NavTab>("overview");
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState("");
  const [traceFilter, setTraceFilter] = useState<TraceFilter>("all");
  const [mobileNav, setMobileNav] = useState(false);

  const [looking, setLooking] = useState(false);
  const [lastRun, setLastRun] = useState<{ store: string; template: string; outcome: string; reason: string }[] | null>(null);
  const [drafting, setDrafting] = useState<string | null>(null);

  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatLog, setChatLog] = useState<ChatTurn[]>([]);

  useEffect(() => {
    if (paused) return;
    const load = () =>
      fetch("/api/merchant")
        .then((r) => r.json())
        .then(setFeed)
        .catch(() => {});
    load();
    const id = setInterval(load, 1000);
    return () => clearInterval(id);
  }, [paused]);

  const q = search.trim().toLowerCase();

  const filteredVisits = useMemo(() => {
    const list = feed?.visits ?? [];
    if (!q) return list;
    return list.filter(
      (v) =>
        v.store.toLowerCase().includes(q) ||
        v.template.toLowerCase().includes(q) ||
        (v.productId?.toLowerCase().includes(q) ?? false) ||
        v.persona.dialect.toLowerCase().includes(q) ||
        v.persona.need.toLowerCase().includes(q) ||
        v.trace.some((t) => t.text.toLowerCase().includes(q)),
    );
  }, [feed?.visits, q]);

  const visit =
    filteredVisits.find((v) => v.id === selected) ??
    feed?.visits.find((v) => v.id === selected) ??
    filteredVisits[0] ??
    feed?.visits[0];

  const analyze = async () => {
    setLooking(true);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        body: JSON.stringify({ action: "analyze" }),
      }).then((r) => r.json());
      setLastRun(res.results ?? []);
    } catch {
      setLastRun([]);
    }
    setLooking(false);
  };

  const draft = async (id: string) => {
    setDrafting(id);
    try {
      await fetch("/api/gaps/draft", { method: "POST", body: JSON.stringify({ id }) });
    } finally {
      setDrafting(null);
    }
  };

  const revert = (id: string) =>
    fetch("/api/insights", { method: "POST", body: JSON.stringify({ action: "revert", id }) });

  const approve = (id: string) =>
    fetch("/api/insights", { method: "POST", body: JSON.stringify({ action: "approve", id }) });

  const askCopilot = async (e: FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || chatBusy) return;
    setChatInput("");
    setChatLog((prev) => [...prev, { role: "merchant", text }]);
    setChatBusy(true);
    try {
      const r = await fetch("/api/merchant/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, visitId: visit?.id }),
      });
      const body = (await r.json().catch(() => null)) as {
        outcome?: "applied" | "reverted" | "answer" | "hold";
        said?: string;
        evidence?: string[];
        error?: string;
      } | null;
      if (!r.ok || !body) {
        setChatLog((prev) => [
          ...prev,
          { role: "agent", text: body?.error ?? "Could not reach the merchant copilot.", outcome: "error" },
        ]);
      } else {
        setChatLog((prev) => [
          ...prev,
          {
            role: "agent",
            text: body.said ?? "Done.",
            outcome: body.outcome ?? "answer",
            evidence: body.evidence,
          },
        ]);
      }
    } catch {
      setChatLog((prev) => [...prev, { role: "agent", text: "Network error — nothing changed.", outcome: "error" }]);
    } finally {
      setChatBusy(false);
    }
  };

  const visits = feed?.visits ?? [];
  const activeDefaults = (feed?.defaults ?? []).filter((d) => d.active);
  const returningCount = visits.filter((v) => v.returning).length;
  const totalInTokens = (feed?.llm.cacheHitTokens ?? 0) + (feed?.llm.cacheMissTokens ?? 0);
  const cacheRate = totalInTokens > 0 ? Math.round(((feed?.llm.cacheHitTokens ?? 0) / totalInTokens) * 100) : null;

  const markerEntries = useMemo(() => {
    if (!visit) return [];
    return (Object.entries(visit.markers) as [MarkerId, NonNullable<Markers[MarkerId]>][]).sort(
      (a, b) => b[1].value - a[1].value,
    );
  }, [visit]);

  const traitEntries = useMemo(() => {
    if (!visit?.shopper) return [];
    return Object.entries(visit.shopper.traits).sort((a, b) => b[1].confidence - a[1].confidence);
  }, [visit]);

  const traceEntries = useMemo(() => {
    if (!visit) return [];
    const rev = [...visit.trace].reverse();
    return rev.filter((t) => {
      if (traceFilter === "slide" && t.kind !== "slide") return false;
      if (traceFilter === "trigger" && t.kind !== "trigger") return false;
      if (traceFilter === "other" && (t.kind === "slide" || t.kind === "trigger")) return false;
      if (q && !t.text.toLowerCase().includes(q) && !(t.diff?.join(" ").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [visit, traceFilter, q]);

  const navItem = (id: NavTab, label: string, count?: number, icon?: ReactNode) => {
    const active = tab === id;
    return (
      <button
        type="button"
        onClick={() => {
          setTab(id);
          setMobileNav(false);
        }}
        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${
          active ? "bg-[#dff0ec] font-semibold text-[#0f5c51]" : "text-[#4b534f] hover:bg-[#eceae2] hover:text-[#161c1a]"
        }`}
      >
        <span className="flex items-center gap-2.5">
          {icon}
          <span>{label}</span>
        </span>
        {count !== undefined && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
              active ? "bg-[#116b5f] text-white" : "bg-[#e6e4dc] text-[#4b534f]"
            }`}
          >
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#f8f7f3] text-[#161c1a]">
      {/* Left Sidebar */}
      <aside
        aria-label="Merchant navigation"
        className={`${
          mobileNav ? "fixed inset-y-0 left-0 z-40 flex" : "hidden lg:flex"
        } w-64 shrink-0 flex-col border-r border-[#e6e4dc] bg-[#f4f3ed]`}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between border-b border-[#e6e4dc] px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#116b5f] text-white shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12h4l3-8 4 16 3-8h4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-[#161c1a]">Babel</p>
              <p className="text-[10px] font-semibold tracking-[0.12em] text-[#707873] uppercase">Merchant Panel</p>
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
          {/* Dashboards */}
          <div>
            <p className="mb-2 px-2 text-[11px] font-semibold tracking-[0.08em] text-[#78807b] uppercase">Dashboards</p>
            <div className="flex flex-col gap-1">
              {navItem(
                "overview",
                "Overview",
                undefined,
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>,
              )}
              {navItem(
                "visits",
                "Live Sessions",
                visits.length,
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>,
              )}
              {navItem(
                "defaults",
                "Store Defaults",
                activeDefaults.length,
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 20V10" />
                  <path d="M18 20V4" />
                  <path d="M6 20v-4" />
                </svg>,
              )}
              {navItem(
                "gaps",
                "Registry Gaps",
                feed?.gaps.length ?? 0,
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>,
              )}
            </div>
          </div>

          {/* Live Session Picker */}
          <div className="min-h-0 flex-1">
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-[#78807b] uppercase">Active Visits</p>
              <span className="text-[11px] text-[#78807b] tabular-nums">{filteredVisits.length}</span>
            </div>
            {filteredVisits.length === 0 ? (
              <p className="px-2 text-xs leading-relaxed text-[#707873]">
                {visits.length === 0 ? "No shoppers yet. Launch a ghost shopper or simulator below." : "No visits match your filter."}
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {filteredVisits.map((v) => {
                  const isCurrent = v.id === visit?.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setSelected(v.id);
                        setMobileNav(false);
                      }}
                      aria-current={isCurrent}
                      className={`rounded-xl border p-2.5 text-left transition-all ${
                        isCurrent
                          ? "border-[#116b5f]/40 bg-white shadow-xs"
                          : "border-transparent bg-white/50 hover:border-[#dcdad0] hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-xs font-bold text-[#161c1a]">
                          {v.store} · {v.template}
                        </span>
                        <span className="shrink-0 text-[11px] text-[#707873] tabular-nums">{Math.round(v.ageMs / 1000)}s</span>
                      </div>
                      {v.productId && <p className="truncate text-[11px] text-[#707873]">{v.productId}</p>}
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                            isCurrent ? "bg-[#dff0ec] text-[#0f5c51]" : "bg-[#eceae2] text-[#4b534f]"
                          }`}
                        >
                          {v.persona.dialect} × {v.persona.need}
                        </span>
                        <span className="text-[11px] text-[#707873] tabular-nums">
                          {v.slides.length}v · {v.events}ev
                        </span>
                        {v.returning && (
                          <span className="rounded bg-[#fdf3df] px-1 text-[10px] font-semibold text-[#8a5a0a]">return</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Workspaces */}
          <div className="border-t border-[#e6e4dc] pt-4">
            <p className="mb-2 px-2 text-[11px] font-semibold tracking-[0.08em] text-[#78807b] uppercase">Workspaces</p>
            <div className="flex flex-col gap-1 text-sm">
              <Link
                href="/sim"
                className="flex items-center justify-between rounded-xl px-3 py-2 font-medium text-[#4b534f] hover:bg-[#eceae2] hover:text-[#161c1a]"
              >
                <span>Shopper Simulator</span>
                <span className="text-xs text-[#78807b]">↗</span>
              </Link>
              <Link
                href="/taraba"
                className="flex items-center justify-between rounded-xl px-3 py-2 font-medium text-[#4b534f] hover:bg-[#eceae2] hover:text-[#161c1a]"
              >
                <span>Taraba Storefront</span>
                <span className="text-xs text-[#78807b]">↗</span>
              </Link>
              <Link
                href="/taraba/p/home-wm-01?ghost=radu"
                className="flex items-center justify-between rounded-xl px-3 py-2 font-medium text-[#0f5c51] hover:bg-[#dff0ec]"
              >
                <span>▶ Replay Radu (demo)</span>
                <span className="text-xs">↗</span>
              </Link>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 flex h-16 flex-wrap items-center justify-between gap-3 border-b border-[#e6e4dc] bg-[#faf9f5]/95 px-6 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNav(true)}
              className="rounded-lg border border-[#dcdad0] bg-white px-2.5 py-1.5 text-sm font-medium lg:hidden"
              aria-label="Open navigation"
            >
              ☰
            </button>
            <div className="relative w-64 sm:w-80">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#858d88]"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter visits, products, or trace…"
                aria-label="Filter visits, products, or trace"
                className="w-full rounded-xl border border-[#e2e0d8] bg-white py-1.5 pr-3 pl-9 text-sm text-[#161c1a] placeholder:text-[#8c948f] focus:border-[#116b5f] focus:outline-hidden"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-[#f2dba5] bg-[#fdf3df] px-2.5 py-1 font-semibold text-[#8a5a0a]">
              Simulated shoppers
            </span>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold transition-colors ${
                paused
                  ? "border-[#dcdad0] bg-white text-[#4b534f]"
                  : "border-[#bce0d9] bg-[#e6f4f1] text-[#0f5c51]"
              }`}
              title={paused ? "Resume 1s live polling" : "Pause live polling to inspect trace"}
            >
              <span className={`h-2 w-2 rounded-full ${paused ? "bg-[#8c948f]" : "animate-pulse bg-[#116b5f]"}`} />
              {paused ? "Feed paused" : "Live · 1s"}
            </button>
            {feed && (
              <span className="hidden items-center gap-1.5 rounded-full border border-[#e2e0d8] bg-white px-3 py-1 font-medium text-[#4b534f] sm:inline-flex">
                <span className="font-semibold text-[#161c1a]">{feed.llm.mocked ? "Mock LLM" : feed.llm.model || "DeepSeek"}</span>
                <span>· {feed.llm.calls} calls</span>
                {feed.llm.errors > 0 && <span className="font-bold text-[#b42318]">· {feed.llm.errors} err</span>}
              </span>
            )}
          </div>
        </header>

        {/* Workspace Body */}
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6">
          {/* Page Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#161c1a]">
                {tab === "overview" && "Merchant Overview"}
                {tab === "visits" && "Live Shopper Sessions"}
                {tab === "defaults" && "Learned Store Defaults"}
                {tab === "gaps" && "Component Registry Gaps"}
              </h1>
              <p className="mt-0.5 text-sm text-[#68706b]">
                {tab === "overview" && "Live snapshot of active views, behavioral markers, Director bets, and store-wide learnings."}
                {tab === "visits" && "Inspect every active session's signal read, marker evidence, and full LLM validation transcript."}
                {tab === "defaults" && "Changes the Director repeatedly validates across shoppers become the starting view for new visits."}
                {tab === "gaps" && "Block variants the Director wished existed — safely logged as developer drafts without touching live pages."}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <Link
                href="/sim"
                className="rounded-xl border border-[#dad8cf] bg-white px-3.5 py-2 text-sm font-semibold text-[#2d3430] hover:bg-[#f2f0e8]"
              >
                Open Simulator
              </Link>
              <Link
                href="/demo"
                target="_blank"
                className="rounded-xl border border-[#116b5f] bg-white px-4 py-2 text-sm font-semibold text-[#116b5f] hover:bg-[#ecf7f5]"
              >
                Run demo (simulated)
              </Link>
              <button
                type="button"
                onClick={analyze}
                disabled={looking}
                className="flex items-center gap-2 rounded-xl bg-[#116b5f] px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#0d564c] disabled:opacity-55"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                  <path d="M12 3v3m6.36-.36-2.12 2.12M21 12h-3m.36 6.36-2.12-2.12M12 21v-3m-6.36.36 2.12-2.12M3 12h3m-.36-6.36 2.12 2.12" />
                </svg>
                {looking ? "Analyzing sessions…" : "Look across shoppers"}
              </button>
            </div>
          </div>

          {/* Insights Run Result Banner */}
          {lastRun && (
            <div className="flex items-start justify-between gap-4 rounded-2xl border border-[#bce0d9] bg-[#ecf7f5] px-4 py-3 text-sm text-[#0f5c51]">
              <div>
                <p className="font-semibold">Cross-shopper analysis finished</p>
                {!lastRun.length ? (
                  <p className="mt-0.5 text-xs text-[#2b6159]">No shopper sessions yet — replay a ghost shopper first.</p>
                ) : (
                  <ul className="mt-1 flex flex-col gap-0.5 text-xs text-[#2b6159]">
                    {lastRun.map((r, i) => (
                      <li key={i}>
                        <strong className="font-semibold">
                          {r.store} · {r.template}
                        </strong>{" "}
                        ({r.outcome === "suggested" ? "suggested, awaiting your approval" : r.outcome === "hold" ? "held" : "no change"}) — {r.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                type="button"
                onClick={() => setLastRun(null)}
                className="rounded-lg px-2 py-0.5 text-xs font-semibold text-[#0f5c51] hover:bg-[#d5ece7]"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* 4 KPI Summary Cards */}
          <section aria-label="Summary indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              iconBg="bg-[#dff0ec] text-[#116b5f]"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
              }
              label="Active Sessions"
              simulated
              value={String(visits.length)}
              badge={returningCount > 0 ? `${returningCount} returning` : "first visits"}
              badgeTone="teal"
              sub={visits.length ? `${visits.reduce((s, v) => s + v.events, 0)} interaction events recorded` : "Waiting for store traffic"}
              sparkValues={visits.slice(0, 8).reverse().map((v) => v.events)}
              sparkColor="#116b5f"
            />

            <KpiCard
              iconBg="bg-[#e6eff5] text-[#24587a]"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M9 4v16" />
                </svg>
              }
              label="Selected View"
              simulated={!!visit}
              value={visit ? `${visit.persona.dialect} × ${visit.persona.need}` : "—"}
              badge={visit ? `conf ${visit.persona.confidence.toFixed(2)}` : undefined}
              badgeTone="slate"
              sub={
                visit
                  ? `${visit.store} · ${visit.template}${visit.productId ? ` (${visit.productId})` : ""} · ${visit.slides.length} slide${visit.slides.length === 1 ? "" : "s"}`
                  : "Select a live visit to inspect"
              }
              sparkValues={visit ? visit.slides.map((_, i) => i + 1) : [0, 0]}
              sparkColor="#24587a"
            />

            <KpiCard
              iconBg="bg-[#fdf3df] text-[#b87a14]"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 20V10" />
                  <path d="M18 20V4" />
                  <path d="M6 20v-4" />
                </svg>
              }
              label="Active Defaults"
              simulated={activeDefaults.some((d) => d.simulated)}
              value={String(activeDefaults.length)}
              badge={`${feed?.gaps.length ?? 0} gaps`}
              badgeTone="amber"
              sub={`${feed?.defaults.length ?? 0} total defaults proposed`}
              sparkValues={(feed?.gaps ?? []).slice(0, 6).map((g) => g.count)}
              sparkColor="#d99b26"
            />

            <KpiCard
              iconBg="bg-[#ecefe9] text-[#3d4641]"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              }
              label="LLM & Token Meter"
              value={feed ? `${feed.llm.calls} calls` : "—"}
              badge={
                feed
                  ? feed.llm.mocked
                    ? "mock"
                    : cacheRate !== null
                      ? `${cacheRate}% cached`
                      : "live"
                  : undefined
              }
              badgeTone={feed?.llm.errors ? "red" : feed?.llm.mocked ? "slate" : "teal"}
              sub={
                feed
                  ? `${formatTokens(feed.llm.cacheHitTokens)} hit · ${formatTokens(feed.llm.cacheMissTokens)} miss · ${formatTokens(feed.llm.outputTokens)} out`
                  : "Connecting to /api/merchant…"
              }
              sparkValues={
                feed ? [feed.llm.cacheHitTokens, feed.llm.cacheMissTokens, feed.llm.outputTokens] : [0, 0, 0]
              }
              sparkColor="#116b5f"
            />
          </section>

          {/* OVERVIEW & VISITS CONTENT */}
          {(tab === "overview" || tab === "visits") && (
            <>
              {!visit ? (
                <section className="rounded-2xl border border-[#e6e4dc] bg-white p-8 text-center shadow-[0_1px_2px_rgba(16,24,20,0.03)]">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#dff0ec] text-[#116b5f]">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M3 12h4l3-8 4 16 3-8h4" />
                    </svg>
                  </div>
                  <h2 className="mt-3 text-lg font-bold text-[#161c1a]">No active shopper sessions yet</h2>
                  <p className="mx-auto mt-1 max-w-md text-sm text-[#68706b]">
                    Open a store page, build a custom shopper in the simulator, or launch a ghost shopper replay to watch markers and Director slides stream in live.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <Link
                      href="/taraba/p/home-wm-01?ghost=radu"
                      className="rounded-xl bg-[#116b5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d564c]"
                    >
                      ▶ Replay Ghost Shopper (Radu)
                    </Link>
                    <Link
                      href="/sim"
                      className="rounded-xl border border-[#dad8cf] bg-white px-4 py-2 text-sm font-semibold text-[#161c1a] hover:bg-[#f2f0e8]"
                    >
                      Build Setup in Simulator
                    </Link>
                  </div>
                </section>
              ) : (
                <>
                  {/* Selected Session Summary Strip */}
                  <section className="rounded-2xl border border-[#e6e4dc] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,20,0.03)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-[#116b5f] px-2.5 py-1 text-xs font-bold text-white uppercase">
                          {visit.store}
                        </span>
                        <span className="text-sm font-bold text-[#161c1a]">
                          {visit.template}
                          {visit.productId ? ` · ${visit.productId}` : ""}
                        </span>
                        <span className="rounded-full bg-[#fdf3df] px-2 py-0.5 text-[11px] font-semibold text-[#8a5a0a]">
                          simulated
                        </span>
                        {visit.returning && (
                          <span className="rounded-full bg-[#dff0ec] px-2.5 py-0.5 text-xs font-semibold text-[#0f5c51]">
                            Return visit
                          </span>
                        )}
                        {visit.standardView && (
                          <span className="rounded-full bg-[#ecefe9] px-2.5 py-0.5 text-xs font-semibold text-[#4b534f]">
                            Standard view (opted out)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#68706b] tabular-nums">
                        <span>Session {visit.id.slice(0, 8)}</span>
                        <span>· {Math.round(visit.ageMs / 1000)}s on page</span>
                        <span>· {visit.events} events</span>
                      </div>
                    </div>

                    {/* Slide Progression Pills */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#efede6] pt-3">
                      <span className="text-xs font-semibold text-[#707873]">Slide timeline:</span>
                      {visit.slides.map((s, idx) => (
                        <div key={s.index} className="flex items-center gap-2">
                          {idx > 0 && <span className="text-xs text-[#9ca39e]">→</span>}
                          <span
                            title={s.rationale}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                              idx === visit.slides.length - 1
                                ? "border-[#116b5f]/35 bg-[#ecf7f5] font-semibold text-[#0f5c51]"
                                : "border-[#e6e4dc] bg-[#f8f7f3] text-[#4b534f]"
                            }`}
                          >
                            #{s.index + 1} {s.kind} <span className="text-[#707873]">({s.source})</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* 2-Column Visual Charts: Behavioral Markers + Signal Model Traits */}
                  <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
                    {/* Behavioral Markers Horizontal Bar Chart */}
                    <section className="rounded-2xl border border-[#e6e4dc] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,20,0.03)]">
                      <div className="flex items-baseline justify-between gap-2">
                        <div>
                          <h2 className="text-base font-bold text-[#161c1a]">Behavioral Markers</h2>
                          <p className="text-xs text-[#707873]">
                            Scored 0–1 from {visit.events} session events · dashed tick at 0.60 calls the Director (simulated)
                          </p>
                        </div>
                      </div>

                      {markerEntries.length === 0 ? (
                        <p className="mt-6 text-sm text-[#707873]">No marker signals scored yet for this visit.</p>
                      ) : (
                        <ul className="mt-4 flex flex-col gap-3.5">
                          {markerEntries.map(([id, m]) => {
                            const high = m.value >= 0.75;
                            const triggered = m.value >= 0.6;
                            const barColor = high ? "bg-[#c83e3b]" : triggered ? "bg-[#d99b26]" : "bg-[#116b5f]";
                            return (
                              <li key={id}>
                                <div className="grid grid-cols-[8.5rem_1fr_4.5rem] items-center gap-3 text-sm">
                                  <span className="truncate font-medium text-[#2d3430]" title={id}>
                                    {MARKER_LABEL[id] ?? id}
                                  </span>
                                  <div
                                    className="relative h-3 overflow-hidden rounded-full bg-[#f0efe9]"
                                    role="meter"
                                    aria-label={id}
                                    aria-valuenow={m.value}
                                    aria-valuemin={0}
                                    aria-valuemax={1}
                                  >
                                    <div
                                      className="absolute top-0 bottom-0 z-10 w-px border-r border-dashed border-[#161c1a]/35"
                                      style={{ left: "60%" }}
                                      title="Director trigger threshold (0.60)"
                                    />
                                    <div
                                      className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                                      style={{ width: `${Math.max(2, Math.round(m.value * 100))}%` }}
                                    />
                                  </div>
                                  <span
                                    className={`text-right text-xs font-semibold tabular-nums ${
                                      triggered ? "text-[#9a5b08]" : "text-[#4b534f]"
                                    }`}
                                  >
                                    {m.value.toFixed(2)} {ARROW[m.trend]}
                                  </span>
                                </div>
                                {m.evidence.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1 pl-[9.25rem]">
                                    {m.evidence.slice(-4).map((e, idx) => (
                                      <span
                                        key={idx}
                                        className="rounded bg-[#f5f4ee] px-1.5 py-0.5 text-[11px] text-[#68706b] tabular-nums"
                                      >
                                        {e.type}
                                        {e.note ? ` (${e.note})` : ""} @{(e.t / 1000).toFixed(1)}s
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>

                    {/* Signal Model Read & Traits */}
                    <section className="rounded-2xl border border-[#e6e4dc] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,20,0.03)]">
                      <h2 className="text-base font-bold text-[#161c1a]">Signal Model Read</h2>
                      <p className="text-xs text-[#707873]">
                        Suggested view from interaction signals · confidence &lt; 0.55 stays neutral
                      </p>

                      {!visit.shopper ? (
                        <p className="mt-6 text-sm text-[#707873]">No signal model profile available for this session.</p>
                      ) : (
                        <>
                          <div className="mt-3 rounded-xl border border-[#e6e4dc] bg-[#faf9f5] p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-lg bg-[#dff0ec] px-2.5 py-1 text-sm font-bold text-[#0f5c51]">
                                {visit.shopper.suggested.dialect} × {visit.shopper.suggested.need}
                              </span>
                              <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-[#4b534f] tabular-nums">
                                conf {visit.shopper.suggested.confidence.toFixed(2)}
                              </span>
                              <span className="rounded-md bg-white px-2 py-0.5 text-xs text-[#4b534f]">
                                stage: <strong className="font-semibold">{visit.shopper.stage}</strong>
                              </span>
                              <span className="rounded-md bg-white px-2 py-0.5 text-xs text-[#4b534f]">
                                copy: <strong className="font-semibold">{visit.shopper.suggested.copyRegister}</strong>
                              </span>
                              {visit.shopper.suggested.giftContext && (
                                <span className="rounded-md bg-[#fdf3df] px-2 py-0.5 text-xs font-semibold text-[#8a5a0a]">
                                  gift context
                                </span>
                              )}
                            </div>
                            <div className="mt-2 grid gap-1 text-xs text-[#4b534f]">
                              <p>
                                <span className="font-semibold text-[#161c1a]">Dialect why:</span> {visit.shopper.suggested.dialectWhy}
                              </p>
                              <p>
                                <span className="font-semibold text-[#161c1a]">Need why:</span> {visit.shopper.suggested.needWhy}
                              </p>
                            </div>
                          </div>

                          <ul className="mt-4 flex flex-col gap-2.5">
                            {traitEntries.map(([name, t]) => {
                              const sure = t.confidence >= 0.55;
                              return (
                                <li key={name} className="grid grid-cols-[8.5rem_1fr_6.5rem] items-center gap-3 text-xs">
                                  <span className={sure ? "font-semibold text-[#161c1a]" : "text-[#78807b]"}>
                                    {TRAIT_LABEL[name] ?? name}
                                  </span>
                                  <div
                                    className="relative h-2.5 overflow-hidden rounded-full bg-[#f0efe9]"
                                    role="meter"
                                    aria-label={name}
                                    aria-valuenow={t.value}
                                    aria-valuemin={0}
                                    aria-valuemax={1}
                                  >
                                    <div className="absolute top-0 bottom-0 z-10 w-px bg-[#161c1a]/25" style={{ left: "50%" }} />
                                    <div
                                      className={`h-full rounded-full transition-all ${sure ? "bg-[#116b5f]" : "bg-[#c8cec9]"}`}
                                      style={{ width: `${Math.round(t.value * 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-right text-[#4b534f] tabular-nums">
                                    {t.value.toFixed(2)} · <span className={sure ? "font-semibold text-[#0f5c51]" : "text-[#858d88]"}>c {t.confidence.toFixed(2)}</span>
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </>
                      )}
                    </section>
                  </div>

                  {/* Row 2: Director Trace + Copilot / Defaults Summary */}
                  <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
                    {/* Director Trace */}
                    <section className="rounded-2xl border border-[#e6e4dc] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,20,0.03)]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h2 className="text-base font-bold text-[#161c1a]">Director Trace</h2>
                          <p className="text-xs text-[#707873]">Newest decisions first · expand any LLM call to inspect raw input & verdict</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(
                            [
                              ["all", "All"],
                              ["slide", "Slides"],
                              ["trigger", "Triggers"],
                              ["other", "Holds & Bets"],
                            ] as const
                          ).map(([k, label]) => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => setTraceFilter(k)}
                              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                                traceFilter === k
                                  ? "bg-[#116b5f] text-white"
                                  : "bg-[#f3f2ec] text-[#4b534f] hover:bg-[#e6e4dc]"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {traceEntries.length === 0 ? (
                        <p className="mt-6 text-sm text-[#707873]">No trace entries match this filter yet.</p>
                      ) : (
                        <ol className="mt-4 flex flex-col gap-3">
                          {traceEntries.map((t, i) => {
                            const style = KIND_BADGE[t.kind];
                            return (
                              <li
                                key={`${t.at}-${i}`}
                                className="rounded-xl border border-[#eceae2] bg-[#fcfbf8] p-3.5 text-sm"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-bold ${style.cls}`}>
                                      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                                      {style.label}
                                    </span>
                                    <span className="text-xs font-medium text-[#707873] tabular-nums">
                                      {(t.at / 1000).toFixed(1)}s
                                    </span>
                                  </div>
                                  {t.ms !== undefined && (
                                    <span className="text-xs text-[#707873] tabular-nums">
                                      {t.rounds} round{t.rounds === 1 ? "" : "s"} · {t.ms} ms · {t.mocked ? "mock" : t.llm?.model || "live"}
                                    </span>
                                  )}
                                </div>

                                <p className="mt-1.5 text-sm leading-snug text-[#161c1a]">{t.text}</p>

                                {t.hypothesis && t.kind === "slide" && (
                                  <p className="mt-1.5 inline-block rounded-lg bg-[#ecf7f5] px-2.5 py-1 text-xs font-medium text-[#0f5c51]">
                                    Bet: <strong>{t.hypothesis.marker}</strong> goes <strong>{t.hypothesis.expect}</strong> within{" "}
                                    {t.hypothesis.withinSeconds}s
                                    {t.hypothesis.outcome && <> · outcome: <strong>{t.hypothesis.outcome.replace("_", " ")}</strong></>}
                                  </p>
                                )}

                                {t.diff && t.diff.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {t.diff.map((d, idx) => (
                                      <span
                                        key={idx}
                                        className="rounded-md border border-[#e2e0d8] bg-white px-2 py-0.5 text-xs text-[#2d3430]"
                                      >
                                        {d}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {t.errors?.map((e, j) => (
                                  <p key={j} className="mt-2 rounded-lg bg-[#fdeaea] px-2.5 py-1.5 text-xs font-medium text-[#a62929]">
                                    Rejected & repaired: {e.join("; ")}
                                  </p>
                                ))}

                                {t.clamps && t.clamps.length > 0 && (
                                  <p className="mt-2 rounded-lg bg-[#fdf3df] px-2.5 py-1.5 text-xs font-medium text-[#8a5a0a]">
                                    Brand clamp: {t.clamps.join("; ")}
                                  </p>
                                )}

                                {t.llm && (
                                  <details
                                    className="mt-2.5 rounded-xl border border-[#e6e4dc] bg-white p-2.5"
                                    open={i === 0 && t.kind !== "trigger"}
                                  >
                                    <summary className="cursor-pointer text-xs font-semibold text-[#2d3430]">
                                      LLM conversation · {t.llm.model}
                                    </summary>
                                    <details className="mt-2">
                                      <summary className="cursor-pointer text-xs text-[#707873]">
                                        Input sent to agent (&lt;data&gt;)
                                      </summary>
                                      <pre className="mt-1.5 max-h-56 overflow-auto rounded-lg bg-[#f6f5f0] p-2.5 text-[11px] leading-relaxed text-[#2d3430]">
                                        {t.llm.input}
                                      </pre>
                                    </details>
                                    <ol className="mt-2 flex flex-col gap-2">
                                      {t.llm.rounds.map((r, j) => (
                                        <li key={j} className="rounded-lg bg-[#f8f7f3] p-2.5 text-xs">
                                          <p className="font-semibold text-[#161c1a]">
                                            Round {j + 1} · {(r.ms / 1000).toFixed(1)}s ·{" "}
                                            <span className={r.verdict === "accepted" ? "text-[#0f5c51]" : "text-[#8a5a0a]"}>
                                              {r.verdict}
                                            </span>
                                          </p>
                                          {r.said && <p className="mt-1 whitespace-pre-wrap text-[#4b534f]">{r.said}</p>}
                                          {r.call && (
                                            <pre className="mt-1.5 overflow-auto rounded bg-white p-2 text-[11px] whitespace-pre-wrap text-[#161c1a]">
                                              {r.call.name}({JSON.stringify(r.call.args, null, 1)})
                                            </pre>
                                          )}
                                        </li>
                                      ))}
                                    </ol>
                                  </details>
                                )}
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </section>

                    {/* Right Column: Merchant Copilot + Active Defaults + Registry Gaps Quick View */}
                    <div className="flex flex-col gap-6">
                      {/* Merchant Copilot */}
                      <section className="rounded-2xl border border-[#e6e4dc] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,20,0.03)]">
                        <h2 className="text-base font-bold text-[#161c1a]">Merchant Copilot</h2>
                        <p className="text-xs text-[#707873]">
                          Ask about <strong className="font-semibold">{visit.template}</strong> pages or promote/undo a measured block change
                        </p>

                        {chatLog.length > 0 && (
                          <div className="mt-3 flex max-h-56 flex-col gap-2 overflow-y-auto rounded-xl bg-[#f8f7f3] p-3 text-xs">
                            {chatLog.map((m, idx) => (
                              <div
                                key={idx}
                                className={`rounded-lg p-2.5 ${
                                  m.role === "merchant"
                                    ? "ml-6 bg-[#116b5f] text-white"
                                    : "mr-4 border border-[#e6e4dc] bg-white text-[#161c1a]"
                                }`}
                              >
                                {m.outcome && m.role === "agent" && (
                                  <span className="mb-1 inline-block rounded bg-[#ecf7f5] px-1.5 py-0.5 text-[10px] font-bold text-[#0f5c51] uppercase">
                                    {m.outcome}
                                  </span>
                                )}
                                <p className="leading-relaxed">{m.text}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        <form onSubmit={askCopilot} className="mt-3 flex gap-2">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="e.g. Move trust higher for new visits, or undo…"
                            className="flex-1 rounded-xl border border-[#dcdad0] bg-[#faf9f5] px-3 py-2 text-sm text-[#161c1a] placeholder:text-[#8c948f] focus:border-[#116b5f] focus:bg-white focus:outline-hidden"
                          />
                          <button
                            type="submit"
                            disabled={chatBusy || !chatInput.trim()}
                            className="rounded-xl bg-[#116b5f] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#0d564c] disabled:opacity-50"
                          >
                            {chatBusy ? "…" : "Ask"}
                          </button>
                        </form>
                      </section>

                      {tab === "overview" && (
                        <>
                          {/* Compact Defaults Preview */}
                          <section className="rounded-2xl border border-[#e6e4dc] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,20,0.03)]">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <h2 className="text-base font-bold text-[#161c1a]">Learned Store Defaults</h2>
                                <p className="text-xs text-[#707873]">Starting view updates backed by repeated sessions</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setTab("defaults")}
                                className="text-xs font-semibold text-[#116b5f] hover:underline"
                              >
                                View all ({feed?.defaults.length ?? 0})
                              </button>
                            </div>
                            <DefaultsList defaults={(feed?.defaults ?? []).slice(0, 3)} onRevert={revert} onApprove={approve} />
                          </section>

                          {/* Compact Gaps Preview */}
                          <section className="rounded-2xl border border-[#e6e4dc] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,20,0.03)]">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <h2 className="text-base font-bold text-[#161c1a]">Component Registry Gaps</h2>
                                <p className="text-xs text-[#707873]">Missing variants requested by the Director</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setTab("gaps")}
                                className="text-xs font-semibold text-[#116b5f] hover:underline"
                              >
                                View all ({feed?.gaps.length ?? 0})
                              </button>
                            </div>
                            <GapsList gaps={(feed?.gaps ?? []).slice(0, 3)} drafting={drafting} onDraft={draft} />
                          </section>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* DEDICATED DEFAULTS TAB */}
          {tab === "defaults" && (
            <section
              aria-labelledby="defaults-h"
              className="rounded-2xl border border-[#e6e4dc] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,20,0.03)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 id="defaults-h" className="text-lg font-bold text-[#161c1a]">
                    What shoppers have in common
                  </h2>
                  <p className="text-sm text-[#68706b]">
                    Validated block changes the Director keeps making across sessions become the store&apos;s default opening layout.
                  </p>
                </div>
              </div>
              <DefaultsList defaults={feed?.defaults ?? []} onRevert={revert} onApprove={approve} />
            </section>
          )}

          {/* DEDICATED GAPS TAB */}
          {tab === "gaps" && (
            <section
              aria-labelledby="gaps-h"
              className="rounded-2xl border border-[#e6e4dc] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,20,0.03)]"
            >
              <h2 id="gaps-h" className="text-lg font-bold text-[#161c1a]">
                What the agent wished the store had
              </h2>
              <p className="text-sm text-[#68706b]">
                Nothing here alters a live page. Each entry is a component variant the Director looked for; generate a TypeScript draft for developer review.
              </p>
              <GapsList gaps={feed?.gaps ?? []} drafting={drafting} onDraft={draft} />
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function DefaultsList({
  defaults,
  onRevert,
  onApprove,
}: {
  defaults: Feed["defaults"];
  onRevert: (id: string) => void;
  onApprove: (id: string) => void;
}) {
  if (!defaults.length) {
    return (
      <p className="mt-4 rounded-xl bg-[#f8f7f3] p-4 text-xs text-[#707873]">
        No learned store defaults yet. Replay a few shoppers and click &ldquo;Look across shoppers&rdquo;.
      </p>
    );
  }
  return (
    <ul className="mt-4 flex flex-col gap-3">
      {defaults.map((d) => (
        <li
          key={d.id}
          className={`rounded-xl border p-4 text-sm ${
            d.active ? "border-[#bce0d9] bg-[#f4fbf9]" : d.pending ? "border-[#ecd49a] bg-[#fffaf0]" : "border-[#e6e4dc] bg-[#f8f7f3] text-[#68706b]"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-[#161c1a]">
                {d.store} · {d.template}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${
                  d.active ? "bg-[#116b5f] text-white" : d.pending ? "bg-[#fdf3df] text-[#8a5a0a]" : "bg-[#e2e0d8] text-[#5c645f]"
                }`}
              >
                {d.active ? "Active" : d.pending ? "Suggested" : "Reverted"}
              </span>
              <span className="rounded bg-[#fdf3df] px-1.5 py-0.5 text-[11px] font-semibold text-[#8a5a0a]">
                {d.simulated ? "simulated sessions" : "live sessions"}
              </span>
              {d.mocked && (
                <span className="rounded bg-[#ecefe9] px-1.5 py-0.5 text-[11px] font-semibold text-[#4b534f]">
                  mock LLM
                </span>
              )}
            </div>
            {(d.active || d.pending) && (
              <div className="flex gap-1.5">
                {d.pending && (
                  <button
                    type="button"
                    onClick={() => onApprove(d.id)}
                    className="rounded-lg bg-[#116b5f] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#0d564c]"
                  >
                    Approve
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRevert(d.id)}
                  className="rounded-lg border border-[#d4d2c9] bg-white px-2.5 py-1 text-xs font-semibold text-[#2d3430] hover:bg-[#f2f0e8]"
                >
                  {d.pending ? "Dismiss" : "Revert"}
                </button>
              </div>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {d.changes.map((c, idx) => (
              <span
                key={idx}
                className="rounded-md border border-[#d6e6e2] bg-white px-2 py-0.5 text-xs font-medium text-[#161c1a]"
              >
                {formatChangeChip(c)}
              </span>
            ))}
          </div>

          <p className="mt-2 text-xs leading-relaxed text-[#2d3430]">{d.rationale}</p>

          {d.evidence.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium text-[#68706b]">
                Measured evidence ({d.evidence.length})
              </summary>
              <ul className="mt-1 list-disc pl-5 text-xs text-[#68706b]">
                {d.evidence.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

function GapsList({
  gaps,
  drafting,
  onDraft,
}: {
  gaps: Feed["gaps"];
  drafting: string | null;
  onDraft: (id: string) => void;
}) {
  if (!gaps.length) {
    return <p className="mt-4 rounded-xl bg-[#f8f7f3] p-4 text-xs text-[#707873]">No missing variant requests logged yet.</p>;
  }
  return (
    <ul className="mt-4 flex flex-col gap-3">
      {gaps.map((x) => (
        <li key={x.id} className="rounded-xl border border-[#e6e4dc] bg-[#faf9f5] p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-[#161c1a]">
                {x.store} · {x.template} · {x.block}
              </span>
              <span className="rounded-full bg-[#dff0ec] px-2 py-0.5 text-xs font-semibold text-[#0f5c51] tabular-nums">
                asked {x.count}×
              </span>
              {x.mocked && (
                <span className="rounded bg-[#ecefe9] px-1.5 py-0.5 text-[11px] font-semibold text-[#4b534f]">
                  mock LLM
                </span>
              )}
            </div>
            {!x.draft && (
              <button
                type="button"
                onClick={() => onDraft(x.id)}
                disabled={drafting === x.id}
                className="rounded-lg border border-[#d4d2c9] bg-white px-2.5 py-1 text-xs font-semibold text-[#161c1a] hover:bg-[#f0efe9] disabled:opacity-50"
              >
                {drafting === x.id ? "Drafting…" : "Draft variant"}
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs font-medium text-[#161c1a]">{x.wanted}</p>
          <p className="mt-0.5 text-xs text-[#68706b]">{x.why}</p>
          {x.draft && (
            <p className="mt-2 inline-block rounded-md bg-white px-2 py-1 text-xs text-[#0f5c51]">
              Draft saved: <code className="font-mono">{x.draft}</code>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
