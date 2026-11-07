// The merchant's catalog, validated once at load. Synthetic demo data (SPEC §9).
import { Catalog } from "@/babel/schema";
import json from "./catalog.json";

export const catalog = Catalog.parse(json);
export const productById = (id: string) => catalog.find((p) => p.id === id);
