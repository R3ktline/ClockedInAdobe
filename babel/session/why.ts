// Plain words for the shopper's "Why this view?" panel and the merchant's "what changed" lines. Built in code from
// what the shopper did, so they quote behaviour, never a trait, and never come from a model.
import type { BlockId, Registry, View } from "@/babel/schema";
import type { VisitEvent } from "@/babel/markers";
import { changedBlocks } from "@/babel/guardrails/validate";

const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

export function whyLines(events: VisitEvent[], view: View, opts: { returning?: boolean; declaredLargeText?: boolean } = {}): string[] {
  if (view.kind === "standard") return ["This is the store's standard page. Babel is not adapting anything."];
  if (view.kind === "explicit") return ["You asked for this view. It stays until you change it or press Standard view."];
  const n = (pred: (e: VisitEvent) => boolean) => events.filter(pred).length;
  const lines: string[] = [];
  if (view.kind === "return" || opts.returning) lines.push("You have been here before, so this page starts from what you used last time.");
  if (opts.declaredLargeText) lines.push("Your account settings ask for larger text.");
  const policies = n((e) => e.type === "policy_open" && (e.value === "returns" || e.value === "warranty"));
  if (policies) lines.push(`You opened the returns or warranty details ${times(policies)}.`);
  const reviews = n((e) => e.type === "review_open");
  if (reviews) lines.push(`You read the reviews ${times(reviews)}.`);
  const specs = n((e) => (e.type === "block_open" || e.type === "block_dwell") && e.blockId === "specs");
  if (specs) lines.push("You opened and read the specifications.");
  const compares = n((e) => e.type === "compare_add");
  if (compares) lines.push(`You added products to compare ${times(compares)}.`);
  const photos = n((e) => e.type === "gallery_swipe" || e.type === "image_zoom");
  if (photos >= 2) lines.push("You spent time on the photos.");
  const price = n((e) => (e.type === "sort" || e.type === "filter") && /^price|on_sale/.test(String(e.value)));
  if (price) lines.push("You sorted or filtered by price.");
  const misses = n((e) => e.type === "mis_tap" || e.type === "dead_click");
  if (misses >= 2) lines.push("Some taps landed next to a button, so buttons and text are larger.");
  const back = n((e) => e.type === "back_nav");
  if (back >= 2) lines.push("You went back and forth between pages, so the page shows fewer, clearer choices.");
  const carts = n((e) => e.type === "add_to_cart" || e.type === "reorder_click");
  if (carts) lines.push("You added something to the cart, so buying is quicker.");
  const searches = events.filter((e) => e.type === "search").map((e) => String(e.value ?? ""));
  if (searches.some((q) => /\d\s?(gb|tb|hz|mah|w)\b|\b[A-Z]{2,5}\d*\b/i.test(q))) lines.push("You searched using technical terms.");
  if (view.source === "director") lines.push("Babel's agent chose this view from what you did on earlier pages.");
  if (!lines.length) lines.push("Babel has seen too little yet, so this page is close to the store's usual one.");
  return lines.slice(0, 5);
}

const label = (registry: Registry, view: View, id: BlockId) => registry[view.template]?.[id]?.label ?? id;
const words = (v: string) => v.replaceAll("_", " ");

/** One line per change between two views of the same page type, in the store's own block names. */
export function describeChanges(prev: View | undefined, next: View, registry: Registry): string[] {
  if (!prev || prev.template !== next.template) return [];
  const lines: string[] = [];
  if (prev.persona.dialect !== next.persona.dialect) lines.push(`Look: ${prev.persona.dialect} → ${next.persona.dialect}`);
  if (prev.persona.need !== next.persona.need) lines.push(`Leads with: ${prev.persona.need} → ${next.persona.need}`);
  if (prev.skin !== next.skin) lines.push(`Style: ${prev.skin} → ${next.skin}`);
  if (prev.copyRegister !== next.copyRegister) lines.push(`Wording: ${prev.copyRegister} → ${next.copyRegister}`);
  if (Math.abs(prev.theme.typeScale - next.theme.typeScale) > 1e-9) lines.push(`Text size: ${Math.round(prev.theme.typeScale * 100)}% → ${Math.round(next.theme.typeScale * 100)}%`);
  for (const id of changedBlocks(prev.blocks, next.blocks)) {
    const a = prev.blocks.find((b) => b.id === id), b = next.blocks.find((x) => x.id === id);
    if (!a || !b) continue;
    const bits: string[] = [];
    if (a.variant !== b.variant) bits.push(`${words(a.variant)} → ${words(b.variant)}`);
    if (!!a.collapsed !== !!b.collapsed) bits.push(b.collapsed ? "folded away" : "opened");
    if (a.order !== b.order) bits.push(`moved to position ${b.order}`);
    lines.push(`${label(registry, next, id)}: ${bits.join(", ") || "changed"}`);
  }
  return lines;
}
