// Taraba's declared blocks and variants. Babel may only choose from these.
// Key order within a template is the store's default page order.
import type { Registry } from "@/babel/sdk";

export const registry: Registry = {
  home: {
    hero: {
      label: "Featured",
      variants: ["banner_promo", "category_tiles"],
      neutral: "banner_promo",
      byDialect: { guided: "category_tiles", dense: "category_tiles" },
    },
    productList: {
      label: "Products",
      variants: ["grid_standard", "grid_dense", "list_guided"],
      neutral: "grid_standard",
      byDialect: { guided: "list_guided", dense: "grid_dense" },
    },
  },
  category: {
    productList: {
      label: "Products",
      variants: ["grid_standard", "grid_dense", "list_guided"],
      neutral: "grid_standard",
      required: true,
      byDialect: { guided: "list_guided", dense: "grid_dense" },
    },
  },
  product: {
    gallery: {
      label: "Photos",
      variants: ["grid_thumbs", "single_large"],
      neutral: "grid_thumbs",
      byDialect: { guided: "single_large", visual: "single_large" },
    },
    summary: {
      label: "About this product",
      variants: ["standard", "benefits_plain"],
      neutral: "standard",
      byDialect: { guided: "benefits_plain", visual: "benefits_plain" },
    },
    buyBox: {
      label: "Price and buy",
      variants: ["standard", "calm", "prominent_simple"],
      neutral: "standard",
      required: true,
      byDialect: { guided: "prominent_simple" },
    },
    specs: {
      label: "Specifications",
      variants: ["table_key", "table_full", "hidden"],
      neutral: "table_key",
      byDialect: { dense: "table_full" },
    },
    trust: {
      label: "Reviews, returns and warranty",
      variants: ["reviews_summary", "returns_warranty_first"],
      neutral: "reviews_summary",
    },
  },
};
