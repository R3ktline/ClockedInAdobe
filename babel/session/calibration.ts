// Calibration (curtain mode). While Babel learns who this shopper is, the page does not move. When the signal
// model is confident enough that a different format would serve them better, we say so once, and the client
// plays the curtain and swaps the page. Later changes need stronger evidence, a pause, and a cap, so a shopper
// whose style we got right is rarely interrupted. Pure functions; the thresholds are [ASSUMPTION], tune on the day.
import type { Persona } from "@/babel/schema";
import type { Visit } from ".";

const num = (key: string, fallback: number) => Number(process.env[key] ?? fallback);

export const calibrationSettings = () => ({
  minMs: num("BABEL_CAL_MIN_MS", 6_000),              // watch at least this long before the first read counts
  minEvidence: num("BABEL_CAL_MIN_EVIDENCE", 4),      // and at least this many meaningful actions
  firstConfidence: 0.55,                              // the model's own threshold (a trait below it is "not known")
  recalConfidence: 0.65,                              // changing a style we already set needs a clearer read
  cooldownMs: num("BABEL_CAL_COOLDOWN_MS", 45_000),   // and a pause after the last big change
  maxRestyles: num("BABEL_CAL_MAX_RESTYLES", 3),      // per visit
});

// Actions that say something about the shopper. Scrolling, hovering and "block seen" do not count.
const MEANINGFUL = new Set([
  "block_open", "block_dwell", "review_open", "policy_open", "search", "filter", "sort", "compare_add",
  "gallery_swipe", "image_zoom", "hover_price", "size_guide_open", "product_click", "category_click",
  "add_to_cart", "checkout_start", "reorder_click", "back_nav", "mis_tap", "dead_click", "rage_click", "page_zoom",
]);

export const personaKey = (p: Pick<Persona, "dialect" | "need">) => `${p.dialect} × ${p.need}`;

export type RestyleDecision =
  | { ok: true; persona: Persona; reasons: string[] }
  | { ok: false; why: string };

// `now` = ms since the visit started. Returns what to change to, or why not (shown in the debug trace).
export function restyleDecision(v: Visit, now: number): RestyleDecision {
  const c = calibrationSettings();
  const no = (why: string): RestyleDecision => ({ ok: false, why });
  if (!v.curtain) return no("curtain mode is off");
  if (v.standardView) return no("the shopper chose the standard view");
  if (v.explicitPinned) return no("the shopper asked for a view in chat; that wins over our read");
  const m = v.shopper?.model;
  if (!m) return no("no read of the shopper yet");
  if (now < c.minMs) return no("still watching");
  const evidence = v.events.filter((e) => MEANINGFUL.has(e.type)).length;
  if (evidence < c.minEvidence) return no(`only ${evidence} meaningful actions so far`);

  const current = v.slides.at(-1)!.persona;
  const target = { dialect: m.dialect, need: m.need };
  if (personaKey(current) === personaKey(target)) return no("the page already matches the read");

  const again = v.restyles > 0;
  if (m.confidence < (again ? c.recalConfidence : c.firstConfidence)) return no(`confidence ${m.confidence} is below ${again ? c.recalConfidence : c.firstConfidence}`);
  if (again && v.restyles >= c.maxRestyles) return no("the limit of big changes for this visit is reached");
  if (again && now - (v.lastRestyleAt ?? 0) < c.cooldownMs) return no("too soon after the last big change");
  if (v.declined.includes(personaKey(target))) return no("the shopper stepped back from this format");

  return {
    ok: true,
    persona: { ...target, confidence: m.confidence },
    reasons: [`dialect: ${m.dialectWhy}`, `need: ${m.needWhy}`, `confidence ${m.confidence}`],
  };
}
