// A2A JSON-RPC endpoint (SPEC §8). The SDK ships only an Express adapter, so this is the same wiring on Web Request/Response.
import { defaultServerCallContextBuilder, JsonRpcTransportHandler, UnauthenticatedUser } from "@a2a-js/sdk/server";
import { clientKey, rateLimited } from "@/babel/tools";
import { requestHandler } from "./_agent";

export const dynamic = "force-dynamic";

const rpcError = (id: unknown, code: number, message: string, status = 200) =>
  Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status });

export async function POST(req: Request) {
  if (rateLimited(`a2a:${clientKey(req)}`)) return rpcError(null, -32000, "Rate limited", 429);
  const body = await req.json().catch(() => undefined);
  if (!body || typeof body !== "object") return rpcError(null, -32700, "Parse error");
  const context = defaultServerCallContextBuilder({
    extensions: undefined,
    user: new UnauthenticatedUser(),
    headers: Object.fromEntries(req.headers),
    requestedVersion: req.headers.get("A2A-Version") ?? "1.0",
    tenant: undefined,
  });
  const out = await new JsonRpcTransportHandler(requestHandler(new URL(req.url).origin)).handle(body, context);
  // Streaming is off in the Agent Card, so a stream here is a client asking for it anyway.
  if (Symbol.asyncIterator in out) return rpcError((body as { id?: unknown }).id, -32004, "Streaming is not supported");
  return Response.json(out);
}
