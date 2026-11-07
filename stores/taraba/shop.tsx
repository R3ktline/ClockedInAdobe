"use client";
// Cart and a mocked checkout (no payments: SPEC non-goal). Babel does not adapt these pages: the path to paying
// stays the same for everyone, and nothing here is personalised.
import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/babel/sdk";
import { courierFee, linesOf, subtotal, useCart } from "./cart";
import { Header, Picture, card, lei, primaryBtn } from "./ui";

function Totals({ products }: { products: Product[] }) {
  const { lines } = useCart();
  const items = linesOf(products, lines);
  const sub = subtotal(items), fee = courierFee(sub);
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-y-1">
      <dt>Subtotal</dt><dd className="text-right">{lei.format(sub)}</dd>
      <dt>Delivery</dt><dd className="text-right">{fee ? lei.format(fee) : "Free"}</dd>
      <dt className="font-bold">Total</dt><dd className="text-right font-bold">{lei.format(sub + fee)}</dd>
    </dl>
  );
}

export function CartPage({ products }: { products: Product[] }) {
  const cart = useCart();
  const items = linesOf(products, cart.lines);
  return (
    <div className="min-h-screen bg-[#f7f0e4] text-[#24271f]" style={{ fontFamily: "'Trebuchet MS', Arial, sans-serif", ["--c-primary" as string]: "#294d3b", ["--c-accent" as string]: "#e7b84a", ["--babel-radius" as string]: "11px" }}>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-3xl font-extrabold">Your cart</h1>
        {!cart.ready ? null : items.length === 0 ? <p className="mt-4">Your cart is empty. <Link className="underline" href="/taraba">Back to the store</Link></p> : (
          <div className="mt-4 grid gap-4">
            <ul className={`${card} divide-y divide-black/10`}>
              {items.map(({ p, q }) => (
                <li key={p.id} className="flex items-center gap-3 p-3">
                  <Picture p={p} size="sm" />
                  <Link className="flex-1 font-semibold hover:underline" href={`/taraba/p/${p.id}`}>{p.name}</Link>
                  <label className="flex items-center gap-1 text-sm">Qty
                    <input type="number" min={0} max={10} value={q} onChange={(e) => cart.set(p.id, Number(e.target.value))} className="w-14 rounded border border-black/20 px-1 py-0.5" />
                  </label>
                  <span className="w-24 text-right font-bold">{lei.format(p.price * q)}</span>
                </li>
              ))}
            </ul>
            <div className={`${card} p-4`}><Totals products={products} /><Link href="/taraba/checkout" className={`mt-3 block px-4 py-3 text-center ${primaryBtn}`}>Go to checkout</Link></div>
          </div>
        )}
      </main>
    </div>
  );
}

export function CheckoutPage({ products }: { products: Product[] }) {
  const cart = useCart();
  const [done, setDone] = useState(false);
  return (
    <div className="min-h-screen bg-[#f7f0e4] text-[#24271f]" style={{ fontFamily: "'Trebuchet MS', Arial, sans-serif", ["--c-primary" as string]: "#294d3b", ["--c-accent" as string]: "#e7b84a", ["--babel-radius" as string]: "11px" }}>
      <Header />
      <main className="mx-auto max-w-xl px-4 py-6">
        <h1 className="text-3xl font-extrabold">Checkout</h1>
        <p className="mt-1 rounded bg-black/5 px-3 py-2 text-sm">Demo store: no payment is taken and no order is sent.</p>
        {done ? <p className="mt-4 text-lg font-semibold">Order placed (demo). <Link className="underline" href="/taraba">Back to the store</Link></p> : (
          <div className={`${card} mt-4 p-4`}>
            <Totals products={products} />
            <button disabled={!cart.count} onClick={() => { cart.clear(); setDone(true); }} className={`mt-4 w-full px-4 py-3 ${primaryBtn}`}>Place order (demo)</button>
          </div>
        )}
      </main>
    </div>
  );
}
