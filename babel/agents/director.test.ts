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

  it("holds on a request no variant serves and files it as a gap (mock LLM)", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const o = await runDirector(raduVisit(), registry, brand, ["chat"], "show me a side by side comparison");
    expect(o.decision).toBe("hold");
    expect(o.gaps).toEqual([expect.objectContaining({ block: "gallery" })]);
  });

  it("holds when DeepSeek is unreachable, so the store keeps working", async () => {
    Object.assign(process.env, { DEEPSEEK_API_KEY: "test", DEEPSEEK_MODEL: "test", DEEPSEEK_BASE_URL: "http://127.0.0.1:9" });
    const o = await runDirector(raduVisit(), registry, brand);
    expect(o.decision).toBe("hold");
    expect(o.reason).toMatch(/llm error|timeout/);
  });
});

describe("Director on a chat message", () => {
  it("moves returns and reviews up when the shopper asks, with no marker spike (mock LLM)", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const { partner } = shoppers.radu;
    const { persona, reasons } = initialPersona(partner);
    const slide = buildSlide({ persona, template: "product", registry, brand, ctx: partner });
    const visit = createVisit({ store: "taraba", template: "product", partner, persona, slide, reasons });
    const o = await runDirector(visit, registry, brand, ["chat"], "show me the returns and reviews first");
    expect(o.decision).toBe("slide");
    expect(o.slide!.rationale).toMatch(/You asked/);
    expect(o.slide!.blocks.find((b) => b.id === "trust")).toMatchObject({ order: 2 });
    expect(o.transcript.input).not.toMatch(/returns and reviews first/); // the message travels in <user_message>, not the data
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

describe("Director on layout", () => {
  it("puts the reviews next to the photos after the shopper opens them (mock LLM)", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const { partner } = shoppers.radu;
    const { persona, reasons } = initialPersona(partner);
    const slide = buildSlide({ persona, template: "product", registry, brand, ctx: partner });
    const visit = createVisit({ store: "taraba", template: "product", partner, persona, slide, reasons });
    visit.events.push({ t: 1000, type: "review_open", blockId: "trust" });
    const o = await runDirector(visit, registry, brand, ["checkin"]);
    expect(o.decision).toBe("slide");
    const [g, t] = ["gallery", "trust"].map((id) => o.slide!.blocks.find((b) => b.id === id)!);
    expect(g.variant).toBe("side_large");
    expect(t).toMatchObject({ variant: "side_reviews", order: g.order + 1 });
  });
});
