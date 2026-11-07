// Interpret first, then check. When a shopper types a request, the Director lists each wish in it (Understood),
// and this module holds that list against what the slide really does. The reply the shopper reads is built from
// the checked list, not from the model's free text, so it can never claim more than the page did.
import { changedBlocks } from "@/babel/schema/diff";
import type { Registry, Slide, SlideProposal, Understood } from "@/babel/schema";
import { translate } from "@/lib/i18n/dictionaries";
import { DEFAULT_LANG, type Lang } from "@/lib/i18n/locales";

type Check = {
  understood?: Understood;
  prev: Slide;
  registry: Registry;
  proposal?: SlideProposal; // present when the model proposed a slide
  slide?: Slide;            // that slide, assembled and validated
};

// Errors in the model's own words, sent back to it so it can repair its answer. Empty = consistent.
export function checkUnderstood({ understood, prev, registry, proposal, slide }: Check): string[] {
  if (!understood?.length) return ["List each separate thing the shopper asked for in `understood`: status do, already or cannot."];
  const errors: string[] = [];
  const declared = registry[prev.template] ?? {};
  const now = (block: string) => prev.blocks.find((b) => b.id === block)?.variant;
  const after = (block: string) => slide?.blocks.find((b) => b.id === block)?.variant;
  const covered = new Set<string>();

  for (const part of understood) {
    const name = `"${part.wanted}"`;
    for (const s of part.sets ?? []) {
      const spec = declared[s.block];
      if (!spec) errors.push(`${name}: block "${s.block}" is not on this page.`);
      else if (!spec.variants.includes(s.variant)) errors.push(`${name}: block "${s.block}" has no variant "${s.variant}" (allowed: ${spec.variants.join(", ")}).`);
    }
    if (part.status === "cannot" && !part.how) errors.push(`${name} is marked cannot: say why in \`how\`.`);
    if (part.status === "already") {
      if (!part.sets?.length) errors.push(`${name} is marked already: name the block and variant that make it true in \`sets\`.`);
      for (const s of part.sets ?? []) if (now(s.block) !== s.variant) errors.push(`${name} is marked already, but ${s.block} is "${now(s.block)}" now, not "${s.variant}".`);
    }
    if (part.status === "do") {
      if (!slide) { errors.push(`${name} is marked do, but you held. Propose the slide, or mark it cannot.`); continue; }
      for (const s of part.sets ?? []) {
        covered.add(s.block);
        if (after(s.block) !== s.variant) errors.push(`${name} is marked do, but in your slide ${s.block} is "${after(s.block)}", not "${s.variant}".`);
      }
      const otherLever = !!proposal && (!!proposal.theme || !!proposal.copyRegister || !!proposal.dialect || !!proposal.need || !!proposal.skin);
      if (!part.sets?.length && !otherLever) errors.push(`${name} is marked do, but nothing in your slide does it.`);
    }
  }

  if (slide && proposal) {
    if (!understood.some((p) => p.status === "do")) errors.push("Your slide changes the page but no part is marked do. If nothing can be done, call hold.");
    // Only what was asked: without a new look or need, every changed block must belong to a wish.
    const lookChange = (proposal.dialect && proposal.dialect !== prev.persona.dialect) || !!proposal.need;
    if (!lookChange) {
      const extra = changedBlocks(prev.blocks, slide.blocks).filter((id) => !covered.has(id));
      if (extra.length) errors.push(`Your slide also changes ${extra.join(", ")}, which the shopper did not ask for. Leave ${extra.length === 1 ? "it" : "them"} as ${extra.length === 1 ? "it is" : "they are"}.`);
    }
  }
  return errors;
}

// What the shopper reads. Built from the checked list.
export function replyFrom(understood: Understood | undefined, lang: Lang = DEFAULT_LANG): string {
  if (!understood?.length) return translate(lang, "reply.none");
  const say = (p: Understood[number]) => (p.how ? `${p.wanted} (${p.how})` : p.wanted);
  const of = (s: Understood[number]["status"]) => understood.filter((p) => p.status === s).map(say);
  const [done, already, cannot] = [of("do"), of("already"), of("cannot")];
  return [
    done.length ? translate(lang, "reply.done", { items: done.join("; ") }) : "",
    already.length ? translate(lang, "reply.already", { items: already.join("; ") }) : "",
    cannot.length ? translate(lang, "reply.cannot", { items: cannot.join("; ") }) : "",
  ].filter(Boolean).join(" ");
}
