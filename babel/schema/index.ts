// Babel's data contracts. Single source of truth: TS types are inferred from these, the JSON Schema in the
// prompts is generated from them. Nothing in a View or a Plan can carry a price, stock, rating, discount,
// delivery date or product copy: store components render those from the catalog by product id.
import { z } from "zod";

export const Dialect = z.enum(["guided", "standard", "dense", "visual"]);
export const Need = z.enum(["specs", "deals", "inspiration", "reassurance", "quick", "balanced"]);
export const Persona = z.object({ dialect: Dialect, need: Need, confidence: z.number().min(0).max(1) });

export const Template = z.enum(["home", "category", "product"]);
export const BlockId = z.enum([
  "hero", "productList", "filters", "gallery", "summary", "specs",
  "trust", "buyBox", "compare", "continuity", "assist",
]);
export const Category = z.enum(["electronics", "fashion", "home", "groceries", "toys", "health_beauty"]);
export const CopyRegister = z.enum(["plain", "standard", "technical"]);

// ---------- Catalog: merchant facts. The LLM never writes these. ----------

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
  reviews: z.array(z.object({
    author: z.string(), rating: z.number().int().min(1).max(5), date: z.iso.date(),
    title: z.string(), text: z.string(), verified: z.boolean(),
  })),
  policies: z.object({ returnDays: z.number().int(), warrantyMonths: z.number().int(), deliveryDays: z.number().int() }),
  promotion: z.object({ label: z.string(), oldPrice: z.number().positive() }).optional(), // store-wide, same for everyone
});
export const Catalog = z.array(Product);

// ---------- What the store passes in (synthetic in the demo) ----------

export const PartnerContext = z.object({
  consent: z.object({ personalization: z.boolean(), partnerData: z.boolean() }),
  visitor: z.object({ returning: z.boolean(), visits: z.number().int().min(1) }),
  account: z.object({
    tenureMonths: z.number().int().optional(),
    orderCategories: z.array(Category).optional(),
    accessibility: z.object({
      largeText: z.boolean().optional(), reducedMotion: z.boolean().optional(), highContrast: z.boolean().optional(),
    }).optional(),
    // Only ever sent by the partner with consent; never inferred, never shown, never used for prices (GUARDRAILS §3).
    ageBand: z.enum(["minor", "18-34", "35-54", "55+"]).optional(),
  }).optional(),
  campaign: z.object({
    utmSource: z.string().max(60).optional(),
    intentTag: z.enum(["deal", "gift", "specs", "new-season"]).optional(),
  }).optional(),
  device: z.object({
    pointer: z.enum(["coarse", "fine"]),
    viewportWidth: z.number(),
    prefersReducedMotion: z.boolean(),
    prefersContrast: z.boolean(),
  }).optional(),
});

// ---------- Interaction signals ----------

export const EventType = z.enum([
  "page_view", "back_nav", "product_click", "category_click",
  "block_view", "block_dwell", "block_open", "scroll", "idle",
  "search", "filter", "sort",
  "gallery_swipe", "image_zoom", "hover_price", "review_open", "review_sort", "policy_open", "compare_add",
  "add_to_cart", "remove_from_cart", "checkout_start", "reorder_click",
  "rage_click", "dead_click", "mis_tap", "page_zoom",
  "view_undo", "why_open", "view_switch", "chat_message", "keyboard_nav",
]);
export const InteractionEvent = z.object({
  t: z.number().min(0), // ms since the page opened
  type: EventType,
  blockId: BlockId.optional(),
  productId: z.string().max(64).optional(),
  value: z.union([z.string().max(200), z.number()]).optional(),
  // WHAT was looked at, as the store labelled it ("price", "spec:battery", "photo:2"). Never free text.
  target: z.string().regex(/^[a-z0-9_:.-]{1,60}$/).optional(),
});

// ---------- Markers (docs/MARKERS.md) ----------

export const MarkerId = z.enum([
  "purchaseIntent", "priceSensitivity", "infoAppetite", "jargonComfort", "trustNeed",
  "hesitation", "confusion", "inspirationAppetite", "categoryAffinity", "featureInterest",
  "interactionFluency", "abandonmentRisk", "adaptationAcceptance",
]);
export const Stage = z.enum(["browsing", "researching", "comparing", "deciding"]);
export const MarkerValue = z.object({
  value: z.number().min(0).max(1),
  trend: z.enum(["up", "flat", "down"]),
  evidence: z.array(z.object({ t: z.number(), page: z.number().int(), type: EventType, note: z.string().optional() })),
  top: z.array(z.object({ key: z.string(), value: z.number() })).optional(), // vector markers: categories, spec keys
});
export const Markers = z.partialRecord(MarkerId, MarkerValue);

// ---------- Store side: brand kit and registry ----------

export const Density = z.enum(["airy", "comfortable", "compact"]);
export const Contrast = z.enum(["normal", "high"]);

export const BrandKit = z.object({
  store: z.string(),
  name: z.string(),
  colors: z.object({ primary: z.string(), accent: z.string(), surface: z.string(), text: z.string(), muted: z.string() }),
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

const BlockPreset = z.object({ variant: z.string().optional(), order: z.number().int().min(1).optional(), collapsed: z.boolean().optional() });
export const BlockSpec = z.object({
  label: z.string(),
  variants: z.array(z.string()).min(1),
  neutral: z.string(),
  required: z.boolean().optional(),                         // may be collapsed, never hidden
  byDialect: z.partialRecord(Dialect, z.string()).optional(), // the store's reading of each dialect
  byNeed: z.partialRecord(Need, BlockPreset).optional(),      // the store's reading of each need
  describe: z.record(z.string(), z.string().max(240)),        // what each variant shows and leaves out, for the agents
});
// Key order inside a template is the store's default block order.
export const Registry = z.partialRecord(Template, z.partialRecord(BlockId, BlockSpec));

// ---------- Views (what a page opens with) ----------

export const Theme = z.object({
  density: Density,
  typeScale: z.number().min(0.5).max(2),
  contrast: Contrast,
  radius: z.number().min(0).max(48),
  motion: z.enum(["full", "reduced"]),
});

// Visual identity of the store frame (app/skins.css). "alpha" (Bento) is the default; "none" is the store's own look.
export const Skin = z.enum(["none", "genx", "alpha", "alphadark", "millennial", "xp", "print"]);

export const ViewBlock = z.object({
  id: BlockId,
  variant: z.string(),
  order: z.number().int().min(1),
  collapsed: z.boolean().optional(),
});

export const Hypothesis = z.object({
  marker: MarkerId,
  expect: z.enum(["up", "down"]),
  withinSeconds: z.number().int().min(10).max(300),
  // Business result, measured in code from what the shopper does next: cart = adds to cart and keeps it,
  // checkout = starts checkout, stay = still active when the window ends, no_undo = does not undo the view.
  outcome: z.enum(["cart", "checkout", "stay", "no_undo"]).optional(),
});

export const ViewKind = z.enum(["first", "next", "return", "explicit", "standard"]);
export const View = z.object({
  id: z.string(),
  template: Template,
  kind: ViewKind,
  source: z.enum(["rules", "director", "memory", "shopper", "none"]),
  persona: Persona,
  theme: Theme,
  skin: Skin,
  copyRegister: CopyRegister,
  blocks: z.array(ViewBlock).min(1),
  keep: z.array(BlockId),           // carried over from last visit; the validator refuses to change them
  rationale: z.string().max(240),   // shopper-facing: describes the view, never the person (policy-checked)
  hypothesis: Hypothesis.optional(),
});

// ---------- The Director's plan for the shopper's next pages ----------

export const BlockChange = z.object({
  template: Template,
  id: BlockId,
  variant: z.string().optional(),
  order: z.number().int().min(1).optional(),
  collapsed: z.boolean().optional(),
});

// "I wanted a variant the registry does not have." Never rendered; saved for a human to build.
export const Gap = z.object({ block: BlockId, wanted: z.string().max(140), why: z.string().max(200) });

export const Plan = z.object({
  need: Need.optional(),
  dialect: Dialect.optional(),          // allowed once per visit
  copyRegister: CopyRegister.optional(),
  typeScaleStep: z.union([z.literal(-1), z.literal(0), z.literal(1)]).optional(), // one step = 0.1
  changes: z.array(BlockChange).max(9),
  rationale: z.string().max(240),
  hypothesis: Hypothesis,
  gaps: z.array(Gap).max(2).optional(),
});

// ---------- An explicit change the shopper asked for (chat, view switch, style menu) ----------

export const ExplicitChange = z.object({
  dialect: Dialect.optional(),
  need: Need.optional(),
  copyRegister: CopyRegister.optional(),
  typeScaleStep: z.number().int().min(-3).max(3).optional(), // net steps of 0.1 the shopper asked for
  skin: Skin.optional(),
  changes: z.array(BlockChange.omit({ template: true })).max(8).optional(), // on the open page
});

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
export type Stage = z.infer<typeof Stage>;
export type MarkerValue = z.infer<typeof MarkerValue>;
export type Markers = z.infer<typeof Markers>;
export type BrandKit = z.infer<typeof BrandKit>;
export type BlockSpec = z.infer<typeof BlockSpec>;
export type Registry = z.infer<typeof Registry>;
export type Theme = z.infer<typeof Theme>;
export type Skin = z.infer<typeof Skin>;
export type ViewBlock = z.infer<typeof ViewBlock>;
export type Hypothesis = z.infer<typeof Hypothesis>;
export type ViewKind = z.infer<typeof ViewKind>;
export type View = z.infer<typeof View>;
export type BlockChange = z.infer<typeof BlockChange>;
export type Gap = z.infer<typeof Gap>;
export type Plan = z.infer<typeof Plan>;
export type ExplicitChange = z.infer<typeof ExplicitChange>;
