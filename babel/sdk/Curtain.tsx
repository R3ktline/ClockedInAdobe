"use client";
// The glass curtain (curtain mode): a pane of blurred glass over the store while Babel makes a big change.
// The page behind stays visible but out of focus; the new page appears when the glass lifts.
//   in    glass comes down            hold  waiting for the change     done  says what happened
//   out   glass lifts                 off   not shown
// `quiet` = no card, only the glass: used to hide the first paint of a returning shopper until their own
// page is ready, so a remembered shopper never sees the neutral page flash by.
export type CurtainState = { phase: "off" | "in" | "hold" | "done" | "out"; text: string; sub: string; quiet: boolean };

export const CURTAIN_OFF: CurtainState = { phase: "off", text: "", sub: "", quiet: false };

export function Curtain({ state }: { state: CurtainState }) {
  const shown = state.phase === "in" || state.phase === "hold" || state.phase === "done";
  return (
    <>
      {/* Always mounted, so screen readers announce the text when it changes. */}
      <div className="sr-only" role="status" aria-live="polite">{state.quiet ? "" : state.text}</div>
      <div className="babel-curtain" data-phase={state.phase} data-quiet={state.quiet || undefined} aria-hidden="true">
        {!state.quiet && state.text && (
          <div className="babel-curtain__card" data-shown={shown || undefined}>
            {state.phase !== "done" && <span className="babel-curtain__ring" />}
            <p className="babel-curtain__title">{state.text}</p>
            {state.sub && <p className="babel-curtain__sub">{state.sub}</p>}
          </div>
        )}
      </div>
    </>
  );
}
