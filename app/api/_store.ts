// Host glue: looks up a store's config and validates it once at the trust boundary.
// Stores built in this repo come from `stores/`; any other store is plain data in `data/stores/<id>.json`
// ({ brand, registry }), so a site that plugs in with the script tag (public/babel.js) needs no code here.
import { readFileSync } from "node:fs";
import path from "node:path";
import { BrandKit, Registry } from "@/babel/schema";
import { storeConfigs } from "@/stores";

const cache = new Map<string, { brand: BrandKit; registry: Registry }>();
const STORE_ID = /^[a-z0-9-]{1,32}$/; // the id comes from the request body and ends up in a file path

function fromData(id: string): { brand: unknown; registry: unknown } | undefined {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), "data", "stores", `${id}.json`), "utf8"));
  } catch { return undefined; }
}

export function storeConfig(id: string) {
  if (!STORE_ID.test(id)) return undefined;
  if (!cache.has(id)) {
    if (id in storeConfigs) {
      const c = storeConfigs[id as keyof typeof storeConfigs];
      cache.set(id, { brand: BrandKit.parse(c.brand), registry: Registry.parse(c.registry) });
    } else {
      const c = fromData(id);
      const brand = BrandKit.safeParse(c?.brand), registry = Registry.safeParse(c?.registry);
      if (!brand.success || !registry.success) return undefined; // a bad data file is an unknown store, not a crash
      cache.set(id, { brand: brand.data, registry: registry.data });
    }
  }
  return cache.get(id)!;
}

export const bad = (message: string, status = 400) => Response.json({ error: message }, { status });
