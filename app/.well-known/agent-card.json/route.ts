// A2A Agent Card discovery (SPEC §8). Built from the request origin, since the card needs absolute URLs.
import { agentCard } from "@/app/api/a2a/_agent";

export const dynamic = "force-dynamic";

export const GET = (req: Request) => Response.json(agentCard(new URL(req.url).origin));
