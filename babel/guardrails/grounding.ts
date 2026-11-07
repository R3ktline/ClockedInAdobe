// Grounding (GUARDRAILS §1 layer 10): numbers in a chat reply must come from the tool results the model was
// given. A reply that states a price, a spec or a policy the catalog did not return is not shown.

const NUMBER = /\d+(?:[.,]\d+)?/g;

function numbersIn(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === "number") out.add(String(value));
  else if (typeof value === "string") for (const m of value.match(NUMBER) ?? []) out.add(m.replace(",", "."));
  else if (Array.isArray(value)) value.forEach((v) => numbersIn(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => numbersIn(v, out));
  return out;
}

export function checkGrounding(reply: string, toolResults: unknown[]): string[] {
  const known = numbersIn(toolResults);
  const errors: string[] = [];
  for (const raw of reply.match(NUMBER) ?? []) {
    const n = raw.replace(",", ".");
    // Small counting words ("2 options", "1 click") are allowed; everything else must be in the data.
    if (Number(n) <= 3 && !/[.,]/.test(raw)) continue;
    if (!known.has(n) && !known.has(String(Number(n)))) errors.push(`"${raw}" is not in the catalog data I was given`);
  }
  if (/\b(lei|ron)\b/i.test(reply) && toolResults.length === 0) errors.push("a price was mentioned without any catalog lookup");
  return errors;
}
