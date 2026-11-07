// Checks a page the composer agent built (ComposedPage) before any shopper sees it: schema, real catalog ids,
// real spec keys and reviews, and the few words the model wrote (no urgency, no labels for people, no invented numbers).
import { ComposedPage, type BrandKit, type Product } from "@/babel/schema";

// Urgency, discounts and labels for people never appear in text the model writes (rules 7 and 8).
const BANNED = /\b(discount|sale|% off|countdown|hurry|last chance|only \d+ left|limited|scarcity|urgen\w*|elderly|seniors?|young|older|boomers?|gen z|millennials?)\b/i;
// A price, a percentage or any number of two or more digits must come from the catalog, not from the model.
const NUMBER = /\d[\d.,]*\s*(lei|ron|%)|\d{2,}/gi;

export type ComposeCheck = { request: string; byId: (id: string) => Product | undefined; brand: BrandKit };
export type ComposedResult = { ok: true; page: ComposedPage } | { ok: false; errors: string[] };

export function validateComposed(raw: unknown, { request, byId, brand }: ComposeCheck): ComposedResult {
  const parsed = ComposedPage.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const page = parsed.data;
  const errors: string[] = [];
  const asked = request.toLowerCase();
  const text = (where: string, s: string) => {
    if (BANNED.test(s)) errors.push(`${where}: no urgency, discounts or labels for people`);
    const word = brand.bannedWords.find((w) => s.toLowerCase().includes(w.toLowerCase()));
    if (word) errors.push(`${where}: "${word}" is a banned word for this store`);
    for (const n of s.match(NUMBER) ?? []) {
      if (!asked.includes(n.toLowerCase().replace(/\s*(lei|ron|%)$/, ""))) errors.push(`${where}: "${n}" is a number the shopper did not give; numbers come from the catalog elements`);
    }
  };
  const product = (where: string, id: string) => {
    const p = byId(id);
    if (!p) errors.push(`${where}: no product with id "${id}" (use search_products)`);
    return p;
  };
  const specs = (where: string, ps: (Product | undefined)[], keys: string[]) => {
    for (const k of keys) if (!ps.some((p) => p?.specs.some((s) => s.key === k))) errors.push(`${where}: no product here has the spec "${k}"`);
  };

  text("title", page.title);
  text("rationale", page.rationale);
  page.elements.forEach((e, i) => {
    const at = `elements.${i} (${e.type})`;
    switch (e.type) {
      case "heading": case "note": text(at, e.text); break;
      case "products": case "compare": case "policies": {
        if (new Set(e.ids).size !== e.ids.length) errors.push(`${at}: the same product twice`);
        const ps = e.ids.map((id) => product(at, id));
        if (e.type !== "policies") specs(at, ps, e.specKeys ?? []);
        break;
      }
      case "reviews": {
        const p = product(at, e.productId);
        const bad = p && e.picks.filter((n) => n >= p.reviews.length);
        if (bad?.length) errors.push(`${at}: ${p!.id} has ${p!.reviews.length} reviews (indices 0-${p!.reviews.length - 1})`);
        break;
      }
      case "prosCons": case "buy": product(at, e.productId); break;
    }
  });
  if (!page.elements.some((e) => e.type !== "heading" && e.type !== "note")) errors.push("elements: the page needs at least one catalog element (products, compare, reviews, ...)");
  return errors.length ? { ok: false, errors } : { ok: true, page };
}
