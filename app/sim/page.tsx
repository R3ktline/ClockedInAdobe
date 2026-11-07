// Demo simulator: change anything Babel takes into account (store-shared context, consent, what it
// remembered, what the shopper does) and see the page it would build, then open the real store with it.
import { catalog } from "@/data/catalog";
import { shoppers } from "@/data/shoppers";
import { SimClient } from "./SimClient";

export default function Sim() {
  const products = catalog.map((p) => ({ id: p.id, name: p.name }));
  return <SimClient products={products} presets={Object.values(shoppers)} />;
}
