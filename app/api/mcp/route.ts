// MCP server over Streamable HTTP (SPEC §8), stateless: a fresh server per request, JSON responses.
// Claude / ChatGPT-style assistants connect here as a remote MCP server.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { callTool, clientKey, rateLimited, ToolError, tools } from "@/babel/tools";

export const dynamic = "force-dynamic";

function server() {
  const s = new McpServer({ name: "babel-taraba", version: "0.1.0" });
  for (const [name, t] of Object.entries(tools)) {
    s.registerTool(name, {
      description: t.description,
      inputSchema: t.input,
      annotations: { readOnlyHint: name !== "create_handoff_link", openWorldHint: false },
    }, async (args) => {
      try {
        return { content: [{ type: "text", text: JSON.stringify(callTool(name, args)) }] };
      } catch (e) {
        if (!(e instanceof ToolError)) throw e;
        return { content: [{ type: "text", text: e.message }], isError: true };
      }
    });
  }
  return s;
}

async function handle(req: Request) {
  if (rateLimited(`mcp:${clientKey(req)}`)) return Response.json({ error: "Rate limited" }, { status: 429 });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server().connect(transport);
  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
