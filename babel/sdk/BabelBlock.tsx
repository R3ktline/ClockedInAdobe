"use client";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import type { BlockId, Slide } from "@/babel/schema";
import { useBabel } from "./BabelProvider";

// Blocks reorder with CSS `order`, so they must share one parent. It is a two-column grid on wide
// screens: a block is full width unless its variant starts with `side_` (see sideBlocks).
export function BabelStack({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 gap-[var(--babel-gap)] md:grid-cols-2 ${className}`}>{children}</div>;
}

// Variants named `side_*` take half the width, so two of them in a row sit next to each other
// (e.g. the photos with the reviews). Consecutive side blocks pair up in order; an odd one out stays
// full width, so a lone side variant never leaves a hole.
function sideBlocks(blocks: Slide["blocks"]): Set<BlockId> {
  const out = new Set<BlockId>();
  let run: BlockId[] = [];
  const flush = () => { if (run.length % 2) run.pop(); run.forEach((id) => out.add(id)); run = []; };
  for (const b of [...blocks].sort((x, y) => x.order - y.order)) {
    if (b.variant.startsWith("side_") && !b.collapsed) run.push(b.id); else flush();
  }
  flush();
  return out;
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
      className={`babel-block ${sideBlocks(slide.blocks).has(id) ? "" : "md:col-span-2"}`}
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
