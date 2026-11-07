// Parity test: the TypeScript port must give exactly the results David published for his Python
// model (planning-phase/david/specs/signal-model.md §8, client-profiles-3.md "Results"),
// including his known misses. Fixture data is copied from signal_model.py and batch3.py.
import { describe, expect, it } from "vitest";
import type { Dialect, Need } from "@/babel/schema";
import { buildProfile, personaOf, type Context, type Declared, type Signals } from "./signalModel";

type Row = [name: string, signals: Signals, declared: Declared, context: Context, got: [Dialect, Need], prior?: Signals];

// Batch 1: the 10 client profiles (weights set with these in view) + 3 held-out visitors.
const BATCH_1: Row[] = [
  ["Tudor", { ref_social: 1, fast_scroll: 3, gallery_swipe: 4, views_without_opens: 9, short_session: 1 }, {}, {}, ["visual", "inspiration"]],
  ["Ana", { ref_price_compare: 1, price_sort: 3, price_filter: 2, price_detail_open: 1, cheaper_alt_view: 2, saved_item: 2 }, {}, {}, ["standard", "deals"]],
  ["Mihai", { ref_review_site: 1, search_jargon: 1, spec_open: 5, spec_dwell_long: 2, technical_section_open: 2, compare_add: 3, filter_technical: 1 }, {}, {}, ["dense", "specs"]],
  ["Elena", { prior_orders: 3, reorder_click: 1, fast_add_from_list: 3, skip_detail: 4, search_box_use: 3 }, {}, {}, ["standard", "quick"]],
  ["Cristina", { ref_social: 1, gallery_swipe: 6, image_zoom: 3, dimension_open: 2, policy_open: 1, repeat_visit_no_cart: 4, repeat_visit_same_items: 4, spec_dwell_long: 1 }, {}, {}, ["visual", "reassurance"]],
  ["Radu", { search_conversational: 1, glossary_open: 3, policy_open: 2, spec_open: 2, repeat_visit_no_cart: 1 }, {}, {}, ["standard", "reassurance"]],
  ["Ioana", { search_conversational: 1, spec_open: 3, spec_dwell_long: 1, seat_counter: 1, policy_open: 1, repeat_visit_no_cart: 2, compare_add: 1 }, {}, {}, ["standard", "specs"]],
  ["Victor", { review_first: 1, review_sort_critical: 1, verified_filter: 1, policy_open: 2, spec_open: 3, spec_dwell_long: 1, many_views_no_cart: 4, filter_technical: 1, technical_section_open: 1 }, {}, {}, ["dense", "reassurance"]],
  ["Maria", { mis_tap: 3, slow_deliberate_scroll: 2, howto_open: 1, phone_copy: 1, reorder_click: 1, skip_detail: 2 }, {}, { os_large_text: true }, ["guided", "quick"]],
  ["Gheorghe", { search_conversational: 2, suitability_open: 3, price_spread_wide: 1, policy_open: 1, gift_option_open: 1, glossary_open: 1, review_first: 1 }, { buyingFor: "other" }, {}, ["guided", "reassurance"]],
  ["H1 lost", { views_without_opens: 7, back_nav: 5, search_conversational: 1, search_refine_no_click: 2 }, {}, {}, ["guided", "balanced"]],
  ["H2 decided", { direct_product_entry: 1, delivery_open: 1, add_to_cart: 1, skip_detail: 3, short_session: 1 }, {}, {}, ["standard", "quick"]],
  ["H3 40 seconds", { ref_social: 1, fast_scroll: 3, short_session: 1, views_without_opens: 2 }, {}, {}, ["standard", "balanced"]],
];

// Batch 2: written after the model was frozen. David: 9/10, Paul misses (standard instead of dense).
const BATCH_2: Row[] = [
  ["11 Andreea", { ref_social: 1, gallery_swipe: 3, review_first: 1, policy_open: 1, price_sort: 1 }, {}, {}, ["visual", "reassurance"]],
  ["12 Paul (known miss)", { search_jargon: 1, spec_open: 4, compare_add: 2, price_sort: 2, price_filter: 1, fast_scroll: 1 }, {}, {}, ["standard", "specs"]],
  ["13 Irina", { search_conversational: 1, spec_open: 3, spec_dwell_long: 1, search_box_use: 3, gallery_swipe: 1 }, {}, {}, ["standard", "specs"]],
  ["14 Sorin", { ref_price_compare: 1, price_sort: 1, add_to_cart: 1, skip_detail: 2, short_session: 1, image_zoom: 1 }, {}, {}, ["standard", "quick"]],
  ["15 Lavinia", { views_without_opens: 1, short_session: 1 }, {}, {}, ["standard", "balanced"]],
  ["16 Dan", { search_conversational: 1, spec_open: 2, spec_dwell_long: 1, glossary_open: 2, price_filter: 1 }, {}, {}, ["standard", "specs"]],
  ["17 Bianca", { ref_social: 1, gallery_swipe: 8, image_zoom: 4, fast_scroll: 3, views_without_opens: 15, price_sort: 1 }, {}, {}, ["visual", "inspiration"]],
  ["18 Florin", { search_jargon: 1, spec_open: 3, technical_section_open: 2, compare_add: 2, filter_technical: 1, policy_open: 1 }, {}, {}, ["dense", "specs"]],
  ["19 Corina", { views_without_opens: 6, back_nav: 4, search_refine_no_click: 2, mis_tap: 1, gallery_swipe: 1 }, {}, {}, ["guided", "balanced"]],
  ["20 Emil", { repeat_visit_same_items: 3, repeat_visit_no_cart: 3, review_sort_critical: 1, policy_open: 1, price_detail_open: 1, price_sort: 2, spec_open: 1 }, {}, {}, ["standard", "reassurance"]],
];

// Batch 3: 20 varied clients, expectations hashed before the run. David: 17/20 strict;
// Sofia, Svetlana and Ruth differ from his expectation (rows below hold what the model *chose*).
const BATCH_3: Row[] = [
  ["21 Hiro", { search_jargon: 1, spec_open: 2, technical_section_open: 1, filter_technical: 1, compare_add: 2, gallery_swipe: 1 }, {}, {}, ["dense", "specs"]],
  ["22 Nadia", { reorder_click: 1, skip_detail: 2, mis_tap: 1, phone_copy: 1, slow_deliberate_scroll: 1, image_zoom: 1 }, {}, { os_large_text: true }, ["guided", "quick"]],
  ["23 Priya", { ref_price_compare: 1, utm_intent_deal: 1, price_sort: 3, price_filter: 2, price_detail_open: 1, cheaper_alt_view: 2, search_price_words: 1, saved_item: 2, spec_open: 1 }, {}, {}, ["standard", "deals"]],
  ["24 Tomas", { review_first: 1, review_sort_critical: 2, verified_filter: 1, policy_open: 2, many_views_no_cart: 4, spec_open: 2, price_sort: 1 }, {}, {}, ["standard", "reassurance"]],
  ["25 Sofia (alternate)", { search_conversational: 1, glossary_open: 2, suitability_open: 2, gift_option_open: 1, policy_open: 1, views_without_opens: 3, price_filter: 1 }, {}, {}, ["guided", "balanced"]],
  ["26 Kwame", { search_jargon: 1, technical_section_open: 2, spec_open: 2, policy_open: 2, seat_counter: 1, compare_add: 3, repeat_visit_no_cart: 1, gallery_swipe: 1 }, {}, {}, ["dense", "specs"]],
  ["27 Margit", { prior_orders: 4, reorder_click: 1, skip_detail: 3, fast_add_from_list: 2, search_box_use: 2, image_zoom: 1 }, {}, {}, ["standard", "quick"]],
  ["28 Yusuf", { views_without_opens: 5, back_nav: 6, search_refine_no_click: 3, dead_click: 2, price_sort: 1 }, {}, {}, ["guided", "balanced"]],
  ["29 Chloe", { gallery_swipe: 1, short_session: 1 }, {}, {}, ["standard", "balanced"]],
  ["30 Jonas", { ref_social: 1, saved_item: 3, gallery_swipe: 5, image_zoom: 2, dimension_open: 1, views_without_opens: 3, price_sort: 1 }, {}, {}, ["visual", "inspiration"]],
  ["31 Alina", { price_sort: 2, price_filter: 1, cheaper_alt_view: 1, review_first: 1, review_sort_critical: 1, policy_open: 2, repeat_visit_no_cart: 1 }, {}, {}, ["standard", "reassurance"]],
  ["32 Mateo", { spec_open: 3, spec_dwell_long: 1, glossary_open: 3, back_nav: 4, search_refine_no_click: 2, dead_click: 1 }, {}, {}, ["guided", "specs"]],
  ["33 Svetlana (known miss)", { spec_open: 5, spec_dwell_long: 3, compare_add: 2, search_box_use: 2, dimension_open: 1 }, {}, {}, ["standard", "specs"]],
  ["34 Oliver (return visit)", { spec_open: 2, compare_add: 1, technical_section_open: 1, repeat_visit_same_items: 1 }, {}, {}, ["dense", "specs"],
    { ref_review_site: 1, search_jargon: 1, spec_open: 4, technical_section_open: 2, compare_add: 2 }],
  ["35 Beatrix (declared)", { spec_open: 4, spec_dwell_long: 1, search_jargon: 1, compare_add: 2 }, { traits: { IA: 0.15 } }, {}, ["standard", "balanced"]],
  ["36 Kofi (view switch)", { views_without_opens: 1, short_session: 1 }, { dialect: "dense" }, {}, ["dense", "balanced"]],
  ["37 Daniel (no consent)", { spec_open: 5, compare_add: 3 }, {}, { consent: false }, ["standard", "balanced"]],
  ["38 Ruth (alternate)", { search_jargon: 1, spec_open: 4, technical_section_open: 2, compare_add: 2, search_box_use: 2 }, {}, { prefers_contrast_more: true }, ["guided", "specs"]],
  ["39 Vikram", { ref_price_compare: 1, utm_intent_deal: 1, ref_social: 1, short_session: 1 }, {}, {}, ["standard", "balanced"]],
  ["40 Elodie", { repeat_visit_same_items: 2, saved_item: 2, policy_open: 2, dimension_open: 2, review_first: 1, spec_open: 2, search_conversational: 1, repeat_visit_no_cart: 2, image_zoom: 1 }, {}, {}, ["standard", "reassurance"]],
];

const run = ([, signals, declared, context, , prior]: Row) => {
  const priorGroups = prior ? buildProfile(prior)!.groups : undefined;
  return personaOf(buildProfile(signals, declared, context, priorGroups));
};

describe("signal model port matches David's published results", () => {
  for (const [title, rows] of [["batch 1 + held-out", BATCH_1], ["batch 2", BATCH_2], ["batch 3", BATCH_3]] as const) {
    describe(title, () => {
      for (const row of rows) {
        it(row[0], () => {
          const p = run(row);
          expect([p.dialect, p.need]).toEqual(row[4]);
        });
      }
    });
  }

  it("Radu's key traits match the spec (trust need 0.74 at confidence 0.64)", () => {
    const p = buildProfile(BATCH_1[5][1])!;
    expect(p.traits.TN).toMatchObject({ value: 0.74, conf: 0.64 });
  });

  it("cold start is neutral with confidence 0", () => {
    expect(personaOf(buildProfile({}))).toMatchObject({ dialect: "standard", need: "balanced", confidence: 0 });
  });

  it("a return visit that contradicts the last one falls back to neutral (spec §3)", () => {
    const last = buildProfile(BATCH_1[2][1])!.groups; // Mihai's first visit
    const again = buildProfile({ skip_detail: 3, views_without_opens: 3 }, {}, {}, last)!;
    expect(again.traits.IA).toMatchObject({ value: 0.44, conf: 0.13 });
    expect(personaOf(again)).toMatchObject({ dialect: "standard", need: "balanced" });
  });

  it("a minor never gets the deals need (DSA Art. 28)", () => {
    const ana = BATCH_1[1];
    expect(personaOf(buildProfile(ana[1], {}, { minor: true })).need).not.toBe("deals");
  });
});
