import { afterEach, describe, expect, it } from "vitest";
import { BrandKit, Registry, type Template } from "@/babel/schema";
import { changedBlocks } from "@/babel/schema/diff";
import { buildSlide, NEUTRAL_PERSONA } from "@/babel/persona";
import { anonymousPartner } from "@/data/shoppers";
import { createVisit } from "@/babel/session";
import { taraba } from "@/stores/taraba/config";
import { runDirector } from "./director";

const brand = BrandKit.parse(taraba.brand);
const registry = Registry.parse(taraba.registry);
const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });

const fresh = (template: Template = "product", from: Record<string, string> = {}) => {
  const base = buildSlide({ persona: NEUTRAL_PERSONA, template, registry, brand });
  const slide = { ...base, blocks: base.blocks.map((b) => ({ ...b, variant: from[b.id] ?? b.variant })) };
  return createVisit({ store: "taraba", template, partner: anonymousPartner, persona: NEUTRAL_PERSONA, reasons: [], curtain: true, slide });
};
const ask = (visit: ReturnType<typeof fresh>, message: string) => {
  delete process.env.DEEPSEEK_API_KEY; // offline stand-in
  return runDirector(visit, registry, brand, ["chat"], message, { big: true });
};
const status = (o: Awaited<ReturnType<typeof ask>>, re: RegExp) => o.understood?.find((p) => re.test(p.wanted))?.status;

describe("curtain mode: a typed request (offline stand-in)", () => {
  it("product page: photos already at their smallest, sorting is not offered, and it says both", async () => {
    const o = await ask(fresh("product", { gallery: "side_large" }), "make my photos smaller and sort the products by reviews");
    expect(o.decision).toBe("hold");
    expect(status(o, /photos smaller/)).toBe("already");
    expect(status(o, /sorted/)).toBe("cannot");
    expect(o.reply).toMatch(/Already so: photos smaller/);
    expect(o.reply).toMatch(/Can't do: products sorted by reviews/);
    expect(o.gaps[0]).toMatchObject({ block: "productList" });
  });

  it("home page: no photo-size setting and no sorting, so nothing moves (the layout that dropped the ratings never happens)", async () => {
    const v = fresh("home");
    const o = await ask(v, "make my photos smaller and sort the products by reviews");
    expect(o.decision).toBe("hold");
    expect(o.slide).toBeUndefined();
    expect(status(o, /photos smaller/)).toBe("cannot");
    expect(o.reply).toMatch(/Can't do/);
  });

  it("shrinks photos when they are large, changes nothing else, and still reports what it cannot do", async () => {
    const v = fresh();
    const big = await ask(v, "show me bigger photos");
    expect(big.slide?.blocks.find((b) => b.id === "gallery")?.variant).toBe("single_large");
    v.slides.push(big.slide!);
    const o = await ask(v, "make the photos smaller and sort by reviews");
    expect(o.decision).toBe("slide");
    expect(o.slide!.blocks.find((b) => b.id === "gallery")?.variant).toBe("grid_thumbs");
    expect(changedBlocks(big.slide!.blocks, o.slide!.blocks)).toEqual(["gallery"]);
    expect(o.reply).toMatch(/Done: photos smaller/);
    expect(o.reply).toMatch(/Can't do: products sorted by reviews/);
  });

  it("still gives a simpler page when asked for one, and says it did", async () => {
    const o = await ask(fresh(), "make it simpler and bigger please");
    expect(o.slide?.persona.dialect).toBe("guided");
    expect(o.reply).toMatch(/^Done: a simpler page/);
  });

  it("does not pretend to understand what it does not recognise", async () => {
    const o = await ask(fresh(), "make it feel more like a spaceship");
    expect(o.decision).toBe("hold");
    expect(o.reply).toMatch(/Can't do/);
  });
});
