import { afterEach, describe, expect, it } from "vitest";
import { BrandKit, Registry } from "@/babel/schema";
import { buildSlide, initialPersona } from "@/babel/persona";
import { createVisit, recordEvents } from "@/babel/session";
import { shoppers } from "@/data/shoppers";
import { taraba } from "@/stores/taraba/config";
import { runDirector } from "./director";

const brand = BrandKit.parse(taraba.brand);
const registry = Registry.parse(taraba.registry);

function raduVisit() {
  const { partner, events } = shoppers.radu;
  const { persona, reasons } = initialPersona(partner);
  const slide = buildSlide({ persona, template: "product", registry, brand, ctx: partner });
  const visit = createVisit({ store: "taraba", template: "product", partner, persona, slide, reasons });
  expect(recordEvents(visit, events).trigger).toBe(true);
  return visit;
}

const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });

describe("Director", () => {
  it("answers Radu's trust spike with a valid minor slide (mock LLM)", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const o = await runDirector(raduVisit(), registry, brand);
    expect(o.decision).toBe("slide");
    expect(o.slide!.kind).toBe("minor");
    expect(o.slide!.blocks.find((b) => b.id === "trust")).toMatchObject({ order: 2, variant: "returns_warranty_first" });
    expect(o.slide!.blocks.find((b) => b.id === "buyBox")!.variant).toBe("calm");
    expect(o.slide!.hypothesis?.marker).toBe("hesitation");
  });

  it("holds when DeepSeek is unreachable, so the store keeps working", async () => {
    Object.assign(process.env, { DEEPSEEK_API_KEY: "test", DEEPSEEK_MODEL: "test", DEEPSEEK_BASE_URL: "http://127.0.0.1:9" });
    const o = await runDirector(raduVisit(), registry, brand);
    expect(o.decision).toBe("hold");
    expect(o.reason).toMatch(/llm error|timeout/);
  });
});

describe("Director on zoom", () => {
  it("answers a zoom-in with bigger, plainer text inside the change budget (mock LLM)", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const o = await runDirector(raduVisit(), registry, brand, ["zoom"]);
    expect(o.decision).toBe("slide");
    expect(o.slide!.theme.typeScale).toBeCloseTo(1.1);
    expect(o.slide!.copyRegister).toBe("plain");
    expect(o.slide!.blocks.find((b) => b.id === "summary")!.variant).toBe("benefits_plain");
  });
});
