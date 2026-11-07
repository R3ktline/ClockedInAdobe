// Runs the request test set (requests.eval.ts) through the Director and grades each answer.
//   offline stand-in (default): must pass every case marked `mock: true`; prints the rest for information
//   live model:  BABEL_EVAL=live BABEL_DIRECTOR_BUDGET_MS=30000 DEEPSEEK_API_KEY=... DEEPSEEK_MODEL=... \
//                npx vitest run babel/agents/requests.eval.test.ts
//   (the budget variable must be set outside the test: the Director reads it once when it loads)
// Live runs assert nothing: they print a pass rate per case and save .babel/eval-requests.json to compare models.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BrandKit, Registry, type Slide } from "@/babel/schema";
import { buildSlide, NEUTRAL_PERSONA } from "@/babel/persona";
import { changedBlocks } from "@/babel/schema/diff";
import { createVisit } from "@/babel/session";
import { anonymousPartner } from "@/data/shoppers";
import { taraba } from "@/stores/taraba/config";
import { runDirector, type DirectorOutcome } from "./director";
import { cases, type Case } from "./requests.eval";

const brand = BrandKit.parse(taraba.brand);
const registry = Registry.parse(taraba.registry);
const live = process.env.BABEL_EVAL === "live";

function visitFor(c: Case) {
  const base = buildSlide({ persona: NEUTRAL_PERSONA, template: c.page, registry, brand });
  const slide: Slide = { ...base, blocks: base.blocks.map((b) => ({ ...b, variant: c.from?.[b.id] ?? b.variant })) };
  return createVisit({ store: "taraba", template: c.page, partner: anonymousPartner, persona: NEUTRAL_PERSONA, reasons: [], curtain: true, slide });
}

// What went wrong, in words. Empty = the answer is right.
export function grade(c: Case, o: DirectorOutcome, prev: Slide): string[] {
  const f: string[] = [];
  const e = c.expect;
  const slide = o.decision === "slide" ? o.slide : undefined;
  const changed = slide ? changedBlocks(prev.blocks, slide.blocks) : [];
  if (e.outcome === "changes" && !slide) f.push(`expected a change, got ${o.decision}${o.reason ? `: ${o.reason}` : ""}`);
  if (e.outcome === "none" && slide) f.push(`expected the page to stay, but it changed ${changed.join(", ") || "its look"}`);
  if (slide) {
    const now = (b: string) => slide.blocks.find((x) => x.id === b)?.variant;
    for (const [b, v] of e.set ?? []) if (now(b) !== v) f.push(`${b} should be ${v}, is ${now(b)}`);
    for (const [b, v] of e.never ?? []) if (now(b) === v) f.push(`${b} must not be ${v}`);
    if (e.only && JSON.stringify([...changed].sort()) !== JSON.stringify([...e.only].sort())) f.push(`only ${e.only.join(", ")} should change, but ${changed.join(", ") || "nothing"} did`);
    if (e.dialect === "same" && slide.persona.dialect !== prev.persona.dialect) f.push(`the look changed to ${slide.persona.dialect}`);
    if (e.dialect && e.dialect !== "same" && slide.persona.dialect !== e.dialect) f.push(`the look should be ${e.dialect}, is ${slide.persona.dialect}`);
    if (e.textBigger && !(slide.theme.typeScale > prev.theme.typeScale)) f.push("the text did not get bigger");
  }
  if (e.cannot && !o.understood?.some((p) => p.status === "cannot")) f.push("did not say that anything is not possible");
  if (e.reply && !(o.reply && e.reply.test(o.reply))) f.push(`the reply should match ${e.reply}, it says: "${o.reply}"`);
  if (!o.reply) f.push("no reply for the shopper");
  return f;
}

describe("request understanding", () => {
  it(live ? "live model" : "offline stand-in passes the cases it is meant to", async () => {
    if (live && !process.env.DEEPSEEK_API_KEY) { console.warn("BABEL_EVAL=live needs DEEPSEEK_API_KEY and DEEPSEEK_MODEL"); return; }
    if (!live) delete process.env.DEEPSEEK_API_KEY;
    const rows: { id: string; pass: boolean; why: string[]; reply?: string; ms: number; rounds: number }[] = [];
    for (const c of cases) {
      const visit = visitFor(c);
      const prev = visit.slides.at(-1)!;
      const o = await runDirector(visit, registry, brand, ["chat"], c.say, { big: true });
      const why = grade(c, o, prev);
      rows.push({ id: c.id, pass: why.length === 0, why, reply: o.reply, ms: o.ms, rounds: o.rounds });
    }
    const passed = rows.filter((r) => r.pass).length;
    console.log(`\n${live ? `LIVE ${process.env.DEEPSEEK_MODEL}` : "OFFLINE STAND-IN"}: ${passed}/${rows.length} cases understood`);
    for (const r of rows) console.log(`${r.pass ? "PASS" : "FAIL"} ${r.id.padEnd(26)} ${String(r.ms).padStart(5)}ms ${r.rounds}r ${r.pass ? "" : r.why.join(" | ")}`);
    if (live) {
      mkdirSync(path.join(process.cwd(), ".babel"), { recursive: true });
      writeFileSync(path.join(process.cwd(), ".babel", "eval-requests.json"), JSON.stringify({ model: process.env.DEEPSEEK_MODEL, at: new Date().toISOString(), passed, total: rows.length, rows }, null, 1));
      return;
    }
    const mustPass = new Set(cases.filter((c) => c.mock).map((c) => c.id));
    expect(rows.filter((r) => mustPass.has(r.id) && !r.pass).map((r) => `${r.id}: ${r.why.join(" | ")}`)).toEqual([]);
  }, 900_000);
});
