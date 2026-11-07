"use client";
// ePrivacy Art. 5(3) / GDPR: nothing is read, stored or inferred until the shopper says yes. Until then the store
// shows its standard page. Declining is as easy as accepting.
import { useBabel } from "./BabelProvider";

export function ConsentBanner() {
  const { answerConsent } = useBabel();
  return (
    <div role="dialog" aria-label="Adapt this store to you?" className="babel-ui fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-2xl rounded-xl bg-white p-4 text-[15px] text-[#14171f] shadow-2xl ring-1 ring-black/10">
      <p className="font-bold">Adapt this store to how you browse?</p>
      <p className="mt-1 text-[#3d4352]">
        Babel can lay out the next pages for how you use them (larger text, more detail, or bigger pictures), from what you click on this site only.
        Same products, same prices. It never uses your age or who you are. You can switch it off or make it forget you at any time.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => answerConsent(true)} className="rounded-lg bg-[#14171f] px-4 py-2 font-semibold text-white">Yes, adapt it</button>
        <button onClick={() => answerConsent(false)} className="rounded-lg border border-[#14171f] px-4 py-2 font-semibold">No, standard store</button>
      </div>
    </div>
  );
}
