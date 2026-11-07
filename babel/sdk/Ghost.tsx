"use client";
// Demo/testing: replays a synthetic shopper through the real UI. A visible cursor scrolls to each
// target, moves onto it and really clicks it, so the store's own handlers record the event exactly
// as they would for a person. Events with nothing to click (page view, idle, hovering the price)
// are recorded directly while the cursor rests on the spot.
// Stores opt in by tagging elements with data-ghost="<eventType>" or "<eventType>:<value>".
import type { EventType, InteractionEvent } from "@/babel/schema";

export type GhostCursor = { x: number; y: number; label: string; clicks: number; visible: boolean };

const LEAD_MS = 1100; // scroll, then glide onto the target before the event's time
const WALK_ON_MS = 6000;

const TEXT: Partial<Record<EventType, string>> = {
  page_view: "opens the product page",
  hover_price: "looks at the price",
  review_open: "opens the reviews",
  idle: "stops and thinks",
  add_to_cart: "clicks Add to cart",
  remove_from_cart: "clicks Remove from cart",
  block_open: "opens the details",
};
export function describeEvent(e: InteractionEvent): string {
  if (e.type === "policy_open" && typeof e.value === "string") return `opens the ${e.value} policy`;
  return TEXT[e.type] ?? e.type.replaceAll("_", " ");
}

function targetFor(e: InteractionEvent): HTMLElement | null {
  const scope: ParentNode | null = e.blockId ? document.querySelector(`[data-babel-block="${e.blockId}"]`) : document;
  if (!scope) return null;
  const exact = e.value !== undefined ? scope.querySelector<HTMLElement>(`[data-ghost="${e.type}:${e.value}"]`) : null;
  return exact ?? scope.querySelector<HTMLElement>(`[data-ghost="${e.type}"]`) ?? (e.blockId ? (scope as HTMLElement) : null);
}

function centre(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const big = r.height > 120; // on a whole block, point near its top instead of the middle
  return { x: r.left + Math.min(r.width / 2, 160), y: big ? r.top + 48 : r.top + r.height / 2 };
}

export function runGhost(
  events: InteractionEvent[],
  io: { push: (e: InteractionEvent) => void; note: (text: string) => void; cursor: (c: (prev: GhostCursor) => GhostCursor) => void; done?: () => void },
): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, Math.max(0, ms)));

  for (const e of events) {
    at(e.t - LEAD_MS, () => targetFor(e)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    at(e.t - LEAD_MS / 2, () => {
      const el = targetFor(e);
      if (el) io.cursor((c) => ({ ...c, ...centre(el), label: describeEvent(e), visible: true }));
    });
    at(e.t, () => {
      io.note(describeEvent(e));
      const el = targetFor(e);
      const clickable = el?.matches("summary, button") && el.dataset.ghost?.startsWith(e.type);
      if (el) io.cursor((c) => ({ ...c, ...centre(el), label: describeEvent(e), visible: true, clicks: clickable ? c.clicks + 1 : c.clicks }));
      // A <details> that is already open would close on click; record the repeat look instead.
      const alreadyOpen = el?.tagName === "SUMMARY" && el.parentElement instanceof HTMLDetailsElement && el.parentElement.open;
      if (clickable && !alreadyOpen) el!.click();
      else io.push(e);
    });
  }
  // Walks on to the next page a little after the last event, so the agent has had time to answer.
  if (io.done) at(Math.max(0, ...events.map((e) => e.t)) + WALK_ON_MS, () => { io.note("goes on to the next page"); io.done!(); });
  return () => timers.forEach(clearTimeout);
}

export function GhostCursorView({ c, name }: { c: GhostCursor; name: string }) {
  if (!c.visible) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-[60]"
      style={{ transform: `translate(${c.x}px, ${c.y}px)`, transition: "transform 500ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}
    >
      {c.clicks > 0 && <span key={c.clicks} className="babel-ghost-click absolute -top-4 -left-4 h-8 w-8 rounded-full border-2 border-[#e5484d]" />}
      <svg width="22" height="26" viewBox="0 0 22 26" className="drop-shadow">
        <path d="M2 2 L2 21 L7.5 16 L11 24 L14.5 22.5 L11 14.8 L18.5 14.8 Z" fill="#14171f" stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      {c.label && (
        <span className="absolute top-5 left-5 rounded-md bg-[#e5484d] px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-white shadow">
          {name} {c.label}
        </span>
      )}
    </div>
  );
}
