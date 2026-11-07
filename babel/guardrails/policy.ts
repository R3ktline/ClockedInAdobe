// Policy layer (GUARDRAILS §1 layer 9, §4): every string a shopper reads that a model wrote passes here, or it is
// not shown. Prompts lower how often a model misbehaves; this decides whether its words are used.
import type { BrandKit } from "@/babel/schema";

const MARKUP = /<[a-z!/][^>]*>|```|\]\(|javascript:/i;
const URGENCY = /\b(hurry|only \d+ left|last chance|limited[- ]time|ends (soon|today|tonight)|selling fast|don'?t miss|act now|while stocks? last|countdown|today only|only today|before it'?s gone|almost gone|few left|running out)\b/i;
const PRICE_TALK = /\d+\s?%|%\s?off|\b(discount|coupon|voucher|special price|price drop|just for you|personal(ised|ized)? price|exclusive (deal|offer))\b/i;
const SOCIAL_PRESSURE = /\b(people like you|shoppers like you|everyone is buying|others are viewing)\b/i;
// Words that describe the PERSON (age, ability, skill, state of mind), never allowed in a view's rationale.
const TRAITS = /\b(old|older|elderly|senior|aged|young|younger|teen\w*|boomers?|millennials?|gen ?[xyz]|gen alpha|generation\w*|retired|grandparent\w*|eyesight|vision|sight|disab\w*|impair\w*|struggl\w*|confus\w*|lost|beginner|novice|tech-?savvy|not technical|expert|nervous|anxious|worried|skeptic\w*|sceptic\w*|vulnerable|lonely|careful type)\b/i;
const ABOUT_YOU = /\b(you seem|you are|you're|you look|since you|because you are|as an? (older|young|senior|expert|beginner)|for someone like you|your age)\b/i;
// In chat replies, product facts may mention ages ("from age 6"); only claims about the shopper are refused.
const YOU_TRAIT = /\b(you|you're|you are|your)\b[^.?!]{0,40}\b(old|older|elderly|senior|young|aged|confused|struggling|beginner|novice|expert|anxious|nervous|worried|vulnerable|disabled)\b/i;

export type TextKind = "rationale" | "reply";

export function checkText(text: string, kind: TextKind, brand?: Pick<BrandKit, "bannedWords">): string[] {
  const errors: string[] = [];
  const hit = (re: RegExp) => text.match(re)?.[0];
  if (hit(MARKUP)) errors.push("markup or links are not allowed in shopper-facing text");
  const u = hit(URGENCY);
  if (u) errors.push(`urgency or scarcity wording ("${u}") is not allowed`);
  const sp = hit(SOCIAL_PRESSURE);
  if (sp) errors.push(`social pressure ("${sp}") is not allowed`);
  for (const w of brand?.bannedWords ?? []) if (text.toLowerCase().includes(w.toLowerCase())) errors.push(`banned brand word "${w}"`);
  if (kind === "rationale") {
    const p = hit(PRICE_TALK);
    if (p) errors.push(`a view's rationale may not talk about discounts or prices ("${p}")`);
    const t = hit(TRAITS) ?? hit(ABOUT_YOU);
    if (t) errors.push(`the rationale must describe the view and the behaviour, never the person ("${t}")`);
    if (/\d/.test(text)) errors.push("the rationale may not contain numbers (counts and prices come from code)");
    if (text.length > 240) errors.push("the rationale is longer than 240 characters");
  } else {
    const p = hit(/\d+\s?%\s?(off)?|\b(coupon|voucher|special price|just for you|personal(ised|ized)? price)\b/i);
    if (p) errors.push(`a reply may not offer price changes ("${p}")`);
    const t = hit(YOU_TRAIT) ?? hit(ABOUT_YOU);
    if (t) errors.push(`a reply may not describe the shopper ("${t}")`);
    if (text.length > 400) errors.push("the reply is longer than 400 characters");
  }
  return errors;
}

export const passes = (text: string, kind: TextKind, brand?: Pick<BrandKit, "bannedWords">) => checkText(text, kind, brand).length === 0;
