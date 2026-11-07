// Server-safe store configs (brand kit + registry). Validated once at the trust boundary (app/api/_store.ts).
import { taraba } from "./taraba/config";

export const storeConfigs = { taraba } as const;
export type StoreId = keyof typeof storeConfigs;
