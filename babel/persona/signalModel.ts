// David's signal model, ported 1:1 from planning-phase/david/scripts/signal_model.py
// (spec: planning-phase/david/specs/signal-model.md). Evidence → capped correlation groups →
// trait value + confidence → dialect × need. Pure and deterministic; no LLM.
// Every weight is [ASSUMPTION], hand-set by David. Keep function names in step with the Python so
// the two can be diffed; the tests in signalModel.test.ts reproduce his published results.
import type { Dialect, Need } from "@/babel/schema";

// ---------------------------------------------------------------- 1. constants
const TIER_WEIGHT = { B: 1.0, S: 0.5, C: 0.25 } as const; // repeated behaviour, single/search, circumstantial
const GROUP_CAP = 1.2;               // max |logit| one correlation group can add to one trait
const SINGLE_GROUP_CONF_CAP = 0.6;   // one group alone is never "enough" (≥ 2 independent groups)
const CONF_SCALE = 1.0;
export const THRESHOLD = 0.55;       // below this a trait is treated as neutral
export const TRAITS = ["IA", "JT", "PS", "TN", "INS", "IF", "CF"] as const;
export type Trait = (typeof TRAITS)[number];
// IA infoAppetite · JT jargonComfort · PS priceSensitivity · TN trustNeed (= 1 - trust)
// INS inspirationAppetite · IF interactionFluency · CF confusion
export const TRAIT_NAMES: Record<Trait, string> = {
  IA: "infoAppetite", JT: "jargonComfort", PS: "priceSensitivity", TN: "trustNeed",
  INS: "inspirationAppetite", IF: "interactionFluency", CF: "confusion",
};

// ---------------------------------------------------------------- 2. signal inventory
type Effect = [trait: Trait, sign: 1 | -1, strength: number, group: string];
export const SIGNALS: Record<string, [tier: keyof typeof TIER_WEIGHT, effects: Effect[]]> = {
  // circumstantial: arrival context. Device type, screen size and pixel ratio are deliberately ABSENT.
  ref_social: ["C", [["INS", 1, 1.0, "arrival"]]],
  ref_price_compare: ["C", [["PS", 1, 1.0, "arrival"]]],
  ref_review_site: ["C", [["JT", 1, 1.0, "arrival"], ["IA", 1, 1.0, "arrival"]]],
  utm_intent_deal: ["C", [["PS", 1, 1.0, "arrival"]]],
  short_session: ["C", [["IA", -1, 1.0, "pace"]]],
  // search wording: the strongest one-shot signal
  search_jargon: ["S", [["JT", 1, 1.5, "technical"], ["IA", 1, 0.8, "search"]]],
  search_conversational: ["S", [["JT", -1, 1.2, "technical"]]],
  search_price_words: ["S", [["PS", 1, 1.0, "price_focus"]]],
  // repeated on-page behaviour (opening details shows appetite, not jargon comfort)
  spec_open: ["B", [["IA", 1, 1.0, "detail_depth"]]],
  spec_dwell_long: ["B", [["IA", 1, 0.8, "detail_depth"]]],
  technical_section_open: ["B", [["JT", 1, 1.0, "technical_sections"]]],
  filter_technical: ["B", [["JT", 1, 0.8, "technical_sections"], ["IF", 1, 0.6, "control"]]],
  compare_add: ["B", [["IA", 1, 0.8, "comparison"], ["IF", 1, 0.5, "control"]]],
  views_without_opens: ["B", [["IA", -1, 0.8, "detail_depth"]]],
  skip_detail: ["B", [["IA", -1, 1.0, "detail_depth"]]],
  fast_add_from_list: ["B", [["IA", -1, 1.0, "pace"], ["IF", 1, 0.8, "control"]]],
  glossary_open: ["B", [["JT", -1, 1.0, "jargon_struggle"]]],
  price_sort: ["B", [["PS", 1, 1.0, "price_focus"]]],
  price_filter: ["B", [["PS", 1, 0.8, "price_focus"]]],
  price_detail_open: ["B", [["PS", 1, 0.8, "price_detail"]]],
  cheaper_alt_view: ["B", [["PS", 1, 0.8, "price_detail"]]],
  review_first: ["B", [["TN", 1, 1.0, "evidence_seeking"]]],
  review_sort_critical: ["B", [["TN", 1, 1.0, "evidence_seeking"]]],
  verified_filter: ["B", [["TN", 1, 0.8, "evidence_seeking"]]],
  policy_open: ["B", [["TN", 1, 0.9, "policy_check"]]],
  repeat_visit_no_cart: ["B", [["TN", 1, 0.7, "no_commit"]]],
  many_views_no_cart: ["B", [["TN", 1, 0.6, "no_commit"]]],
  prior_orders: ["B", [["TN", -1, 1.0, "history"]]],
  gallery_swipe: ["B", [["INS", 1, 1.0, "visual_engagement"]]],
  image_zoom: ["B", [["INS", 1, 0.6, "visual_engagement"]]],
  fast_scroll: ["B", [["INS", 1, 0.6, "browse_pace"], ["IA", -1, 0.4, "pace"]]],
  dimension_open: ["B", [["IA", 1, 0.7, "detail_depth"]]],
  mis_tap: ["B", [["IF", -1, 1.0, "motor"]]],
  slow_deliberate_scroll: ["B", [["IF", -1, 0.5, "pace_ui"]]],
  howto_open: ["B", [["IF", -1, 0.7, "guidance"]]],
  phone_copy: ["B", [["IF", -1, 0.4, "guidance"], ["TN", 1, 0.5, "human_contact"]]],
  dead_click: ["B", [["IF", -1, 0.6, "motor"], ["CF", 1, 0.8, "friction"]]],
  back_nav: ["B", [["CF", 1, 1.0, "bouncing"]]],
  search_refine_no_click: ["B", [["CF", 1, 1.0, "search_fail"]]],
  search_box_use: ["B", [["IF", 1, 0.6, "control"]]],
};
// Signals that only feed the categorical rules (intent stage, buyingFor):
// add_to_cart, reorder_click, checkout_start, direct_product_entry, delivery_open, saved_item,
// repeat_visit_same_items, suitability_open, gift_option_open, price_spread_wide, seat_counter.

export type Signals = Record<string, number>;
export type Groups = Record<Trait, Record<string, number>>;
export type Declared = { traits?: Partial<Record<Trait, number>>; dialect?: Dialect; need?: Need; buyingFor?: "self" | "other" };
export type Context = { consent?: boolean; os_large_text?: boolean; prefers_contrast_more?: boolean; minor?: boolean };
export type TraitScore = { value: number; conf: number; source: "inferred" | "declared" };
export type Profile = {
  traits: Record<Trait, TraitScore>;
  stage: "deciding" | "comparing" | "researching" | "browsing";
  stageConf: number;
  buyingFor: "self" | "other" | "unknown";
  bfConf: number;
  context: Context;
  declared: Declared;
  groups: Groups;
};

const r2 = (x: number) => Number(x.toFixed(2)); // Python round(x, 2) for display and thresholds

// ---------------------------------------------------------------- 3. accumulation
/** Repeats count, with diminishing returns: 1 → 0.5, 2 → 0.75, 3 → 0.875. */
const saturate = (n: number) => 1 - 0.5 ** n;

/** prior: last visit's group sums (consented localStorage), carried at `carry` so new behaviour wins. */
export function accumulate(signals: Signals, prior?: Groups, carry = 0.6): Groups {
  const groups = Object.fromEntries(TRAITS.map((t) => [t, {}])) as Groups;
  if (prior) for (const t of TRAITS) for (const [g, v] of Object.entries(prior[t] ?? {})) groups[t][g] = v * carry;
  for (const [sid, n] of Object.entries(signals)) {
    const def = SIGNALS[sid];
    if (!def || n <= 0) continue;
    const [tier, effects] = def;
    for (const [trait, sign, strength, group] of effects) {
      groups[trait][group] = (groups[trait][group] ?? 0) + TIER_WEIGHT[tier] * strength * sign * saturate(n);
    }
  }
  for (const t of TRAITS) for (const g of Object.keys(groups[t])) groups[t][g] = Math.max(-GROUP_CAP, Math.min(GROUP_CAP, groups[t][g]));
  return groups;
}

/** value = sigmoid(sum of capped groups); confidence = agreement × (1 − e^−mass), capped for one group. */
export function score(traitGroups: Record<string, number>): [value: number, conf: number] {
  const vals = Object.values(traitGroups);
  const L = vals.reduce((s, v) => s + v, 0);
  const value = 1 / (1 + Math.exp(-L));
  const mass = vals.reduce((s, v) => s + Math.abs(v), 0);
  if (mass === 0) return [value, 0];
  let conf = (Math.abs(L) / mass) * (1 - Math.exp(-mass / CONF_SCALE));
  const strong = vals.filter((v) => Math.abs(v) >= 0.3 && v > 0 === L > 0);
  if (strong.length < 2) conf = Math.min(conf, SINGLE_GROUP_CONF_CAP);
  return [value, conf];
}

// ---------------------------------------------------------------- 4. categorical rules
export function intentStage(s: Signals): [Profile["stage"], number] {
  if (s.add_to_cart || s.reorder_click || s.checkout_start) return ["deciding", 0.9];
  if (s.direct_product_entry && s.delivery_open) return ["deciding", 0.8];
  if ((s.compare_add ?? 0) >= 2 || (s.saved_item ?? 0) >= 2 || (s.repeat_visit_same_items ?? 0) >= 2) return ["comparing", 0.8];
  const deep = (s.spec_open ?? 0) + (s.policy_open ?? 0) + (s.review_first ?? 0) + (s.dimension_open ?? 0);
  if (deep >= 2) return ["researching", 0.7];
  return ["browsing", 0.6];
}

export function buyingFor(s: Signals, declared: Declared): [Profile["buyingFor"], number] {
  if (declared.buyingFor) return [declared.buyingFor, 1.0];
  if (s.seat_counter) return ["other", 0.7];
  const hints = ["suitability_open", "gift_option_open", "price_spread_wide"].filter((k) => s[k]).length;
  if (hints >= 2) return ["other", 0.6];
  return ["unknown", 0]; // never assume "self" from silence
}

// ---------------------------------------------------------------- 5. profile
export function buildProfile(signals: Signals, declared: Declared = {}, context: Context = {}, prior?: Groups, carry?: number): Profile | null {
  if (context.consent === false) return null; // no consent: nothing collected, nothing inferred
  const groups = accumulate(signals, prior, carry);
  const traits = {} as Record<Trait, TraitScore>;
  for (const t of TRAITS) {
    const [v, c] = score(groups[t]);
    traits[t] = { value: r2(v), conf: r2(c), source: "inferred" };
  }
  for (const [t, v] of Object.entries(declared.traits ?? {}) as [Trait, number][]) traits[t] = { value: v, conf: 1, source: "declared" };
  const [stage, stageConf] = intentStage(signals);
  const [bf, bfConf] = buyingFor(signals, declared);
  return { traits, stage, stageConf, buyingFor: bf, bfConf, context, declared, groups };
}

// ---------------------------------------------------------------- 6. persona mapping
const known = (p: Profile, t: Trait, op: ">=" | "<=", x: number) => {
  const tr = p.traits[t];
  if (tr.conf < THRESHOLD) return false;
  return op === ">=" ? tr.value >= x : tr.value <= x;
};

export function dialectOf(p: Profile): [why: string, dialect: Dialect, conf: number | null] {
  const d = p.declared, c = p.context, T = p.traits;
  if (d.dialect) return ["explicit view switch", d.dialect, 1];
  if (c.os_large_text || c.prefers_contrast_more) return ["accessibility setting", "guided", 1];
  if (known(p, "IF", "<=", 0.35)) return ["low fluency", "guided", T.IF.conf];
  if (known(p, "CF", ">=", 0.6)) return ["confusion", "guided", T.CF.conf];
  if (known(p, "INS", ">=", 0.65) && T.INS.value >= T.IA.value) return ["visual engagement", "visual", T.INS.conf];
  if (known(p, "JT", ">=", 0.65) && known(p, "IA", ">=", 0.65)) return ["technical + detail", "dense", Math.min(T.JT.conf, T.IA.conf)];
  if (known(p, "JT", "<=", 0.3) && T.IA.value <= 0.55) return ["plain words, moderate detail", "guided", T.JT.conf];
  return ["no strong evidence", "standard", null];
}

export function needOf(p: Profile, dialect?: Dialect): [why: string, need: Need, conf: number | null] {
  const T = p.traits;
  if (p.declared.need) return ["declared", p.declared.need, 1];
  // quick: the visitor already decided; only blocked by evidence of a hunger for detail.
  if (p.stage === "deciding" && p.stageConf >= 0.8 && T.IA.value <= 0.4) return ["already decided", "quick", p.stageConf];
  const cands: [v: number, need: Need, conf: number, trait: Trait][] = [];
  for (const [t, n, x] of [["TN", "reassurance", 0.6], ["PS", "deals", 0.65], ["IA", "specs", 0.65], ["INS", "inspiration", 0.65]] as const) {
    if (!known(p, t, ">=", x)) continue;
    if (n === "inspiration" && dialect === "visual") continue; // INS already spent on the visual dialect
    if (n === "deals" && p.context.minor) continue;            // DSA Art. 28 (spec §4; not in the Python)
    cands.push([T[t].value + (n === "reassurance" ? 0.05 : 0), n, T[t].conf, t]); // ties → the less-commercial page
  }
  if (cands.length) {
    // Python max() over tuples: highest value, then the alphabetically later need name.
    const [, n, c, t] = cands.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1])).at(-1)!;
    return [`strongest: ${t}`, n, c];
  }
  if (dialect === "visual") return ["visual, nothing else stands out", "inspiration", T.INS.conf];
  return ["no strong evidence", "balanced", null];
}

export function copyRegisterOf(p: Profile): "plain" | "standard" | "technical" {
  if (known(p, "JT", "<=", 0.35)) return "plain";
  if (known(p, "JT", ">=", 0.65)) return "technical";
  return "standard";
}

export type ModelPersona = {
  dialect: Dialect; need: Need; confidence: number;
  dialectWhy: string; needWhy: string;
  copyRegister: "plain" | "standard" | "technical"; giftContext: boolean;
};

export function personaOf(p: Profile | null): ModelPersona {
  if (!p) return { dialect: "standard", need: "balanced", confidence: 0, dialectWhy: "no consent", needWhy: "no consent", copyRegister: "standard", giftContext: false };
  const [dr, dl, dc] = dialectOf(p);
  const [nr, nd, nc] = needOf(p, dl);
  const adapted = [dc, nc].filter((c): c is number => c !== null); // confidence of what we actually changed
  return {
    dialect: dl, need: nd, dialectWhy: dr, needWhy: nr,
    confidence: adapted.length ? r2(Math.min(...adapted)) : 0,
    copyRegister: copyRegisterOf(p), giftContext: p.buyingFor === "other",
  };
}
