// Which of a product's reviews best summarise what buyers say (the model picks ids; the page shows the reviews).
import { z } from "zod";
import { pickReviews } from "@/babel/agents/reviews";
import { productById } from "@/data/catalog";
import { bad } from "../_store";

const Body = z.object({ productId: z.string().max(64) });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return bad(body.error.message);
  const product = productById(body.data.productId);
  if (!product) return bad("unknown product", 404);
  return Response.json(await pickReviews(product));
}
