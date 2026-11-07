"use client";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import type { BlockId } from "@/babel/schema";
import { useBabel } from "./BabelProvider";

// Blocks reorder with CSS `order`, so they must share one flex parent.
export function BabelStack({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-[var(--babel-gap)] ${className}`}>{children}</div>;
}

// A store wraps each adaptable section in this and hands over every variant it declared.
// Babel only ever chooses which one shows, where, and whether it is collapsed.
export function BabelBlock({ id, variants }: { id: BlockId; variants: Record<string, ReactNode> }) {
  const { slide, registry, template, changed, track } = useBabel();
  const declared = registry[template] ?? {};
  const spec = declared[id];
  if (!spec) return null;
  const b = slide.blocks.find((x) => x.id === id);
  const variant = b?.variant ?? spec.neutral;
  if (variant === "hidden") return null;
  const content = variants[variant] ?? variants[spec.neutral];
  const order = b?.order ?? Object.keys(declared).indexOf(id) + 1;

  return (
    <motion.section
      layout
      transition={{ layout: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] } }}
      data-babel-block={id}
      data-babel-changed={changed.has(id) || undefined}
      style={{ order }}
      className="babel-block"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${variant}-${!!b?.collapsed}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {b?.collapsed ? (
            <details onToggle={(e) => e.currentTarget.open && track("block_open", { blockId: id })}>
              <summary className="cursor-pointer py-2 font-semibold">{spec.label}</summary>
              {content}
            </details>
          ) : content}
        </motion.div>
      </AnimatePresence>
    </motion.section>
  );
}
