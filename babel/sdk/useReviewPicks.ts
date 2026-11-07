"use client";
// Optional shopper action: ask the Babel agent which reviews best summarise what buyers say.
// Returns indexes into the product's own reviews; the store renders them, nothing is generated.
import { useCallback, useState } from "react";

export function useReviewPicks(productId: string) {
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "error"; indexes: number[]; mocked: boolean }>({ status: "idle", indexes: [], mocked: false });
  const ask = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading" }));
    try {
      const r = await fetch("/api/reviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId }) });
      const j = await r.json() as { indexes?: number[]; mocked?: boolean };
      if (!r.ok || !j.indexes) throw new Error("no picks");
      setState({ status: "done", indexes: j.indexes, mocked: !!j.mocked });
    } catch {
      setState({ status: "error", indexes: [], mocked: false });
    }
  }, [productId]);
  return { ...state, ask };
}
