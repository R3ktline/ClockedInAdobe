"use client";
// Optional shopper action: ask the Babel agent to summarise the reviews. Returns a short model-written summary
// (validated server-side) and indexes into the product's own reviews, which the store renders verbatim.
import { useCallback, useState } from "react";

export function useReviewPicks(productId: string) {
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "error"; indexes: number[]; summary?: string; mocked: boolean }>({ status: "idle", indexes: [], mocked: false });
  const ask = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading" }));
    try {
      const r = await fetch("/api/reviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId }) });
      const j = await r.json() as { indexes?: number[]; summary?: string; mocked?: boolean };
      if (!r.ok || !j.indexes) throw new Error("no picks");
      setState({ status: "done", indexes: j.indexes, summary: j.summary, mocked: !!j.mocked });
    } catch {
      setState({ status: "error", indexes: [], mocked: false });
    }
  }, [productId]);
  return { ...state, ask };
}
