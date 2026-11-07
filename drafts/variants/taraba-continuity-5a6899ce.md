<!-- gap 5a6899ce: A small cart summary with a clear way to check out, visible on the home page -->

## Registry entry

- New variant: `cart_summary`
- One-line change: `continuity.variants: [...existingVariants, "cart_summary"]` — leave `"neutral"` unchanged.

## Component

```tsx
import * as React from "react";

type StockStatus = "in_stock" | "out_of_stock" | "backorder";

export type ContinuityCartCatalogProduct = {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  stock?: number | boolean | StockStatus;
  rating?: { value: number; count?: number };
  delivery?: { label: string; estimate?: string };
  /**
   * Present in some catalogs, but intentionally not rendered here:
   * the block brief bans discount promotion.
   */
  discount?: { label: string; amount?: number };
};

export type ContinuityCartItem = {
  productId: string;
  quantity: number;
};

type Props = {
  items: ContinuityCartItem[];
  productsById: Record<string, ContinuityCartCatalogProduct | undefined>;
  checkoutHref: string;
  onRemove?: (productId: string) => void;
  className?: string;
};

const bodyFont: React.CSSProperties = {
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
};

const headingFont: React.CSSProperties = {
  fontFamily: "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif",
};

function formatMoney(value: number, currency: string): string {
  if (!Number.isFinite(value)) return "—";

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function getStockLabel(
  stock: ContinuityCartCatalogProduct["stock"],
): string | null {
  if (stock === undefined) return null;
  if (typeof stock === "number") return stock > 0 ? "In stock" : "Out of stock";
  if (typeof stock === "boolean") return stock ? "In stock" : "Out of stock";
  if (stock === "in_stock") return "In stock";
  if (stock === "out_of_stock") return "Out of stock";
  if (stock === "backorder") return "Available on backorder";
  return null;
}

export function ContinuityCartSummary({
  items,
  productsById,
  checkoutHref,
  onRemove,
  className = "",
}: Props) {
  const headingId = React.useId();

  const lines = items.flatMap((item) => {
    const product = productsById[item.productId];
    if (!product || item.quantity <= 0) return [];
    return [{ item, product }];
  });

  const itemCount = lines.reduce((sum, line) => sum + line.item.quantity, 0);

  const totals = lines.reduce<Record<string, number>>((acc, line) => {
    const { item, product } = line;
    acc[product.currency] =
      (acc[product.currency] ?? 0) + product.price * item.quantity;
    return acc;
  }, {});

  return (
    <section
      aria-labelledby={headingId}
      className={`max-w-md rounded-2xl bg-[#ffffff] p-4 text-[#14171f] shadow-sm ring-1 ring-[#5b6170]/15 ${className}`}
      style={bodyFont}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id={headingId}
          className="text-[1.3rem] font-semibold"
          style={headingFont}
        >
          Cart
        </h2>
        {lines.length > 0 ? (
          <p className="text-[0.95rem] text-[#5b6170]">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </p>
        ) : null}
      </div>

      {lines.length === 0 ? (
        <p className="mt-3 text-[1.05rem] text-[#5b6170]">
          Your cart is empty.
        </p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-[#5b6170]/15">
            {lines.map(({ item, product }) => {
              const stockLabel = getStockLabel(product.stock);
              const lineTotal = product.price * item.quantity;

              return (
                <li key={product.id} className="flex gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[1.05rem] font-medium">
                      {product.name}
                    </h3>

                    {product.description ? (
                      <p className="mt-1 text-[0.95rem] text-[#5b6170]">
                        {product.description}
                      </p>
                    ) : null}

                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[0.95rem] text-[#5b6170]">
                      <span>Qty {item.quantity}</span>

                      {stockLabel ? <span>{stockLabel}</span> : null}

                      {product.rating &&
                      Number.isFinite(product.rating.value) ? (
                        <span>
                          Rating {product.rating.value.toFixed(1)}
                          {typeof product.rating.count === "number" &&
                          product.rating.count > 0
                            ? ` (${product.rating.count})`
                            : null}
                        </span>
                      ) : null}
                    </div>

                    {product.delivery ? (
                      <p className="mt-1 text-[0.95rem] text-[#5b6170]">
                        {product.delivery.label}
                        {product.delivery.estimate
                          ? ` · ${product.delivery.estimate}`
                          : null}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-col items-end gap-1 text-right">
                    <p className="text-[1.05rem] font-medium">
                      {formatMoney(lineTotal, product.currency)}
                    </p>

                    {item.quantity > 1 ? (
                      <p className="text-[0.95rem] text-[#5b6170]">
                        {formatMoney(product.price, product.currency)} each
                      </p>
                    ) : null}

                    {onRemove ? (
                      <button
                        type="button"
                        onClick={() => onRemove(product.id)}
                        className="rounded-md text-[0.95rem] font-medium text-[#5b6170] underline decoration-[#5b6170]/40 underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2346d8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#ffffff]"
                        aria-label={`Remove ${product.name} from cart`}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          <div
            className="mt-4 border-t border-[#5b6170]/15 pt-3"
            aria-live="polite"
          >
            {Object.entries(totals).map(([currency, total]) => (
              <div
                key={currency}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="text-[1.05rem]">Subtotal</span>
                <span className="text-[1.05rem] font-semibold">
                  {formatMoney(total, currency)}
                </span>
              </div>
            ))}
          </div>

          <a
            href={checkoutHref}
            className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#2346d8] px-4 py-3 text-[1.05rem] font-medium text-[#ffffff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2346d8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#ffffff]"
          >
            Checkout
          </a>
        </>
      )}
    </section>
  );
}
```

## Notes

- Accessibility: uses a labelled `<section>`, semantic heading levels, a real `<ul>/<li>` list, a real `<a>` for checkout, and a real `<button>` for remove. The remove button has an `aria-label` that includes the catalog product name. Focus styles are visible on interactive elements.
- The checkout link uses the caller-provided `checkoutHref`; reviewer should confirm it points to the live checkout route.
- Stock is shown as availability only and never as a count. This avoids scarcity messaging.
- Discounts are intentionally not rendered, even though the brief mentions them, because the hard rules ban discounts. The `discount` field is typed only to document that catalog data may exist. A human should resolve this conflict if discount display is required.
- Reviewer should check that catalog `delivery` text and `description` copy do not contain urgency, scarcity, countdown, or banned wording.
- Missing product IDs are skipped. Multiple currencies produce separate subtotal rows. Confirm both behaviours match the store’s cart expectations.
- No images, logos, brand marks, or hotlinked assets are used.
