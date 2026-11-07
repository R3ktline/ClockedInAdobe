// Host glue: looks up a store's config and validates it once at the trust boundary.
import { BrandKit, Registry } from "@/babel/schema";
import { storeConfigs } from "@/stores";

const cache = new Map<string, { brand: BrandKit; registry: Registry }>();

export function storeConfig(id: string) {
  if (!(id in storeConfigs)) return undefined;
  if (!cache.has(id)) {
    const c = storeConfigs[id as keyof typeof storeConfigs];
    cache.set(id, { brand: BrandKit.parse(c.brand), registry: Registry.parse(c.registry) });
  }
  return cache.get(id)!;
}

export const bad = (message: string, status = 400) => Response.json({ error: message }, { status });
