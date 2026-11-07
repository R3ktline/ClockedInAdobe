"use client";
// Taraba's shared pieces: header, pictures, stars, recently viewed. "The store's own code": it imports only babel/sdk.
import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import type { Category, Product } from "@/babel/sdk";
import { ProductArt } from "./art";
import { useCart } from "./cart";

export const lei = new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 });
export const CATEGORY_LABEL: Record<Category, string> = {
  electronics: "Electronics", fashion: "Fashion", home: "Home & furniture",
  groceries: "Groceries", toys: "Toys", health_beauty: "Health & beauty",
};
export const CATEGORY_TINT: Record<Category, string> = {
  electronics: "#e7ecfb", fashion: "#f6e9ef", home: "#e9f3ec", groceries: "#fbf3df", toys: "#fdeee3", health_beauty: "#eef0f6",
};
export const card = "rounded-[var(--babel-radius)] border border-black/10 bg-white";
export const primaryBtn = "rounded-[var(--babel-radius)] bg-[var(--c-primary)] font-bold text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-primary)] disabled:opacity-50";

export function Header({ query = "" }: { query?: string }) {
  const { count, ready } = useCart();
  return (
    <header className="bg-[var(--c-primary)] text-white">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link href="/taraba" className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>taraba</Link>
        <form action="/taraba/search" role="search" className="flex min-w-0 flex-1">
          <input type="search" name="q" defaultValue={query} aria-label="Search the store" placeholder="Search products…"
            className="min-w-0 flex-1 rounded-full bg-white px-4 py-2 text-[var(--c-text)] placeholder:text-[#5b6170]" />
        </form>
        <Link href="/taraba/cart" className="rounded-full bg-[var(--c-accent)] px-3 py-1.5 text-sm font-bold text-[#14171f]" aria-label={`Cart, ${ready ? count : 0} items`}>
          Cart · {ready ? count : 0}
        </Link>
      </div>
      <nav aria-label="Categories" className="mx-auto flex max-w-5xl gap-4 overflow-x-auto px-4 pb-2 text-sm text-white/90">
        {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
          <Link key={c} href={`/taraba/c/${c}`} className="whitespace-nowrap hover:underline">{CATEGORY_LABEL[c]}</Link>
        ))}
      </nav>
    </header>
  );
}

export function Picture({ p, size = "md" }: { p: Product; size?: "sm" | "md" | "lg" }) {
  const h = size === "md" ? "aspect-square" : size === "lg" ? "h-32 w-32 shrink-0 sm:h-40 sm:w-40" : "h-14 w-14 shrink-0";
  return <div className={`${h} overflow-hidden rounded-[var(--babel-radius)]`}><ProductArt p={p} decorative /></div>;
}

export const Stars = ({ p }: { p: Product }) => (
  <span className="text-sm text-[var(--c-muted)]">★ {p.rating.toFixed(1)} · {p.reviewCount} reviews</span>
);

export const Simulated = () => <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold">simulated</span>;

// ---------- recently viewed (this browser only; product ids, nothing else) ----------
const RECENT = "taraba-recent";
const subs = new Set<() => void>();
const readRecent = () => { try { return localStorage.getItem(RECENT) ?? "[]"; } catch { return "[]"; } };
export function rememberViewed(id: string) {
  try {
    const list = (JSON.parse(readRecent()) as string[]).filter((x) => x !== id);
    localStorage.setItem(RECENT, JSON.stringify([id, ...list].slice(0, 8)));
    subs.forEach((f) => f());
  } catch { /* private mode */ }
}
export function useRecent(): string[] {
  const raw = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, readRecent, () => "[]");
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}
export function useRememberViewed(id: string) { useEffect(() => rememberViewed(id), [id]); }
