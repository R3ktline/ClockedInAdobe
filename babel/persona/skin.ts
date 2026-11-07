// Which skin (visual identity of the store frame) a visit starts in.
// Bento is the default. A fixed share of visits get another skin instead, weighted by what the persona already
// holds (dialect × need, from interaction signals). Never age or generation: the skins are NOT a stand-in for demographics.
import type { Persona, Skin } from "@/babel/schema";

// A repeatable random number source: the same seed (visitor + visit number) gives the same skin on every page of
// the visit, and tests can pin it. Policy unchanged from the team app (25%, weighted); only the dice are seeded.
export function seeded(seed: string): () => number {
  let a = [...seed].reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0), 2166136261);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Shopper-facing names: the design, never a generation.
export const SKIN_NAMES: Record<Skin, string> = {
  none: "Taraba's own look", alpha: "Bento", alphadark: "Bento dark", genx: "Glossy", millennial: "Pastel", xp: "Y2K desktop", print: "Print",
};

export const DEFAULT_SKIN: Skin = "alpha";
export const OTHER_SKIN_CHANCE = 0.25; // share of visits that leave Bento

type Weights = Partial<Record<Skin, number>>;
const BY_DIALECT: Record<Persona["dialect"], Weights> = {
  visual: { millennial: 3, genx: 2, alphadark: 1 },   // image-first browsing: the more expressive skins
  dense: { print: 3, alphadark: 2 },                  // detail-first: hard outlines and a dark, quiet frame
  guided: { print: 2, millennial: 2 },                // clear shapes, strong outlines, rounded and warm
  standard: { alphadark: 1, millennial: 1, genx: 1, print: 1, xp: 1 },
};
const BY_NEED: Partial<Record<Persona["need"], Weights>> = {
  inspiration: { genx: 2, xp: 1 },
  reassurance: { millennial: 2 },
  specs: { print: 1, alphadark: 1 },
  quick: { alphadark: 1 },
};

export function pickSkin(persona: Persona, rng: () => number = Math.random): Skin {
  if (persona.confidence === 0) return DEFAULT_SKIN; // nothing is known yet: no reason to leave the default
  if (rng() >= OTHER_SKIN_CHANCE) return DEFAULT_SKIN;
  const w: Weights = {};
  for (const src of [BY_DIALECT[persona.dialect], BY_NEED[persona.need]]) {
    for (const [s, n] of Object.entries(src ?? {}) as [Skin, number][]) w[s] = (w[s] ?? 0) + n;
  }
  const entries = Object.entries(w) as [Skin, number][];
  let r = rng() * entries.reduce((s, [, n]) => s + n, 0);
  for (const [s, n] of entries) if ((r -= n) < 0) return s;
  return DEFAULT_SKIN;
}
