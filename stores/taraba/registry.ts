// Taraba's declared blocks and variants. Babel may only choose from these.
// Key order within a template is the store's default page order.
import type { Registry } from "@/babel/sdk";

// Plain-language descriptions for the Director: what each variant shows and, just as important, what it leaves out.
const HERO = {
  banner_promo: "A wide banner for the store's current offer, with two product pictures and the offer text.",
  category_tiles: "A plain grid of category tiles, each with a small picture and the category name. No offer text.",
  collage: "An image-led collage of category pictures with only the category name on each. Almost no text.",
};
const LIST = {
  grid_standard: "Products as pictures in a 3-column grid. Each shows name, price and the star rating with the number of reviews.",
  grid_dense: "A compact table, one row per product: small picture, name, brand, first spec, star rating (no review count) and price. Fits the most products on screen.",
  list_guided: "One product per row: large picture, large name, two benefits, big price and a 'See this product' button. No star rating and no review count.",
  bento_visual: "An image-first mosaic: pictures fill the tiles with the name and price over the picture. No star rating and no review count.",
};
const LIST_CANNOT = [
  "Sort the products (by reviews, price or anything else)",
  "Filter products or change which products are shown",
  "Change the size of the pictures other than by choosing one of the layouts above",
];

export const registry: Registry = {
  home: {
    hero: {
      label: "Featured",
      variants: ["banner_promo", "category_tiles", "collage"],
      neutral: "banner_promo",
      byDialect: { guided: "category_tiles", dense: "category_tiles", visual: "collage" },
      describe: HERO,
      cannot: ["Change the pictures, the offer or the text in the banner"],
    },
    productList: {
      label: "Products",
      variants: ["grid_standard", "grid_dense", "list_guided", "bento_visual"],
      neutral: "grid_standard",
      byDialect: { guided: "list_guided", dense: "grid_dense", visual: "bento_visual" },
      describe: LIST,
      cannot: LIST_CANNOT,
    },
  },
  category: {
    productList: {
      label: "Products",
      variants: ["grid_standard", "grid_dense", "list_guided", "bento_visual"],
      neutral: "grid_standard",
      required: true,
      byDialect: { guided: "list_guided", dense: "grid_dense", visual: "bento_visual" },
      describe: LIST,
      cannot: LIST_CANNOT,
    },
  },
  product: {
    gallery: {
      label: "Photos",
      variants: ["grid_thumbs", "single_large", "side_large"], // side_*: half width, sits next to another side_* block
      neutral: "grid_thumbs",
      byDialect: { guided: "single_large", visual: "single_large" },
      describe: {
        grid_thumbs: "One main picture with three small thumbnails beside it to pick a view, using the full page width.",
        single_large: "One large picture across the full page width, no thumbnails. The largest layout for the photos.",
        side_large: "One large picture at half the page width, with another half-width section (reviews, specifications or the price box) beside it. The smallest the photo gets. Use it together with another side_ variant.",
      },
      cannot: ["Change the pictures themselves, or make them any size other than these layouts"],
    },
    summary: {
      label: "About this product",
      variants: ["standard", "benefits_plain"],
      neutral: "standard",
      byDialect: { guided: "benefits_plain", visual: "benefits_plain" },
      describe: {
        standard: "One paragraph describing the product, in the current wording level (plain, standard or technical).",
        benefits_plain: "The plain-words description followed by a short checklist of the product's benefits.",
      },
      cannot: ["Change what the description says"],
    },
    buyBox: {
      label: "Price and buy",
      variants: ["standard", "calm", "prominent_simple", "side_standard"],
      neutral: "standard",
      required: true,
      byDialect: { guided: "prominent_simple" },
      describe: {
        standard: "Price, the store's promotion badge and old price when there is one, stock and delivery, and an Add to cart button.",
        calm: "Price without the promotion badge, one line with free returns, warranty and delivery, and an Add to cart button.",
        prominent_simple: "A very large price, only the delivery time, and a full-width Add to cart button. No promotion badge.",
        side_standard: "The standard price and Add to cart box at half the page width, sitting beside another half-width section. Use it together with another side_ variant.",
      },
      cannot: ["Change the price, add discounts or urgency"],
    },
    specs: {
      label: "Specifications",
      variants: ["table_key", "table_full", "side_key", "hidden"],
      neutral: "table_key",
      byDialect: { dense: "table_full" },
      describe: {
        table_key: "The first three specifications, with a link that opens all of them.",
        table_full: "Every specification, open, in one table.",
        side_key: "The first three specifications at half the page width, sitting beside another half-width section. Use it together with another side_ variant.",
        hidden: "The specifications are not shown.",
      },
    },
    trust: {
      label: "Reviews, returns and warranty",
      variants: ["reviews_summary", "returns_warranty_first", "side_reviews"],
      neutral: "reviews_summary",
      describe: {
        reviews_summary: "The star rating and review count, what people like and watch out for, buttons to summarise and read the reviews, then returns, warranty and delivery as small expandable lines.",
        returns_warranty_first: "Returns, warranty and delivery first as three boxes, then the same reviews block underneath.",
        side_reviews: "The same reviews block (rating, what people like, read reviews, returns and warranty lines) in a narrow single column at half the page width, beside another half-width section. Use it together with another side_ variant.",
      },
    },
  },
};
