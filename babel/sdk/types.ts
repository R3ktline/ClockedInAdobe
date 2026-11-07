// What the host page hands the provider: the view computed on the server for this page, before first paint.
import type { InteractionEvent, Template, View } from "@/babel/schema";

export type Consent = "yes" | "no" | "unset" | "ghost";

export type GhostScript = {
  id: string;
  label: string;
  events: InteractionEvent[];
  step: number;
  visit: 1 | 2;
  next?: string; // where the ghost walks on to after its events and the agent's answer
};

export type Initial = {
  store: string;
  template: Template;
  productId?: string;
  visitId: string;
  pageId: string;
  view: View;
  why: string[];
  changes: string[];
  consent: Consent;
  ghost?: GhostScript;
  llm: { mocked: boolean; model: string };
};
