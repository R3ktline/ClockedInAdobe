"use client";
// A store wraps each section of its page in <BabelBlock id="specs" variants={{ table_key: …, table_full: … }} />.
// Babel picks which variant shows, where (order) and whether it is folded away. It never renders anything else.
import { Children, isValidElement, type ReactNode } from "react";
import type { BlockId } from "@/babel/schema";
import { useBabel } from "./BabelProvider";

/** Lays blocks out in the view's order. DOM order follows the visual order, so screen readers and the keyboard
 *  meet the blocks in the same sequence as the eye (WCAG 1.3.2). */
export function BabelStack({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { view } = useBabel();
  const orderOf = (n: ReactNode) => {
    const id = isValidElement<{ id?: BlockId }>(n) ? n.props.id : undefined;
    return view.blocks.find((b) => b.id === id)?.order ?? 99;
  };
  const sorted = Children.toArray(children).sort((a, b) => orderOf(a) - orderOf(b));
  return <div className={`flex flex-col gap-[var(--babel-gap)] ${className}`}>{sorted}</div>;
}

export function BabelBlock({ id, variants }: { id: BlockId; variants: Record<string, ReactNode> }) {
  const { view, registry, template, changed, track } = useBabel();
  const b = view.blocks.find((x) => x.id === id);
  if (!b || b.variant === "hidden") return null;
  const body = variants[b.variant] ?? variants[registry[template]?.[id]?.neutral ?? ""] ?? null;
  if (!body) return null;
  const label = registry[template]?.[id]?.label ?? id;
  return (
    <section
      data-babel-block={id}
      data-babel-variant={b.variant}
      data-babel-changed={changed.has(id) || undefined}
      aria-label={label}
      className="babel-block"
    >
      {b.collapsed ? (
        <details onToggle={(e) => e.currentTarget.open && track("block_open", { blockId: id })}>
          <summary data-ghost="block_open" className="cursor-pointer py-1 text-lg font-semibold text-[var(--c-primary)]">Show {label.toLowerCase()}</summary>
          <div className="mt-3">{body}</div>
        </details>
      ) : body}
    </section>
  );
}
