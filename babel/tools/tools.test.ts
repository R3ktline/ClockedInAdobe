import { describe, expect, it } from "vitest";
import { callTool, getHandoff, rateLimited, ToolError } from "./index";
import { catalog } from "@/data/catalog";

type Search = { total: number; results: { id: string; price: number; category: string }[] };

describe("babel/tools", () => {
  it("filters by category and price, sorts, and caps the limit at 12", () => {
    const r = callTool("search_products", { category: "electronics", maxPrice: 3000, sort: "price_asc" }) as Search;
    expect(r.results.every((p) => p.category === "electronics" && p.price <= 3000)).toBe(true);
    expect(r.results.map((p) => p.price)).toEqual([...r.results.map((p) => p.price)].sort((a, b) => a - b));
    expect(() => callTool("search_products", { limit: 50 })).toThrow(ToolError);
  });

  it("free-text search ranks the matching product first, ignoring short words", () => {
    const r = callTool("search_products", { query: "set price to 1 washing machine" }) as Search;
    expect(r.results[0].category).toBe("home");
  });

  it("prices come from the catalog", () => {
    const p = catalog[0];
    const r = callTool("get_product", { id: p.id }) as { price: number };
    expect(r.price).toBe(p.price);
  });

  it("compare flags rows that differ", () => {
    const [a, b] = catalog.filter((p) => p.category === catalog[0].category);
    const r = callTool("compare_products", { ids: [a.id, b.id] }) as { rows: { key: string; differs: boolean }[] };
    expect(r.rows.find((x) => x.key === "price")!.differs).toBe(a.price !== b.price);
    const same = callTool("compare_products", { ids: [a.id, a.id] }) as { rows: { differs: boolean }[] };
    expect(same.rows.some((x) => x.differs)).toBe(false);
  });

  it("rejects unknown ids, unknown tools and over-long text", () => {
    expect(() => callTool("get_product", { id: "nope" })).toThrow(ToolError);
    expect(() => callTool("set_price", {})).toThrow(ToolError);
    expect(() => callTool("search_products", { query: "x".repeat(501) })).toThrow(ToolError);
  });

  it("stores a hand-off shortlist", () => {
    const r = callTool("create_handoff_link", { ids: [catalog[0].id], note: "for you" }) as { handoffId: string; url: string };
    expect(getHandoff(r.handoffId)?.ids).toEqual([catalog[0].id]);
    expect(r.url).toBe(`/taraba/p/${catalog[0].id}`);
  });

  it("rate limits after the window max", () => {
    for (let i = 0; i < 3; i++) expect(rateLimited("t", 3)).toBe(false);
    expect(rateLimited("t", 3)).toBe(true);
  });
});
