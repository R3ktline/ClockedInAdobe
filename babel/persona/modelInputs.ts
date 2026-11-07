// Turns interaction events + partner context into the signal model's inputs (signal counts, context, declared).
// Only signals we can observe are mapped; the rest stay at 0. Mapping choices marked [ASSUMPTION] are ours,
// not David's model; tune them with him.
import type { InteractionEvent, PartnerContext } from "@/babel/schema";
import type { Context, Declared, Signals } from "./signalModel";

const UNITS = /\b\d+(\.\d+)?\s?(gb|tb|mb|mah|hz|ghz|w|kw|kg|mm|cm|db|rpm|k)\b|\bip\d\d\b/i; // [ASSUMPTION]
const ACRONYM = /\b[A-Z]{2,5}\d*\b/;
const CONVERSATIONAL = /\b(for my|for a|good for|easy to|something|which one|what is|how do)\b/i;
const PRICE_WORDS = /\b(cheap|cheapest|deal|deals|discount|offer|sale|under|budget|lei|ron)\b/i;

export function modelInputs(events: InteractionEvent[], partner: PartnerContext): { signals: Signals; context: Context; declared: Declared } {
  const s: Signals = {};
  const add = (id: string, n = 1) => { s[id] = (s[id] ?? 0) + n; };
  const opened = new Set<string>(); // products where something was opened
  const viewed = new Set<string>();
  let specSeen = false;
  let lastSearchNoClick = false;

  for (const e of events) {
    switch (e.type) {
      case "block_open":
        if (e.blockId === "specs") { add("spec_open"); specSeen = true; }
        if (e.target === "spec:technical") add("technical_section_open"); // [ASSUMPTION] the store tags its technical section
        if (e.target === "glossary") add("glossary_open");
        if (e.blockId === "assist") add("howto_open");
        if (e.productId) opened.add(e.productId);
        break;
      case "block_dwell":
        if (e.blockId === "specs" && Number(e.value) >= 8000) add("spec_dwell_long"); // [ASSUMPTION] "long" = 8 s
        if (e.target === "spec:age") add("suitability_open");
        if (e.target === "spec:size") add("dimension_open");
        break;
      case "review_open":
        if (!specSeen) add("review_first"); // reviews before any spec table [ASSUMPTION]
        if (e.productId) opened.add(e.productId);
        break;
      case "review_sort":
        if (/critical|lowest/.test(String(e.value))) add("review_sort_critical");
        break;
      case "policy_open":
        if (e.value === "gift") add("gift_option_open");
        else add(e.value === "delivery" ? "delivery_open" : "policy_open");
        if (e.productId) opened.add(e.productId);
        break;
      case "search": {
        const q = String(e.value ?? "");
        add("search_box_use");
        if (lastSearchNoClick) add("search_refine_no_click");
        lastSearchNoClick = true;
        const everyday = CONVERSATIONAL.test(q);
        if (UNITS.test(q) || (!everyday && ACRONYM.test(q))) add("search_jargon");        // "16GB DDR5", "ANC LDAC"
        else if (everyday || q.trim().split(/\s+/).length >= 5) add("search_conversational"); // "good TV for my mum"
        if (PRICE_WORDS.test(q)) add("search_price_words");
        break;
      }
      case "sort":
        if (String(e.value).startsWith("price")) add("price_sort");
        break;
      case "filter": {
        const v = String(e.value);
        if (v.startsWith("price") || v === "on_sale") add("price_filter");
        else if (v === "verified") add("verified_filter");
        else if (v.includes(":")) add("filter_technical"); // spec and brand facets [ASSUMPTION]
        break;
      }
      case "scroll":
        if (e.value === "fast") add("fast_scroll");
        if (e.value === "slow") add("slow_deliberate_scroll");
        break;
      case "page_view":
        if (e.productId) viewed.add(e.productId);
        break;
      case "product_click":
        lastSearchNoClick = false;
        if (e.blockId === "compare" && e.value === "cheaper") add("cheaper_alt_view");
        break;
      case "add_to_cart":
        add("add_to_cart");
        if (e.blockId === "productList") add("fast_add_from_list");
        if (typeof e.value === "number" && e.value >= 3) add("seat_counter"); // buying several for others [ASSUMPTION]
        break;
      case "compare_add": case "gallery_swipe": case "image_zoom": case "mis_tap": case "dead_click": case "back_nav":
      case "reorder_click": case "checkout_start":
        add(e.type);
        break;
    }
  }
  const unopened = [...viewed].filter((id) => !opened.has(id)).length;
  if (unopened) add("views_without_opens", unopened);

  // Partner context: only what the store shares with consent. Device type, screen size and pixel ratio are
  // deliberately NOT used (David's rule: a phone says nothing about its owner).
  const orders = partner.account?.orderCategories?.length ?? 0;
  if (partner.consent.partnerData && orders) add("prior_orders", orders);
  if (partner.campaign?.intentTag === "deal") add("utm_intent_deal");
  const src = partner.campaign?.utmSource?.toLowerCase() ?? "";
  if (/instagram|tiktok|facebook|pinterest|social/.test(src)) add("ref_social");
  if (/compar|price/.test(src)) add("ref_price_compare");
  if (/review/.test(src)) add("ref_review_site");
  // Came back without buying. [ASSUMPTION] returning with no purchase on record; a purchase arrives as orderCategories.
  if (partner.visitor.returning && !orders) add("repeat_visit_no_cart", Math.max(1, partner.visitor.visits - 1));

  const a11y = partner.account?.accessibility;
  const context: Context = {
    consent: partner.consent.personalization,
    os_large_text: !!a11y?.largeText,
    prefers_contrast_more: !!(a11y?.highContrast || partner.device?.prefersContrast),
    minor: partner.account?.ageBand === "minor",
  };
  const declared: Declared = partner.campaign?.intentTag === "gift" ? { buyingFor: "other" } : {};
  return { signals: s, context, declared };
}
