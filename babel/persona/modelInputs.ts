// Turns our interaction events + partner context into the signal model's inputs (signal counts,
// context, declared). Only signals we can actually observe are mapped; the rest stay at 0.
// Mapping choices marked [ASSUMPTION] are ours, not David's; tune them with him.
import type { InteractionEvent, PartnerContext } from "@/babel/schema";
import type { Context, Declared, Signals } from "./signalModel";

const UNITS = /\b\d+(\.\d+)?\s?(gb|tb|mb|mah|hz|ghz|w|kw|kg|mm|cm|db|rpm|k)\b|\bip\d\d\b/i; // [ASSUMPTION]
const ACRONYM = /\b[A-Z]{2,5}\d*\b/;
const CONVERSATIONAL = /\b(for my|for a|good for|easy to|something|which one|what is|how do)\b/i;
const PRICE_WORDS = /\b(cheap|cheapest|deal|deals|discount|offer|sale|under|budget|lei|ron)\b/i;

export function modelInputs(events: InteractionEvent[], partner: PartnerContext): { signals: Signals; context: Context; declared: Declared } {
  const s: Signals = {};
  const add = (id: string, n = 1) => { s[id] = (s[id] ?? 0) + n; };
  const opened = new Set<string>();   // products where something was opened
  const viewed = new Set<string>();
  let specSeen = false;

  for (const e of events) {
    switch (e.type) {
      case "block_open":
        if (e.blockId === "specs") { add("spec_open"); specSeen = true; }
        if (e.productId) opened.add(e.productId);
        break;
      case "block_dwell":
        if (e.blockId === "specs" && Number(e.value) >= 8000) add("spec_dwell_long"); // [ASSUMPTION] "long" = 8 s
        break;
      case "review_open":
        if (!specSeen) add("review_first"); // reviews before any spec table [ASSUMPTION]
        if (e.productId) opened.add(e.productId);
        break;
      case "policy_open":
        add(e.value === "delivery" ? "delivery_open" : "policy_open");
        if (e.productId) opened.add(e.productId);
        break;
      case "search": {
        const q = String(e.value ?? "");
        add("search_box_use");
        const everyday = CONVERSATIONAL.test(q);
        if (UNITS.test(q) || (!everyday && ACRONYM.test(q))) add("search_jargon");        // "16GB DDR5", "ANC LDAC"
        else if (everyday || q.trim().split(/\s+/).length >= 5) add("search_conversational"); // "good TV for my mum"
        if (PRICE_WORDS.test(q)) add("search_price_words");
        break;
      }
      case "sort":
        if (String(e.value).startsWith("price")) add("price_sort");
        break;
      case "filter":
        add(String(e.value).startsWith("price") ? "price_filter" : "filter_technical"); // spec facets [ASSUMPTION]
        break;
      case "scroll":
        if (e.value === "fast") add("fast_scroll");
        if (e.value === "slow") add("slow_deliberate_scroll");
        break;
      case "page_view":
        if (e.productId) viewed.add(e.productId);
        break;
      case "compare_add": case "gallery_swipe": case "image_zoom": case "mis_tap": case "dead_click": case "back_nav":
      case "add_to_cart": case "reorder_click": case "checkout_start":
        add(e.type);
        break;
    }
  }
  const unopened = [...viewed].filter((id) => !opened.has(id)).length;
  if (unopened) add("views_without_opens", unopened);

  // Partner context: only what the store shares with consent. Device type, screen size and pixel
  // ratio are deliberately NOT used (David's rule: a phone says nothing about its owner).
  const orders = partner.account?.orderCategories?.length ?? 0;
  if (partner.consent.partnerData && orders) add("prior_orders", orders);
  if (partner.campaign?.intentTag === "deal") add("utm_intent_deal");
  const src = partner.campaign?.utmSource?.toLowerCase() ?? "";
  if (/instagram|tiktok|facebook|pinterest|social/.test(src)) add("ref_social");
  // Came back without buying. [ASSUMPTION] a returning visitor with no purchase on record; a purchase
  // would arrive as orderCategories (prior_orders) and pull the other way.
  if (partner.visitor.returning && !orders) add("repeat_visit_no_cart", Math.max(1, partner.visitor.visits - 1));
  if (/compar|price/.test(src)) add("ref_price_compare");
  if (/review/.test(src)) add("ref_review_site");

  const a11y = partner.account?.accessibility;
  const context: Context = {
    consent: partner.consent.personalization,
    os_large_text: !!a11y?.largeText,
    prefers_contrast_more: !!(a11y?.highContrast || partner.device?.prefersContrast),
    minor: partner.account?.ageBand === "minor",
  };
  return { signals: s, context, declared: {} };
}
