// Taraba's cart: product id -> quantity, kept in localStorage so it survives navigation and reloads.
// Only ids and quantities are stored; prices always come from the catalog (SPEC rule 2).
// shortcut: per-browser only (no server cart, no stock reservation); fine for the demo.
import { useMemo, useSyncExternalStore } from "react";
import type { Product } from "@/babel/sdk";

const KEY = "taraba-cart";
export const MAX_QTY = 10;
export const FREE_DELIVERY_OVER = 200; // RON, subtotal
export const COURIER_FEE = 19; // RON

const subs = new Set<() => void>();
const read = () => { try { return localStorage.getItem(KEY) ?? "{}"; } catch { return "{}"; } };
const subscribe = (f: () => void) => {
  subs.add(f);
  window.addEventListener("storage", f); // other tabs
  return () => { subs.delete(f); window.removeEventListener("storage", f); };
};
const write = (lines: Record<string, number>) => {
  try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* private mode: cart just doesn't persist */ }
  subs.forEach((f) => f());
};
const noop = () => () => {};

export function useCart() {
  const raw = useSyncExternalStore(subscribe, read, () => "{}");
  const ready = useSyncExternalStore(noop, () => true, () => false); // false during SSR/hydration: avoids an empty-cart flash
  const lines = useMemo<Record<string, number>>(() => { try { return JSON.parse(raw); } catch { return {}; } }, [raw]);
  const count = Object.values(lines).reduce((a, b) => a + b, 0);
  const set = (id: string, n: number) => {
    const next = { ...lines };
    const q = Math.max(0, Math.min(MAX_QTY, n));
    if (q === 0) delete next[id]; else next[id] = q;
    write(next);
  };
  return {
    ready, lines, count,
    qty: (id: string) => lines[id] ?? 0,
    add: (id: string) => set(id, (lines[id] ?? 0) + 1),
    set,
    clear: () => write({}),
  };
}

export type Line = { p: Product; q: number };
export const linesOf = (products: Product[], lines: Record<string, number>): Line[] =>
  Object.entries(lines).flatMap(([id, q]) => { const p = products.find((x) => x.id === id); return p ? [{ p, q }] : []; });
export const subtotal = (items: Line[]) => items.reduce((a, { p, q }) => a + p.price * q, 0);
export const courierFee = (sub: number) => (sub >= FREE_DELIVERY_OVER ? 0 : COURIER_FEE);
// Can this product still be added? (stock and per-order cap)
export const canAdd = (p: Product, inCart: number) => p.stock > 0 && inCart < Math.min(p.stock, MAX_QTY);
