import { describe, expect, it } from "vitest";
import { BrandKit } from "@/babel/schema";
import { composePage, fallbackPage } from "@/babel/agents/composer";
import { productById } from "@/data/catalog";
import { taraba } from "@/stores/taraba/config";
import { validateComposed } from "./validateComposed";

const brand = BrandKit.parse(taraba.brand);
const request = "quiet washing machine under 2500 lei";
const check = (page: object) => validateComposed({ source: "agent", ...page }, { request, byId: productById, brand });
const good = {
  title: "Quiet washing machines under 2500 lei",
  rationale: "You asked for a quiet machine, so this page compares them on noise.",
  elements: [
    { type: "heading", text: "Compared on noise" },
    { type: "compare", ids: ["home-wm-01", "home-wm-02"], specKeys: ["noise", "capacity"] },
    { type: "reviews", productId: "home-wm-01", picks: [0, 1], width: "half" },
    { type: "policies", ids: ["home-wm-01", "home-wm-02"], width: "half" },
  ],
};

describe("validateComposed", () => {
  it("accepts a page built from real ids, specs and reviews", () => {
    expect(check(good)).toMatchObject({ ok: true });
  });

  it("refuses made-up ids, spec keys and review indices", () => {
    const r = check({ ...good, elements: [
      { type: "products", ids: ["nope-01"], layout: "grid" },
      { type: "compare", ids: ["home-wm-01", "home-wm-02"], specKeys: ["decibels"] },
      { type: "reviews", productId: "home-wm-01", picks: [9] },
    ] });
    expect(r.ok).toBe(false);
    expect(r.ok ? [] : r.errors.join(" | ")).toMatch(/nope-01.*decibels.*indices/);
  });

  it("refuses numbers, urgency and labels for people in the words the model writes", () => {
    for (const text of ["Now only 1999 lei", "Save 20%", "Hurry, last chance", "Picks for seniors"]) {
      expect(check({ ...good, elements: [{ type: "note", text }, ...good.elements] }).ok, text).toBe(false);
    }
  });

  it("refuses a page with no catalog element", () => {
    expect(check({ ...good, elements: [{ type: "heading", text: "Hello" }] }).ok).toBe(false);
  });
});

describe("composer", () => {
  it("falls back to a keyword grid that passes the validator", () => {
    const page = fallbackPage(request);
    expect(page.elements.at(-1)).toMatchObject({ type: "products", layout: "grid" });
    expect(validateComposed(page, { request, byId: productById, brand }).ok).toBe(true);
  });

  it("offline stand-in searches, then composes a valid page", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const o = await composePage(request, brand);
    expect(o.mocked).toBe(true);
    expect(o.steps.map((s) => s.tool)).toEqual(["search_products", "composePage"]);
    expect(o.page.source).toBe("agent");
  });
});
