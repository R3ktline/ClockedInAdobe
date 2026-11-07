"use client";
// Taraba's cart and checkout pages. They sit outside Babel (no BabelProvider): the shopper just buys.
// Prices come from the catalog by product id; the cart only holds ids and quantities.
import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/babel/sdk";
import { canAdd, COURIER_FEE, courierFee, FREE_DELIVERY_OVER, linesOf, MAX_QTY, subtotal, useCart, type Line } from "./cart";
import brandKit from "./brand-kit.json";
import { card, Header, lei, Picture } from "./pages";

const field = "w-full rounded-[var(--babel-radius)] border border-black/20 bg-white px-3 py-2";
const primary = "rounded-[var(--babel-radius)] bg-[var(--c-primary)] px-6 py-3 text-center font-bold text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-primary)]";
const Simulated = () => <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold">simulated</span>;

// Outside BabelProvider nobody sets the brand variables, so set the brand's own defaults here.
const { colors, fonts } = brandKit;
const brandVars = {
  "--c-primary": colors.primary, "--c-accent": colors.accent, "--c-text": colors.text, "--c-muted": colors.muted,
  "--babel-radius": "8px", "--font-heading": fonts.heading,
  fontFamily: fonts.body, background: colors.surface, color: colors.text,
} as React.CSSProperties;

function Shell({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div style={brandVars} className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6 pb-16">
        <h1 className="mb-4 text-3xl font-extrabold" style={{ fontFamily: "var(--font-heading)" }}>{title}</h1>
        {children}
      </main>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className={`${card} p-8 text-center`}>
      <p className="text-lg font-semibold">{text}</p>
      <Link href="/taraba" className={`${primary} mt-4 inline-block`}>Continue shopping</Link>
    </div>
  );
}

function Summary({ items, sub, delivery }: { items: Line[]; sub: number; delivery?: number }) {
  const row = "flex justify-between";
  return (
    <div className={`${card} flex h-fit flex-col gap-2 p-5`}>
      <h2 className="text-xl font-bold">Order summary</h2>
      <p className={row}><span>Products ({items.reduce((a, l) => a + l.q, 0)})</span><span>{lei.format(sub)}</span></p>
      {delivery === undefined ? (
        <p className="text-sm text-[var(--c-muted)]">Delivery is free over {lei.format(FREE_DELIVERY_OVER)}, otherwise {lei.format(COURIER_FEE)}. Chosen at checkout.</p>
      ) : (
        <p className={row}><span>Delivery</span><span>{delivery === 0 ? "Free" : lei.format(delivery)}</span></p>
      )}
      <p className={`${row} border-t border-black/10 pt-2 text-xl font-extrabold`}><span>Total</span><span>{lei.format(sub + (delivery ?? 0))}</span></p>
    </div>
  );
}

export function CartPage({ products }: { products: Product[] }) {
  const cart = useCart();
  const items = linesOf(products, cart.lines);
  const sub = subtotal(items);
  return (
    <Shell title="Your cart">
      {!cart.ready ? null : items.length === 0 ? <Empty text="Your cart is empty." /> : (
        <div className="grid gap-6 md:grid-cols-[1fr_20rem]">
          <ul className="flex flex-col gap-3">
            {items.map(({ p, q }) => (
              <li key={p.id} className={`${card} flex gap-4 p-4`}>
                <Picture p={p} size="lg" />
                <div className="flex flex-1 flex-col gap-1">
                  <Link href={`/taraba/p/${p.id}`} className="text-lg font-bold hover:underline">{p.name}</Link>
                  <p className="text-sm text-[var(--c-muted)]">{p.brand} · {lei.format(p.price)} each · delivery in {p.policies.deliveryDays} days</p>
                  <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
                    <span className="flex items-center rounded-[var(--babel-radius)] border border-black/20" role="group" aria-label={`Quantity of ${p.name}`}>
                      <button type="button" aria-label="One less" onClick={() => cart.set(p.id, q - 1)} className="px-3 py-1.5 text-lg font-bold">−</button>
                      <span className="min-w-8 text-center" aria-live="polite">{q}</span>
                      <button type="button" aria-label="One more" disabled={!canAdd(p, q)} onClick={() => cart.set(p.id, q + 1)} className="px-3 py-1.5 text-lg font-bold disabled:opacity-40">+</button>
                    </span>
                    <button type="button" onClick={() => cart.set(p.id, 0)} className="font-semibold text-[var(--c-primary)] underline">Remove</button>
                    {q >= Math.min(p.stock, MAX_QTY) && <span className="text-sm text-[var(--c-muted)]">Maximum for this product</span>}
                    <span className="ml-auto text-xl font-extrabold">{lei.format(p.price * q)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3">
            <Summary items={items} sub={sub} />
            <Link href="/taraba/checkout" className={primary}>Go to checkout</Link>
          </div>
        </div>
      )}
    </Shell>
  );
}

type Order = { no: string; items: Line[]; sub: number; delivery: number; days: number; name: string; email: string; where: string; pay: string };

export function CheckoutPage({ products }: { products: Product[] }) {
  const cart = useCart();
  const [ship, setShip] = useState<"courier" | "pickup">("courier");
  const [pay, setPay] = useState<"cod" | "card">("cod");
  const [order, setOrder] = useState<Order | null>(null);
  const items = linesOf(products, cart.lines);
  const sub = subtotal(items);
  const delivery = ship === "pickup" ? 0 : courierFee(sub);

  if (order) {
    return (
      <Shell title="Thank you, order placed">
        <div className={`${card} flex flex-col gap-3 p-6`} role="status">
          <p className="text-lg">Order <strong>{order.no}</strong> is confirmed. A confirmation goes to {order.email}. <Simulated /></p>
          <p>Estimated delivery in {order.days} days to {order.where}. Payment: {order.pay}.</p>
          <ul className="border-t border-black/10 pt-3">
            {order.items.map(({ p, q }) => <li key={p.id} className="flex justify-between py-1"><span>{q} × {p.name}</span><span>{lei.format(p.price * q)}</span></li>)}
          </ul>
          <p className="flex justify-between border-t border-black/10 pt-2 text-xl font-extrabold"><span>Total</span><span>{lei.format(order.sub + order.delivery)}</span></p>
          <p className="text-sm text-[var(--c-muted)]">Taraba is a demo store: nothing was charged or shipped.</p>
          <Link href="/taraba" className={`${primary} self-start`}>Continue shopping</Link>
        </div>
      </Shell>
    );
  }

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    setOrder({
      no: `TB-${Math.floor(100000 + Math.random() * 900000)}`, items, sub, delivery,
      days: Math.max(...items.map((l) => l.p.policies.deliveryDays)),
      name: v("name"), email: v("email"),
      where: ship === "pickup" ? `pickup point in ${v("city")}` : `${v("address")}, ${v("city")}`,
      pay: pay === "cod" ? "cash on delivery" : "card (simulated)",
    });
    cart.clear();
  };

  return (
    <Shell title="Checkout">
      {!cart.ready ? null : items.length === 0 ? <Empty text="Your cart is empty, so there is nothing to check out." /> : (
        <form onSubmit={submit} className="grid gap-6 md:grid-cols-[1fr_20rem]">
          <div className="flex flex-col gap-5">
            <fieldset className={`${card} grid gap-3 p-5 sm:grid-cols-2`}>
              <legend className="px-1 text-xl font-bold">Your details</legend>
              <label className="flex flex-col gap-1 font-semibold">Full name<input name="name" required autoComplete="name" className={`${field} font-normal`} /></label>
              <label className="flex flex-col gap-1 font-semibold">Email<input name="email" type="email" required autoComplete="email" className={`${field} font-normal`} /></label>
              <label className="flex flex-col gap-1 font-semibold">Phone<input name="phone" type="tel" required autoComplete="tel" className={`${field} font-normal`} /></label>
              <label className="flex flex-col gap-1 font-semibold">City<input name="city" required autoComplete="address-level2" className={`${field} font-normal`} /></label>
              {ship === "courier" && (
                <label className="flex flex-col gap-1 font-semibold sm:col-span-2">Street and number<input name="address" required autoComplete="street-address" className={`${field} font-normal`} /></label>
              )}
            </fieldset>
            <fieldset className={`${card} flex flex-col gap-2 p-5`}>
              <legend className="px-1 text-xl font-bold">Delivery</legend>
              <label className="flex items-center gap-2"><input type="radio" name="ship" checked={ship === "courier"} onChange={() => setShip("courier")} className="accent-[var(--c-primary)]" /> Courier to your door · {courierFee(sub) === 0 ? "free" : lei.format(COURIER_FEE)}</label>
              <label className="flex items-center gap-2"><input type="radio" name="ship" checked={ship === "pickup"} onChange={() => setShip("pickup")} className="accent-[var(--c-primary)]" /> Pickup point · free</label>
            </fieldset>
            <fieldset className={`${card} flex flex-col gap-2 p-5`}>
              <legend className="px-1 text-xl font-bold">Payment</legend>
              <label className="flex items-center gap-2"><input type="radio" name="pay" checked={pay === "cod"} onChange={() => setPay("cod")} className="accent-[var(--c-primary)]" /> Cash on delivery</label>
              <label className="flex items-center gap-2"><input type="radio" name="pay" checked={pay === "card"} onChange={() => setPay("card")} className="accent-[var(--c-primary)]" /> Card online <Simulated /></label>
              {pay === "card" && <p className="text-sm text-[var(--c-muted)]">Demo store: no card details are asked for and nothing is charged.</p>}
            </fieldset>
          </div>
          <div className="flex flex-col gap-3">
            <Summary items={items} sub={sub} delivery={delivery} />
            <button type="submit" className={primary}>Place order · {lei.format(sub + delivery)}</button>
            <Link href="/taraba/cart" className="text-center font-semibold text-[var(--c-primary)] underline">Back to cart</Link>
          </div>
        </form>
      )}
    </Shell>
  );
}
