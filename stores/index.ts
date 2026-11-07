// Server-safe store configs (brand kit + registry). Page components live in stores/pages.ts.
import { taraba } from "./taraba/config";

export const storeConfigs = { taraba } as const;
export type StoreId = keyof typeof storeConfigs;
