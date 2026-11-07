// Babel's public API for stores. Code in stores/* imports only from here (SPEC §7.1).
export { BabelProvider, useBabel, type BabelProviderProps } from "./BabelProvider";
export { BabelBlock, BabelStack } from "./BabelBlock";
export type {
  BlockId, BrandKit, Category, CopyRegister, InteractionEvent, PartnerContext, Product, Registry, Template,
} from "@/babel/schema";
