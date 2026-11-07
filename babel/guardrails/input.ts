// Input guard (GUARDRAILS §1 layer 1): chat and agent text before any model sees it. Length cap, control
// characters, personal data stripped, prompt-injection and price-change requests answered by code, not a model.

export const MAX_INPUT = 300;

const INJECTION = /ignore (all |any |your |the |these )?(previous |prior |above |earlier )?(rules|instructions|prompts?|guidelines)|system prompt|developer mode|admin mode|debug mode|you are now|pretend (to be|you are)|act as (a|an|the) |jailbreak|reveal (your|the) (prompt|instructions|rules)|print (your|the) (prompt|instructions|rules|system)|<\/?(system|user_message|data)>|\bDAN\b/i;
const PRICE_CHANGE = /\b(\d+\s?%\s?(off|discount)?|give me (a |an )?(discount|deal|coupon|voucher|better price)|lower (the |your )?price|cheaper price for me|price match|negotiat\w*|set (the )?price|make it (free|cheaper)|free of charge)\b/i;
const OFF_TOPIC = /\b(write (me )?(a |an )?(poem|essay|code|story)|homework|weather|politics|election|stock market|bitcoin)\b/i;
// Personal details are used for nothing: removed before the model sees the text, never stored.
const PII: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email removed]"],
  [/\b(?:\d[ -]?){13,19}\b/g, "[number removed]"],
  [/\+?\d[\d ()-]{7,}\d/g, "[number removed]"],
  [/\b(i'?m|i am)\s+\d{1,3}\b(\s*(years?|yrs?)( old)?)?/gi, "[personal detail removed]"],
  [/\b\d{1,3}\s*(years? old|yo)\b/gi, "[personal detail removed]"],
  [/\bi (have|suffer from|was diagnosed with) [a-z ]{3,30}?(?=[,.?!]|$)/gi, "[personal detail removed]"],
];

export type Guarded =
  | { ok: true; clean: string; removedPersonal: boolean }
  | { ok: false; refuse: "injection" | "price" | "off_topic" | "empty"; reply: string };

export const REFUSALS = {
  injection: "I can only help you shop in this store. I can't change how I work.",
  price: "I can't change prices or give discounts. Every shopper and every agent pays the same catalog price.",
  off_topic: "I can only help with shopping in this store.",
  empty: "Ask me about a product, or tell me how you'd like the page to look.",
} as const;

export function guardInput(raw: string): Guarded {
  // eslint-disable-next-line no-control-regex
  let clean = raw.replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_INPUT);
  if (!clean) return { ok: false, refuse: "empty", reply: REFUSALS.empty };
  if (INJECTION.test(clean)) return { ok: false, refuse: "injection", reply: REFUSALS.injection };
  if (PRICE_CHANGE.test(clean)) return { ok: false, refuse: "price", reply: REFUSALS.price };
  if (OFF_TOPIC.test(clean)) return { ok: false, refuse: "off_topic", reply: REFUSALS.off_topic };
  const before = clean;
  for (const [re, sub] of PII) clean = clean.replace(re, sub);
  return { ok: true, clean, removedPersonal: clean !== before };
}
