// Demo mode: the clean view for presenting. ?demo=1 turns it on and the browser remembers it; ?demo=0 turns it off.
// On: no debug overlay (Ctrl+Shift+D still opens it), and Babel does not pop notices or unread dots over the page.
// The chat, the view controls (Why?, Standard view) and every change it makes stay available.
const KEY = "babel.demo";

/** Client only: call from an effect, never during render (it reads the URL and localStorage). */
export function readDemo(): boolean {
  const q = new URLSearchParams(location.search).get("demo");
  try {
    if (q === "1" || q === "0") localStorage.setItem(KEY, q);
    return (q ?? localStorage.getItem(KEY)) === "1";
  } catch {
    return q === "1"; // private mode: only the URL counts
  }
}
