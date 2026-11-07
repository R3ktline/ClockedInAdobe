// Taraba's declared blocks and variants. Babel may only choose from these. Key order inside a template is the
// store's default page order. `byDialect` and `byNeed` are the store's own reading of each dialect and need:
// Babel holds no store variant names. `describe` tells the agents what each variant shows and what it leaves out.
import type { Registry } from "@/babel/sdk";

const LIST = {
  variants: ["grid_standard", "grid_dense", "list_guided", "bento_visual"],
  neutral: "grid_standard",
  byDialect: { guided: "list_guided", dense: "grid_dense", visual: "bento_visual" },
  byNeed: { inspiration: { variant: "bento_visual" } },
  describe: {
    grid_standard: "Products as pictures in a 3-column grid with name, price, star rating and review count.",
    grid_dense: "A compact table, one row per product: small picture, name, brand, first spec, rating and price. Most products per screen.",
    list_guided: "One product per row: large picture, large name, two benefits, big price and a 'See this product' button. No star rating.",
    bento_visual: "An image-first mosaic with name and price over each picture. No star rating, no review count.",
  },
};

export const registry: Registry = {
  home: {
    hero: {
      label: "Featured",
      variants: ["banner_promo", "category_tiles", "collage"],
      neutral: "banner_promo",
      byDialect: { guided: "category_tiles", dense: "category_tiles", visual: "collage" },
      byNeed: { inspiration: { variant: "collage" }, reassurance: { variant: "category_tiles" }, quick: { variant: "category_tiles" } },
      describe: {
        banner_promo: "A wide banner with the store's current promotion (the same for every shopper) and two product pictures.",
        category_tiles: "A plain grid of category tiles with a small picture and the category name. No promotion text.",
        collage: "An image-led collage of category pictures with only the category name. Almost no text.",
      },
    },
    continuity: {
      label: "Recently viewed",
      variants: ["hidden", "recent"],
      neutral: "hidden",
      byNeed: { quick: { variant: "recent", order: 1 } },
      describe: {
        hidden: "Not shown.",
        recent: "A strip with the products this shopper looked at in this visit, to get back to them in one click.",
      },
    },
    productList: { label: "Products", ...LIST },
  },
  category: {
    filters: {
      label: "Filters and sorting",
      required: true,
      variants: ["sidebar", "compact", "simple", "price_first"],
      neutral: "sidebar",
      byDialect: { dense: "compact", guided: "simple" },
      byNeed: { deals: { variant: "price_first" } },
      describe: {
        sidebar: "A sidebar with sort, price, rating, stock, on-sale and brand filters. Sorted by relevance.",
        compact: "The same filters in a tight bar above the list, every facet open at once.",
        simple: "Only a large 'sort by' choice and two big buttons: 'In stock' and 'Best rated'.",
        price_first: "The sidebar, sorted by lowest price first, with the store's on-sale filter shown first. Same prices for everyone.",
      },
    },
    productList: { label: "Products", required: true, ...LIST },
  },
  product: {
    gallery: {
      label: "Photos",
      variants: ["grid_thumbs", "single_large", "strip"],
      neutral: "grid_thumbs",
      byDialect: { guided: "single_large", visual: "strip" },
      byNeed: { inspiration: { variant: "strip" } },
      describe: {
        grid_thumbs: "One main picture with three thumbnails beside it to pick a view.",
        single_large: "One large picture across the page, no thumbnails. Nothing to choose.",
        strip: "Three large pictures side by side to swipe through. The most image-heavy layout.",
      },
    },
    summary: {
      label: "About this product",
      variants: ["standard", "benefits_plain", "key_facts"],
      neutral: "standard",
      byDialect: { guided: "benefits_plain", visual: "benefits_plain", dense: "key_facts" },
      describe: {
        standard: "One paragraph about the product, in the page's wording level (plain, standard or technical).",
        benefits_plain: "The plain-words description followed by a short checklist of benefits.",
        key_facts: "The technical description followed by the first five specifications as a bullet list.",
      },
    },
    buyBox: {
      label: "Price and buy",
      required: true,
      variants: ["standard", "calm", "prominent_simple"],
      neutral: "standard",
      byDialect: { guided: "prominent_simple" },
      byNeed: { reassurance: { variant: "calm" }, quick: { order: 1 } },
      describe: {
        standard: "Price, the store's promotion badge and old price when there is one, stock, delivery and Add to cart.",
        calm: "Price without the promotion badge, one line with free returns, warranty and delivery, and Add to cart.",
        prominent_simple: "A very large price, only the delivery time, and a full-width Add to cart button. No promotion badge.",
      },
    },
    specs: {
      label: "Specifications",
      variants: ["table_key", "table_full", "hidden"],
      neutral: "table_key",
      byDialect: { dense: "table_full" },
      byNeed: { specs: { variant: "table_full", order: 2 }, quick: { collapsed: true } },
      describe: {
        table_key: "The first three specifications, with a link that opens the rest.",
        table_full: "Every specification, open, in one table.",
        hidden: "The specifications are not shown.",
      },
    },
    trust: {
      label: "Reviews, returns and warranty",
      variants: ["reviews_summary", "returns_warranty_first"],
      neutral: "reviews_summary",
      byNeed: { reassurance: { variant: "returns_warranty_first", order: 2 }, quick: { collapsed: true } },
      describe: {
        reviews_summary: "Star rating, what people like and watch out for, the review texts, then returns, warranty and delivery as small expandable lines.",
        returns_warranty_first: "Returns, warranty and delivery first as three boxes, then the same reviews block.",
      },
    },
    compare: {
      label: "Compare",
      variants: ["hidden", "similar", "cheaper"],
      neutral: "hidden",
      byDialect: { dense: "similar" },
      byNeed: { specs: { variant: "similar" }, deals: { variant: "cheaper" } },
      describe: {
        hidden: "Not shown.",
        similar: "A table comparing this product with two similar ones from the same category, rows that differ marked.",
        cheaper: "Up to three cheaper products from the same category, with their catalog prices. Same prices for everyone.",
      },
    },
    assist: {
      label: "Help choosing",
      variants: ["hidden", "ask_prompt"],
      neutral: "hidden",
      byDialect: { guided: "ask_prompt" },
      describe: {
        hidden: "Not shown.",
        ask_prompt: "A box offering the store's AI assistant with three example questions to tap.",
      },
    },
    continuity: {
      label: "Recently viewed",
      variants: ["hidden", "recent"],
      neutral: "hidden",
      describe: {
        hidden: "Not shown.",
        recent: "A strip with the other products this shopper looked at in this visit.",
      },
    },
  },
};
