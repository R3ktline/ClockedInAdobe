// Single source of truth for Babel's data contracts (SPEC §4-§9). Track A owns this file.
import { z } from "zod";

export const Dialect = z.enum(["guided", "standard", "dense", "visual"]);
export const Need = z.enum(["specs", "deals", "inspiration", "reassurance", "quick", "balanced"]);
export const Persona = z.object({
  dialect: Dialect,
  need: Need,
  confidence: z.number().min(0).max(1),
});

export const Template = z.enum(["home", "category", "product"]);
export const BlockId = z.enum([
  "hero", "productList", "filters", "gallery", "summary", "specs",
  "trust", "buyBox", "compare", "continuity", "assist",
]);
export const Category = z.enum(["electronics", "fashion", "home", "groceries", "toys", "health_beauty"]);
export const CopyRegister = z.enum(["plain", "standard", "technical"]);

// ---------- Catalog (merchant facts: the LLM never writes these) ----------

export const Product = z.object({
  id: z.string(),
  category: Category,
  name: z.string(),
  brand: z.string(),
  price: z.number().positive(), // RON
  stock: z.number().int().min(0),
  rating: z.number().min(0).max(5),
  reviewCount: z.number().int().min(0),
  specs: z.array(z.object({ key: z.string(), label: z.string(), value: z.string() })),
  copy: z.object({ plain: z.string(), standard: z.string(), technical: z.string() }),
  benefits: z.array(z.string()),
  reviewSummary: z.object({ pros: z.array(z.string()), cons: z.array(z.string()) }),
  // A few review texts to show (simulated, synthetic data). rating/reviewCount stay the store-wide totals.
  reviews: z.array(z.object({
    author: z.string(),
    rating: z.number().int().min(1).max(5),
    date: z.iso.date(),
    title: z.string(),
    text: z.string(),
    verified: z.boolean(),
  })),
  policies: z.object({
    returnDays: z.number().int(),
    warrantyMonths: z.number().int(),
    deliveryDays: z.number().int(),
  }),
  // Store-wide promotion: the same for every shopper.
  promotion: z.object({ label: z.string(), oldPrice: z.number().positive() }).optional(),
});
export const Catalog = z.array(Product);

// ---------- Context the store passes in (synthetic in the demo) ----------

export const PartnerContext = z.object({
  consent: z.object({ personalization: z.boolean(), partnerData: z.boolean() }),
  visitor: z.object({
    returning: z.boolean(),
    visits: z.number().int().min(1),
    lastVisitAt: z.string().optional(),
  }),
  account: z.object({
    tenureMonths: z.number().int().optional(),
    orderCategories: z.array(Category).optional(),
    accessibility: z.object({
      largeText: z.boolean().optional(),
      reducedMotion: z.boolean().optional(),
      highContrast: z.boolean().optional(),
    }).optional(),
    preferredLanguage: z.string().optional(),
    // Only ever sent by the partner with consent; never inferred (GUARDRAILS §3).
    ageBand: z.enum(["minor", "18-34", "35-54", "55+"]).optional(),
  }).optional(),
  campaign: z.object({
    utmSource: z.string().optional(),
    utmCampaign: z.string().optional(),
    intentTag: z.enum(["deal", "gift", "specs", "new-season"]).optional(),
  }).optional(),
  // Filled in by the SDK, not by the partner.
  device: z.object({
    pointer: z.enum(["coarse", "fine"]),
    viewportWidth: z.number(),
    zoom: z.number(),
    prefersReducedMotion: z.boolean(),
    prefersContrast: z.boolean(),
  }).optional(),
});

// ---------- Interaction signals ----------

export const EventType = z.enum([
  "page_view", "back_nav", "product_click", "category_click",
  "block_view", "block_dwell", "block_open", "scroll", "idle",
  "search", "filter", "sort",
  "gallery_swipe", "image_zoom", "hover_price", "review_open", "policy_open", "compare_add", "size_guide_open",
  "add_to_cart", "remove_from_cart", "checkout_start", "reorder_click",
  "rage_click", "dead_click", "mis_tap", "page_zoom", // page_zoom value = zoom relative to page load (1.25 = 125%)
  "slide_shown", "slide_undo", "slide_prev", "slide_next", "why_open", "view_switch", "chat_message",
]);
export const InteractionEvent = z.object({
  t: z.number().min(0), // ms since visit start
  type: EventType,
  blockId: BlockId.optional(),
  productId: z.string().optional(),
  value: z.union([z.string().max(200), z.number()]).optional(),
  // WHAT was looked at or zoomed on, as the store labelled it ("price", "spec:battery", "photo"). Never free text.
  target: z.string().regex(/^[a-z0-9_:.-]{1,60}$/).optional(),
});

// ---------- Markers (docs/MARKERS.md) ----------

export const MarkerId = z.enum([
  "purchaseIntent", "priceSensitivity", "infoAppetite", "jargonComfort", "trustNeed",
  "hesitation", "confusion", "inspirationAppetite", "categoryAffinity", "featureInterest",
  "interactionFluency", "abandonmentRisk", "adaptationAcceptance",
]);
export const MarkerValue = z.object({
  value: z.number().min(0).max(1),
  trend: z.enum(["up", "flat", "down"]),
  evidence: z.array(z.object({ t: z.number(), type: EventType, note: z.string().optional() })),
});
export const Markers = z.partialRecord(MarkerId, MarkerValue);

// ---------- Store side: brand kit and registry ----------

export const Density = z.enum(["airy", "comfortable", "compact"]);
export const Contrast = z.enum(["normal", "high"]);

export const BrandKit = z.object({
  store: z.string(),
  name: z.string(),
  colors: z.object({
    primary: z.string(), accent: z.string(), surface: z.string(), text: z.string(), muted: z.string(),
  }),
  fonts: z.object({ heading: z.string(), body: z.string() }),
  ranges: z.object({
    typeScale: z.tuple([z.number(), z.number()]),
    radius: z.tuple([z.number(), z.number()]),
    density: z.array(Density).min(1),
    contrast: z.array(Contrast).min(1),
  }),
  voice: z.object({ do: z.array(z.string()), dont: z.array(z.string()) }),
  bannedWords: z.array(z.string()),
});

export const BlockSpec = z.object({
  label: z.string(),
  variants: z.array(z.string()).min(1),
  neutral: z.string(),
  required: z.boolean().optional(), // may be collapsed, never hidden
  byDialect: z.partialRecord(Dialect, z.string()).optional(), // the store's reading of each dialect
  // What each variant looks like and what it leaves out, in plain words. The Director reads this to know which
  // variant answers a request ("smaller photos" -> the one described as the smallest layout).
  describe: z.record(z.string(), z.string().max(240)).optional(),
  // Things shoppers may ask for that this block cannot do, so the agent says so instead of guessing.
  cannot: z.array(z.string().max(120)).optional(),
});
// Key order inside a template is the store's default block order.
export const Registry = z.partialRecord(Template, z.partialRecord(BlockId, BlockSpec));

// ---------- Slides (SPEC §4) ----------

export const Theme = z.object({
  density: Density,
  typeScale: z.number().min(0.5).max(2),
  contrast: Contrast,
  radius: z.number().min(0).max(48),
  motion: z.enum(["full", "reduced"]),
});

// A skin is a visual identity for the store frame (app/skins.css). "alpha" is Bento, the default; "none" is the store's own look.
export const Skin = z.enum(["none", "genx", "alpha", "alphadark", "millennial", "xp", "print"]);

export const SlideBlock = z.object({
  id: BlockId,
  variant: z.string(),
  order: z.number().int().min(1),
  collapsed: z.boolean().optional(),
  maxItems: z.number().int().min(1).optional(),
  fields: z.array(z.string()).optional(),
});

export const Hypothesis = z.object({
  marker: MarkerId,
  expect: z.enum(["up", "down"]),
  withinSeconds: z.number().int().min(5).max(300),
  // The business result the agent also bets on, measured in code from what the shopper does next (never by the model):
  // cart = adds to cart and keeps it, checkout = starts checkout, time = still active half the window later,
  // no_back = does not press back / undo. Optional: a slide without one is judged on its marker only.
  outcome: z.enum(["cart", "checkout", "time", "no_back"]).optional(),
});

export const Slide = z.object({
  id: z.string(),
  index: z.number().int().min(0),
  parentId: z.string().optional(),
  kind: z.enum(["initial", "minor", "major", "explicit"]),
  trigger: z.enum(["page_load", "revisit", "markers", "chat", "view_switch", "agent_handoff", "calibration"]),
  template: Template,
  persona: Persona,
  theme: Theme,
  skin: Skin.optional(), // absent = the store's own look
  copyRegister: CopyRegister,
  blocks: z.array(SlideBlock).min(1),
  keep: z.array(BlockId),
  rationale: z.string().max(240),
  hypothesis: Hypothesis.optional(),
  confidence: z.number().min(0).max(1),
  source: z.enum(["rules", "director", "concierge", "explicit", "cache"]),
});

export const Timeline = z.object({
  visitorId: z.string(),
  visitId: z.string(),
  slides: z.array(Slide),
  cursor: z.number().int().min(0),
});

// "I wanted a variant the registry does not have." Never rendered; saved for a human to build (rule 1).
export const Gap = z.object({
  block: BlockId,
  wanted: z.string().max(140), // what the block should look like or do
  why: z.string().max(200),    // the shopper behaviour behind it
});

// Interpret first: when the shopper typed a request, the Director lists each separate wish in it, says whether it
// can be done, and names the block variants that make it true. Code checks the slide against this list and builds
// the shopper's reply from it, so the answer is never more cheerful than what actually changed.
export const Understood = z.array(z.object({
  wanted: z.string().max(120),                       // one wish, in plain words ("photos smaller")
  status: z.enum(["do", "already", "cannot"]),       // do = this slide makes it true; already = it is true now; cannot = not offered
  how: z.string().max(160).optional(),               // do: what the slide does. cannot: why not
  sets: z.array(z.object({ block: BlockId, variant: z.string() })).max(12).optional(), // variants that make it true
})).max(6);

// What the Director proposes: a change to the current slide. Code assembles the full Slide.
export const SlideProposal = z.object({
  understood: Understood.optional(),
  gaps: z.array(Gap).max(2).optional(),
  dialect: Dialect.optional(), // only accepted on a major slide (return visit)
  need: Need.optional(),
  changes: z.array(z.object({
    id: BlockId,
    variant: z.string().optional(),
    order: z.number().int().min(1).optional(),
    collapsed: z.boolean().optional(),
  })).max(11),
  theme: Theme.partial().optional(),
  skin: Skin.optional(), // the visual identity of the whole page: accepted on a major or explicit slide only, never a minor one
  copyRegister: CopyRegister.optional(),
  rationale: z.string().max(240),
  hypothesis: Hypothesis,
});

export type Skin = z.infer<typeof Skin>;
export type Dialect = z.infer<typeof Dialect>;
export type Need = z.infer<typeof Need>;
export type Persona = z.infer<typeof Persona>;
export type Template = z.infer<typeof Template>;
export type BlockId = z.infer<typeof BlockId>;
export type Category = z.infer<typeof Category>;
export type CopyRegister = z.infer<typeof CopyRegister>;
export type Product = z.infer<typeof Product>;
export type PartnerContext = z.infer<typeof PartnerContext>;
export type EventType = z.infer<typeof EventType>;
export type InteractionEvent = z.infer<typeof InteractionEvent>;
export type MarkerId = z.infer<typeof MarkerId>;
export type MarkerValue = z.infer<typeof MarkerValue>;
export type Markers = z.infer<typeof Markers>;
export type BrandKit = z.infer<typeof BrandKit>;
export type BlockSpec = z.infer<typeof BlockSpec>;
export type Registry = z.infer<typeof Registry>;
export type Theme = z.infer<typeof Theme>;
export type SlideBlock = z.infer<typeof SlideBlock>;
export type Hypothesis = z.infer<typeof Hypothesis>;
export type Slide = z.infer<typeof Slide>;
export type Timeline = z.infer<typeof Timeline>;
export type Gap = z.infer<typeof Gap>;
export type Understood = z.infer<typeof Understood>;
export type SlideProposal =z.infer<typeof SlideProposal>;
