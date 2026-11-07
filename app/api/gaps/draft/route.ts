// Offline codegen for a gap: asks the model to draft the missing variant as Markdown in drafts/variants/.
// The draft is never imported or run (AGENTS.md rule 1); a developer reviews it and adds it to the store's registry.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { chat } from "@/babel/llm";
import { getGap, markDrafted } from "@/babel/session/gaps";
import { bad, storeConfig } from "../../_store";

const Body = z.object({ id: z.string() });
const SYSTEM = readFileSync(path.join(process.cwd(), "prompts", "variant-drafter.md"), "utf8");

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return bad(body.error.message);
  const gap = getGap(body.data.id);
  const cfg = gap && storeConfig(gap.store);
  if (!gap || !cfg) return bad("unknown gap", 404);

  const input = JSON.stringify({
    store: gap.store, template: gap.template, block: gap.block, wanted: gap.wanted, why: gap.why,
    blockSpec: cfg.registry[gap.template]?.[gap.block], brandKit: cfg.brand,
  }, null, 1);
  try {
    const msg = await chat({
      agent: "variant-drafter",
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: `<data>\n${input}\n</data>` }],
      mock: () => ({ role: "assistant", refusal: null, content: `## Registry entry\n(mock LLM: no draft written)\n\nWanted: ${gap.wanted}\n` }),
    });
    const file = path.join("drafts", "variants", `${gap.store}-${gap.block}-${gap.id}.md`);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `<!-- gap ${gap.id}: ${gap.wanted} -->\n\n${msg.content ?? ""}\n`);
    markDrafted(gap.id, file);
    return Response.json({ file });
  } catch (e) {
    return bad(`draft failed: ${e instanceof Error ? e.message : e}`, 502);
  }
}
