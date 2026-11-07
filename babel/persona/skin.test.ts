import { describe, expect, it } from "vitest";
import type { Persona } from "@/babel/schema";
import { DEFAULT_SKIN, OTHER_SKIN_CHANCE, pickSkin } from "./skin";

const visual: Persona = { dialect: "visual", need: "inspiration", confidence: 0.8 };
const dense: Persona = { dialect: "dense", need: "specs", confidence: 0.8 };

describe("pickSkin", () => {
  it("is Bento unless the roll lands in the other-skin share", () => {
    expect(pickSkin(visual, () => OTHER_SKIN_CHANCE)).toBe(DEFAULT_SKIN);
    expect(pickSkin(visual, () => 0.99)).toBe(DEFAULT_SKIN);
    expect(DEFAULT_SKIN).toBe("alpha");
  });

  it("leaves Bento about a quarter of the time, and never lands on Bento or 'none' when it does", () => {
    let n = 0; const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) { const s = pickSkin(dense); seen.add(s); if (s !== DEFAULT_SKIN) n++; }
    expect(n / 2000).toBeGreaterThan(0.18);
    expect(n / 2000).toBeLessThan(0.32);
    expect(seen.has("none")).toBe(false);
  });

  it("weights by the persona: a visual shopper never gets print, a detail shopper never gets pastel", () => {
    const rolls = (p: Persona) => new Set(Array.from({ length: 500 }, () => pickSkin(p, (() => { let k = 0; return () => (k++ % 2 === 0 ? 0 : Math.random()); })())));
    expect(rolls(visual).has("print")).toBe(false);
    expect(rolls(dense).has("millennial")).toBe(false);
  });

  it("with nothing known yet it stays on the default, with no dice", () => {
    expect(pickSkin({ dialect: "standard", need: "balanced", confidence: 0 }, () => 0)).toBe(DEFAULT_SKIN);
  });
});
