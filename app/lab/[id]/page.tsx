// Lab control page for one synthetic shopper: run visit 1, close the site, see what was
// remembered, then open it again as visit 2 with the model's format or a forced variant.
import { notFound } from "next/navigation";
import { shoppers } from "@/data/shoppers";
import { LabHome } from "./LabHome";

export default async function Lab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = shoppers[id];
  if (!s || !s.revisit) notFound();
  return <LabHome id={s.id} label={s.label} start={s.startPath} revisitStart={s.revisit.startPath} partner={s.partner} />;
}
