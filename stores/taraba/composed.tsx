"use client";
// Taraba's renderers for pages the Composer agent builds (/taraba/ai?q=..., what the header search sends). The agent
// only picks elements and product ids; every price, spec, review and policy below is read from the catalog here.
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { ComposedElement, ComposedPage, Product } from "@/babel/sdk";
import { canAdd, useCart } from "./cart";
import { card, lei, Picture } from "./pages";
import { Shell } from "./shop";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Step = { tool: string; args: unknown; verdict: string; ms: number };
type Outcome = { page: ComposedPage; steps: Step[]; mocked: boolean; ms: number; reason?: string };

export function ComposedPageView({ request, initial, products }: { request: string; initial?: ComposedPage; products: Product[] }) {
  const { t, lang } = useI18n();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [failed, setFailed] = useState("");
  const [compare, setCompare] = useState(false);
  useEffect(() => {
    if (!initial) return;
    const ctl = new AbortController();
    fetch("/api/compose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ store: "taraba", request, lang }), signal: ctl.signal })
      .then(async (r) => (r.ok ? setOutcome(await r.json()) : setFailed((await r.json()).error ?? "failed")))
      .catch((e) => { if (!ctl.signal.aborted) setFailed(String(e)); });
    return () => ctl.abort();
  }, [request, initial, lang]);

  const byId = new Map(products.map((p) => [p.id, p]));
  const page = outcome ? outcome.page : initial;
  const fromAgent = outcome?.page.source === "agent";
  const sideBySide = compare && fromAgent && initial;
  return (
    <Shell title={page?.title ?? t("ai.title")} query={request}>
      {initial && (
        <div role="status" className={`${card} mb-5 p-3 text-sm`}>
          {!outcome && !failed && <p>{t("ai.working")}</p>}
          {failed && <p>{t("ai.failed", { error: failed })}</p>}
          {outcome && (
            <>
              <p className="font-semibold">
                {fromAgent ? `${t("ai.byAgent")}${outcome.mocked ? ` (${t("ai.offline")})` : ""}` : t("ai.fellBack", { reason: outcome.reason ?? "" })}
                <span className="font-normal text-[var(--c-muted)]"> · {t("ai.stats", { calls: outcome.steps.length, secs: (outcome.ms / 1000).toFixed(1) })}</span>
              </p>
              <p className="mt-1">{outcome.page.rationale}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {fromAgent && (
                  <button type="button" aria-pressed={compare} onClick={() => setCompare((v) => !v)} className="underline">
                    {compare ? t("ai.compareOff") : t("ai.compare")}
                  </button>
                )}
                <details>
                  <summary className="cursor-pointer underline">{t("ai.steps")}</summary>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 font-mono text-xs">
                    {outcome.steps.map((s, i) => <li key={i}>{s.tool}({JSON.stringify(s.args)?.slice(0, 140)}) → {s.verdict.slice(0, 200)}</li>)}
                  </ol>
                </details>
              </div>
            </>
          )}
        </div>
      )}

      {sideBySide ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {([
            [t("ai.withoutAi"), t("ai.withoutAiSub"), initial],
            [t("ai.withAi"), outcome.page.rationale, outcome.page],
          ] as const).map(([label, sub, p]) => (
            <section key={label} aria-label={label} className="min-w-0 rounded-[var(--babel-radius)] border border-black/10 p-3">
              <h2 className="text-xl font-extrabold" style={{ fontFamily: "var(--font-heading)" }}>{label}</h2>
              <p className="mb-3 text-sm text-[var(--c-muted)]">{sub} · {t("ai.sections", { count: p.elements.length })}</p>
              <Elements elements={p.elements} byId={byId} narrow />
            </section>
          ))}
        </div>
      ) : page ? <Elements elements={page.elements} byId={byId} /> : <p>{t("ai.empty")}</p>}
    </Shell>
  );
}

// Two `half` elements in a row share a line; everything else takes the full width.
function Elements({ elements, byId, narrow = false }: { elements: ComposedElement[]; byId: Map<string, Product>; narrow?: boolean }) {
  return (
    <div className={`grid gap-5 ${narrow ? "" : "md:grid-cols-2"}`}>
      {elements.map((e, i) => {
        const pairedHalf = e.width === "half" && (elements[i - 1]?.width === "half" || elements[i + 1]?.width === "half");
        return <div key={i} className={pairedHalf || narrow ? "min-w-0" : "min-w-0 md:col-span-2"}><Element e={e} byId={byId} /></div>;
      })}
    </div>
  );
}

function Element({ e, byId }: { e: ComposedElement; byId: Map<string, Product> }): ReactNode {
  const ps = (ids: string[]) => ids.flatMap((id) => byId.get(id) ?? []);
  switch (e.type) {
    case "heading": return <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>{e.text}</h2>;
    case "note": return <p className="text-lg">{e.text}</p>;
    case "products": return <Products products={ps(e.ids)} layout={e.layout} specKeys={e.specKeys ?? []} />;
    case "compare": return <Compare products={ps(e.ids)} specKeys={e.specKeys} />;
    case "reviews": { const p = byId.get(e.productId); return p ? <Reviews p={p} picks={e.picks} /> : null; }
    case "prosCons": { const p = byId.get(e.productId); return p ? <ProsCons p={p} /> : null; }
    case "policies": return <Policies products={ps(e.ids)} />;
    case "buy": { const p = byId.get(e.productId); return p ? <Buy p={p} /> : null; }
  }
}

const spec = (p: Product, key: string) => p.specs.find((s) => s.key === key);
const name = (p: Product) => <Link href={`/taraba/p/${p.id}`} className="font-semibold hover:underline">{p.name}</Link>;
const price = (p: Product) => (
  <span className="text-lg font-extrabold">
    {lei.format(p.price)}
    {p.promotion && <s className="ml-2 text-sm font-normal text-[var(--c-muted)]">{lei.format(p.promotion.oldPrice)}</s>}
  </span>
);

function Add({ p }: { p: Product }) {
  const { t } = useI18n();
  const cart = useCart();
  const n = cart.qty(p.id);
  return (
    <span className="flex items-center gap-2">
      <button type="button" disabled={!canAdd(p, n)} onClick={() => cart.add(p.id)} aria-label={t("list.addAria", { name: p.name })}
        className="rounded-[var(--babel-radius)] border border-[var(--c-primary)] px-3 py-1.5 text-sm font-bold text-[var(--c-primary)] hover:bg-[var(--c-primary)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-primary)] disabled:opacity-50">
        {p.stock === 0 ? t("buy.outOfStock") : t("buy.add")}
      </button>
      {n > 0 && <span className="text-sm text-[var(--c-muted)]" role="status">✓ {t("buy.inCart", { count: n })}</span>}
    </span>
  );
}

function Stars({ p }: { p: Product }) {
  const { t } = useI18n();
  return <span className="text-sm text-[var(--c-muted)]">★ {p.rating.toFixed(1)} · {t("common.reviews", { count: p.reviewCount })}</span>;
}

function Products({ products, layout, specKeys }: { products: Product[]; layout: "grid" | "list" | "feature"; specKeys: string[] }) {
  const specLine = (p: Product) => specKeys.flatMap((k) => spec(p, k) ?? []).map((s) => (
    <li key={s.key}><span className="text-[var(--c-muted)]">{s.label}:</span> {s.value}</li>
  ));
  if (layout === "feature") {
    return (
      <div className="flex flex-col gap-4">
        {products.map((p) => (
          <article key={p.id} className={`${card} flex flex-col gap-4 p-4 sm:flex-row`}>
            <Picture p={p} size="lg" />
            <div className="flex flex-col gap-2">
              {name(p)}<Stars p={p} />{price(p)}
              <ul className="text-sm">{specLine(p)}</ul>
              <Add p={p} />
            </div>
          </article>
        ))}
      </div>
    );
  }
  return (
    <ul className={layout === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" : "flex flex-col gap-2"}>
      {products.map((p) => (
        <li key={p.id} className={`${card} flex gap-3 p-3 ${layout === "grid" ? "flex-col" : "items-center"}`}>
          <Picture p={p} size={layout === "grid" ? "md" : "sm"} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {name(p)}<Stars p={p} />{price(p)}
            {specKeys.length > 0 && <ul className="text-sm">{specLine(p)}</ul>}
          </div>
          <Add p={p} />
        </li>
      ))}
    </ul>
  );
}

function Compare({ products, specKeys }: { products: Product[]; specKeys: string[] }) {
  const { t } = useI18n();
  const rows: [string, (p: Product) => ReactNode][] = [
    [t("ai.price"), (p) => price(p)],
    [t("ai.rating"), (p) => `★ ${p.rating.toFixed(1)} (${t("common.reviews", { count: p.reviewCount })})`],
    ...specKeys.map((k): [string, (p: Product) => ReactNode] => [products.map((p) => spec(p, k)?.label).find(Boolean) ?? k, (p) => spec(p, k)?.value ?? "–"]),
  ];
  return (
    <div className={`${card} overflow-x-auto`}>
      <table className="w-full text-left text-sm">
        <thead><tr><th scope="col" className="p-3"><span className="sr-only">{t("ai.spec")}</span></th>{products.map((p) => <th key={p.id} scope="col" className="p-3 align-bottom"><Picture p={p} size="sm" />{name(p)}</th>)}</tr></thead>
        <tbody>
          {rows.map(([label, cell]) => (
            <tr key={label} className="border-t border-black/10"><th scope="row" className="p-3 font-semibold">{label}</th>{products.map((p) => <td key={p.id} className="p-3">{cell(p)}</td>)}</tr>
          ))}
          <tr className="border-t border-black/10"><th scope="row" className="p-3"><span className="sr-only">{t("ai.addToCart")}</span></th>{products.map((p) => <td key={p.id} className="p-3"><Add p={p} /></td>)}</tr>
        </tbody>
      </table>
    </div>
  );
}

function Reviews({ p, picks }: { p: Product; picks: number[] }) {
  const { t } = useI18n();
  return (
    <section className={`${card} p-4`} aria-label={`${t("ai.reviewsOf")} ${p.name}`}>
      <p className="mb-2 text-sm">{t("ai.reviewsOf")} {name(p)} <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold">{t("common.simulated")}</span></p>
      <div className="flex flex-col gap-3">
        {picks.flatMap((i) => p.reviews[i] ?? []).map((r, i) => (
          <blockquote key={i} className="border-l-4 border-[var(--c-accent)] pl-3">
            <p className="font-semibold">{"★".repeat(r.rating)} {r.title}</p>
            <p>{r.text}</p>
            <footer className="text-sm text-[var(--c-muted)]">{r.author} · {r.date}{r.verified ? ` · ${t("ai.verified")}` : ""}</footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}

function ProsCons({ p }: { p: Product }) {
  const { t } = useI18n();
  return (
    <section className={`${card} grid gap-4 p-4 sm:grid-cols-2`} aria-label={`${t("ai.reviewersSay")} ${p.name}`}>
      <p className="sm:col-span-2 text-sm">{t("ai.reviewersSay")} {name(p)}</p>
      <div><h3 className="font-bold">{t("ai.pros")}</h3><ul className="list-disc pl-5">{p.reviewSummary.pros.map((x) => <li key={x}>{x}</li>)}</ul></div>
      <div><h3 className="font-bold">{t("ai.cons")}</h3><ul className="list-disc pl-5">{p.reviewSummary.cons.map((x) => <li key={x}>{x}</li>)}</ul></div>
    </section>
  );
}

function Policies({ products }: { products: Product[] }) {
  const { t } = useI18n();
  return (
    <div className={`${card} overflow-x-auto`}>
      <table className="w-full text-left text-sm">
        <thead><tr><th scope="col" className="p-3">{t("ai.product")}</th><th scope="col" className="p-3">{t("ai.returns")}</th><th scope="col" className="p-3">{t("ai.warranty")}</th><th scope="col" className="p-3">{t("ai.delivery")}</th></tr></thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-t border-black/10">
              <th scope="row" className="p-3">{name(p)}</th>
              <td className="p-3">{t("ai.days", { count: p.policies.returnDays })}</td><td className="p-3">{t("ai.months", { count: p.policies.warrantyMonths })}</td><td className="p-3">{t("ai.days", { count: p.policies.deliveryDays })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Buy({ p }: { p: Product }) {
  const { t } = useI18n();
  return (
    <section className={`${card} flex flex-col gap-2 p-4`} aria-label={p.name}>
      {name(p)}{price(p)}
      {p.promotion && <p className="text-sm">{p.promotion.label}</p>}
      <p className="text-sm">{p.stock > 0 ? t("ai.inStock") : t("ai.outOfStock")} · {t("ai.deliveryIn", { count: p.policies.deliveryDays })} · {t("ai.returnsDays", { count: p.policies.returnDays })}</p>
      <Add p={p} />
    </section>
  );
}
