// A2A JSON-RPC endpoint (SPEC §8). The SDK ships only an Express adapter, so this is the same wiring on Web Request/Response.
// Clients that send no A2A-Version header speak v0.3 (`message/send`, `kind` parts) and get the SDK's legacy handler.
import { defaultServerCallContextBuilder, JsonRpcTransportHandler, UnauthenticatedUser } from "@a2a-js/sdk/server";
import { LegacyJsonRpcTransportHandler } from "@a2a-js/sdk/compat/v0_3/server";
import { clientKey, rateLimited } from "@/babel/tools";
import { requestHandler } from "./_agent";

export const dynamic = "force-dynamic";

const rpcError = (id: unknown, code: number, message: string, status = 200) =>
  Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status });

export async function POST(req: Request) {
  if (rateLimited(`a2a:${clientKey(req)}`)) return rpcError(null, -32000, "Rate limited", 429);
  const body = await req.json().catch(() => undefined);
  if (!body || typeof body !== "object") return rpcError(null, -32700, "Parse error");
  const version = req.headers.get("A2A-Version") ?? "0.3";
  const context = defaultServerCallContextBuilder({
    extensions: undefined,
    user: new UnauthenticatedUser(),
    headers: Object.fromEntries(req.headers),
    requestedVersion: version,
    tenant: undefined,
  });
  const handler = requestHandler(new URL(req.url).origin);
  const transport = version === "0.3" ? new LegacyJsonRpcTransportHandler(handler) : new JsonRpcTransportHandler(handler);
  const out = await transport.handle(body, context);
  // Streaming is off in the Agent Card, so a stream here is a client asking for it anyway.
  if (Symbol.asyncIterator in out) return rpcError((body as { id?: unknown }).id, -32004, "Streaming is not supported");
  return Response.json(out);
}
