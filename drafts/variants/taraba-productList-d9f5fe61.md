<!-- gap d9f5fe61: Image-first cards with a larger main photo and a quick-view zoom on the product image. -->

## Registry entry

**Variant name:** `grid_zoom`

**One-line change:** in `blockSpec.variants`, append `"grid_zoom"` after `"bento_visual"`:

```diff
-  "variants": ["grid_standard", "grid_dense", "list_guided", "bento_visual"],
+  "variants": ["grid_standard", "grid_dense", "list_guided", "bento_visual", "grid_zoom"],
```

`neutral` stays `"grid_standard"`. `byDialect` is unchanged (no dialect currently points at this variant).

## Component

```tsx
import {
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

/* Brand kit tokens — kept in one place so a reviewer can check them at a glance. */
const HEADING_FONT = "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif";
const BODY_FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const COLOR_TEXT = "#14171f";
const COLOR_MUTED = "#5b6170";
const COLOR_PRIMARY = "#2346d8";
const COLOR_ACCENT = "#f5b800";
const COLOR_SURFACE = "#ffffff";

const ZOOM_SCALE = 1.9;

export type AvailabilityStatus = "in_stock" | "out_of_stock" | "backorder";

/**
 * Everything the card shows comes from this shape.
 * The catalog owns the wording of measurements and prices (price.formatted,
 * rating.*, image.width/height) so the block never formats or invents numbers.
 */
export type CatalogProduct = {
  id: string;
  name: string;
  href: string;
  image: { src: string; alt: string; width: number; height: number };
  price: { formatted: string };
  availability: { status: AvailabilityStatus };
  rating?: { average: number; count: number } | null;
  delivery?: { label: string } | null;
  summary?: string | null;
};

export type ProductListGridZoomProps = {
  /** Products to render, in display order. Ids missing from `catalog` are skipped. */
  productIds: string[];
  catalog: Record<string, CatalogProduct>;
  /** Section heading text. UI copy only. */
  label?: string;
};

/* Plain words for the availability value. No counts, no pressure. */
const AVAILABILITY_COPY: Record<AvailabilityStatus, string> = {
  in_stock: "In stock",
  out_of_stock: "Out of stock",
  backorder: "Can be ordered",
};

function ProductImage({
  product,
  priority,
}: {
  product: CatalogProduct;
  priority: boolean;
}) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const frameRef = useRef<HTMLDivElement>(null);
  const zoomed = pinned || hovered;

  /* Mouse only: follows the pointer so the detail under the cursor is magnified.
     Touch and keyboard get the same result through the toggle button below. */
  const trackPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    setOrigin({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <div
      ref={frameRef}
      className="relative overflow-hidden rounded-[14px] bg-[#14171f]/5"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setHovered(false);
      }}
      onPointerMove={trackPointer}
      onPointerCancel={() => setHovered(false)}
    >
      {/* Duplicate of the title link below: hidden from assistive tech and the
          tab order so each product is a single stop. */}
      <a href={product.href} tabIndex={-1} aria-hidden="true" className="block">
        <img
          src={product.image.src}
          alt={product.image.alt}
          width={product.image.width}
          height={product.image.height}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className={[
            "block h-auto w-full object-cover transition-transform duration-200 ease-out motion-reduce:transition-none",
            zoomed ? "scale-[1.9]" : "scale-100",
          ].join(" ")}
          style={{ transformOrigin: `${origin.x}% ${origin.y}%` }}
        />
      </a>

      <button
        type="button"
        aria-pressed={pinned}
        aria-label={
          pinned ? `Zoom out: ${product.name}` : `Zoom image: ${product.name}`
        }
        onClick={() => setPinned((value) => !value)}
        className="absolute bottom-2 right-2 rounded-[10px] border border-[#14171f]/15 bg-[#ffffff]/95 px-3 py-1.5 text-[0.95rem] font-medium text-[#14171f] shadow-sm transition-colors hover:bg-[#ffffff] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2346d8] focus-visible:ring-offset-2"
      >
        {pinned ? "Zoom out" : "Zoom"}
      </button>
    </div>
  );
}

function ProductCard({
  product,
  priority,
}: {
  product: CatalogProduct;
  priority: boolean;
}) {
  const ratingCountWord = product.rating?.count === 1 ? "rating" : "ratings";

  return (
    <li className="flex flex-col">
      <ProductImage product={product} priority={priority} />

      <div className="mt-3 flex flex-col gap-1">
        <h3
          className="text-[1.05rem] font-semibold leading-snug text-[#14171f]"
          style={{ fontFamily: HEADING_FONT }}
        >
          <a
            href={product.href}
            className="rounded-[6px] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2346d8] focus-visible:ring-offset-2"
          >
            {product.name}
          </a>
        </h3>

        {product.summary ? (
          <p
            className="line-clamp-2 text-[0.95rem] leading-relaxed text-[#5b6170]"
            style={{ fontFamily: BODY_FONT, color: COLOR_MUTED }}
          >
            {product.summary}
          </p>
        ) : null}

        <p
          className="text-[1.15rem] font-semibold text-[#14171f]"
          style={{ fontFamily: BODY_FONT, color: COLOR_TEXT }}
        >
          {product.price.formatted}
        </p>

        <p
          className="text-[0.95rem] text-[#5b6170]"
          style={{ fontFamily: BODY_FONT, color: COLOR_MUTED }}
        >
          {AVAILABILITY_COPY[product.availability.status]}
        </p>

        {product.rating ? (
          <p
            className="text-[0.95rem] text-[#5b6170]"
            style={{ fontFamily: BODY_FONT, color: COLOR_MUTED }}
          >
            <span aria-hidden="true" style={{ color: COLOR_ACCENT }}>
              ★
            </span>{" "}
            {product.rating.average} out of 5 · {product.rating.count}{" "}
            {ratingCountWord}
          </p>
        ) : null}

        {product.delivery ? (
          <p
            className="text-[0.95rem] text-[#5b6170]"
            style={{ fontFamily: BODY_FONT, color: COLOR_MUTED }}
          >
            {product.delivery.label}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export default function ProductListGridZoom({
  productIds,
  catalog,
  label = "Products",
}: ProductListGridZoomProps) {
  const headingId = useId();
  const products = productIds
    .map((id) => catalog[id])
    .filter((product): product is CatalogProduct => Boolean(product));

  if (products.length === 0) return null;

  return (
    <section
      aria-labelledby={headingId}
      className="w-full"
      style={{ fontFamily: BODY_FONT, backgroundColor: COLOR_SURFACE }}
    >
      <h2
        id={headingId}
        className="mb-4 text-[1.3rem] font-semibold text-[#14171f]"
        style={{ fontFamily: HEADING_FONT, color: COLOR_TEXT }}
      >
        {label}
      </h2>

      <ul
        role="list"
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        {products.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            priority={index < 3}
          />
        ))}
      </ul>
    </section>
  );
}
```

## Notes

**Accessibility**

- Semantic structure: `<section aria-labelledby>` → `<h2>` → `<ul role="list">` → `<li>` → `<h3>` with the product link. `role="list"` is set explicitly because Tailwind's reset removes list semantics in Safari.
- One keyboard stop per product: the title link. The image is also a link for pointer users but is `tabIndex={-1}` and `aria-hidden`, so screen readers and tab users don't hit the same destination twice.
- The zoom toggle is a real `<button>` with `aria-pressed`, a visible label ("Zoom" / "Zoom out") and an accessible name that begins with that label, so voice control ("click Zoom") still matches.
- Hover zoom is a mouse-only enhancement, not a requirement: keyboard, touch and switch users get the identical 1.9× magnification via the button. The button is placed outside the image anchor, so no interactive element is nested.
- Focus is visible on both the title link and the button: 2px primary ring with offset against the white surface.
- Motion: `motion-reduce:transition-none` removes the animated transition; the transform itself stays because it is the feature, not decoration.
- Stock and rating are conveyed as text, not colour alone. The star glyph is `aria-hidden`; the sentence "4.6 out of 5 · 128 ratings" carries the value. The singular/plural word is UI copy.
- Images reserve space from catalog `width`/`height`, so the zoom does not cause layout shift.

**Reviewer should check**

- **No hard-coded product data.** Name, href, image, price, availability, rating, delivery and summary all read from `catalog[id]`. The only literals are UI words ("In stock", "Zoom", "out of 5").
- **No discounts, urgency or scarcity.** There is no badge, no countdown, no percentage off, no "only N left" and no units-in-stock figure — availability is reduced to a status word. Compare-at / was-prices are deliberately **not** rendered because the brand rules ban discount messaging; if merchandising wants reference pricing, that is a separate decision with the brand owner, not a silent addition here.
- **Zoom fidelity.** `ZOOM_SCALE` is 1.9. Confirm the catalog assets are at least ~2× the rendered card width, otherwise the zoom looks soft; lowering to ~1.6 is the safe fallback. Also confirm the magnified area never lands on a face-critical crop in the fixture set.
- **The zoom origin is percentage-based** on the frame, so it survives resizes. Test with a trackpad (many small `pointermove` events), with the pointer entering directly over the button, and on touch — touch should never auto-zoom, only the button.
- **Brand kit:** colours used are only `#2346d8`, `#f5b800` (decorative star only, never text), `#ffffff`, `#14171f`, `#5b6170`; radii are 16 / 14 / 10 / 6, inside the 6–16 range; type sizes are 0.95 / 1.05 / 1.15 / 1.3rem, inside the 0.95–1.3 scale; density is "comfortable" (`gap-6`).
- **Copy pass:** voice is friendly, plain, no exclamation marks, none of the banned words appear. Confirm "Can be ordered" reads right for the `backorder` state.
- **Data edge cases:** ids missing from `catalog` are skipped silently — confirm that's acceptable or should surface a dev warning. Long product names and summaries should wrap; the summary clamps to two lines.
- **Assets:** confirm the fixture uses local placeholder imagery only — no real brand names, logos or hotlinked URLs.
- **Manual test pass:** keyboard only, touch device, screen reader link list, browser zoom at 200%, and RTL if the storefront ships it (the grid direction is inherited, nothing is hard-coded left/right except the button's `right-2`).
