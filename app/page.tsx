"use client";
// Start page: one click to every demo page, and the switch for the clean demo mode.
import Link from "next/link";
import { useEffect, useState } from "react";

// --- EVERY PAGE WORTH SHOWING ---
const AI_QUERY = "/taraba/ai?q=" + encodeURIComponent("o mașină de spălat silențioasă pentru un apartament mic, sub 2500 lei");
const LINKS: [group: string, links: [label: string, href: string, note: string][]][] = [
  ["Magazinul", [
    ["Taraba", "/taraba", "magazinul, adaptat de Babel"],
    ["Pagină construită de AI", AI_QUERY, "bara de căutare e un prompt"],
    ["Pagină de produs", "/taraba/p/home-wm-01", "pune o întrebare în chat, blocul se transformă"],
  ]],
  ["Cumpărători sintetici", [
    ["Radu", "/taraba/p/home-wm-01?ghost=radu", "mașină de spălat, sceptic la promoții"],
    ["Cristina", "/taraba/p/home-sofa-01?ghost=cristina", "canapea, livrare și retur"],
    ["Gheorghe", "/taraba/p/home-dw-01?ghost=gheorghe", "vrea garanția explicată clar"],
    ["Mihai", "/taraba/p/elec-lap-01?ghost=mihai", "caută după specificații"],
    ["Tudor", "/taraba/p/fash-dress-01?ghost=tudor", "vine de pe social, se uită la poze"],
    ["Cristina, a doua vizită", "/lab/cristina", "ce își amintește Babel"],
  ]],
  ["În culise", [
    ["Panoul comerciantului", "/merchant", "markeri, decizii, cost vs valoare"],
    ["Demo live", "/demo", "pas cu pas: comportament, markeri, schimbări"],
    ["Simulator", "/sim", "construiește un cumpărător"],
  ]],
];

// The demo switch writes the same key babel/sdk/demo.ts reads, so every store page opened after this is clean.
function PageLinks() {
  const [demo, setDemo] = useState(true);
  useEffect(() => {
    try { setDemo(localStorage.getItem("babel.demo") !== "0"); localStorage.setItem("babel.demo", localStorage.getItem("babel.demo") ?? "1"); } catch { /* private mode */ }
  }, []);
  const toggle = (on: boolean) => {
    setDemo(on);
    try { localStorage.setItem("babel.demo", on ? "1" : "0"); } catch { /* private mode */ }
  };
  return (
    <nav className="page-links" aria-label="Toate paginile">
      <label className="demo-switch">
        <input type="checkbox" checked={demo} onChange={(e) => toggle(e.target.checked)} />
        Mod demo curat <span>(fără debug, Babel vorbește doar când e întrebat)</span>
      </label>
      <div className="link-groups">
        {LINKS.map(([group, links]) => (
          <section key={group}>
            <h2>{group}</h2>
            <ul>
              {links.map(([label, href, note]) => (
                <li key={href}><a href={href}>{label}</a><span>{note}</span></li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}

export default function StartPage() {
  return (
    <main className="start">
      <h1>Babel</h1>
      <p>Stratul AI care recompune pagina magazinului pentru fiecare cumpărător.</p>
      <Link className="enter" href="/taraba">Intră în Taraba →</Link>
      <PageLinks />

      <style jsx global>{`
        html, body { margin: 0; min-height: 100%; background: #000; font-family: Arial, Helvetica, sans-serif; }
        .start {
          min-height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 12px; padding: 32px 16px; color: #fff; text-align: center;
        }
        .start h1 { margin: 0; font-size: 56px; letter-spacing: -0.02em; }
        .start > p { margin: 0 0 8px; color: rgba(255,255,255,0.7); }
        .enter {
          padding: 14px 28px; border-radius: 8px; background: #fff; color: #030303; font-weight: 700; text-decoration: none;
          transition: background 0.2s ease;
        }
        .enter:hover, .enter:focus-visible { background: #d7f477; }
        .page-links {
          margin-top: 20px; width: min(880px, 100%); padding: 20px;
          border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; background: #0a0a0a; text-align: left;
        }
        .demo-switch { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 14px; font-weight: 700; cursor: pointer; }
        .demo-switch span { font-weight: 400; color: rgba(255,255,255,0.6); }
        .demo-switch input { width: 16px; height: 16px; accent-color: #d7f477; }
        .link-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-top: 16px; }
        .link-groups h2 { margin: 0 0 8px; font-size: 12px; letter-spacing: 0.04em; color: #d7f477; }
        .link-groups ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
        .link-groups a { display: block; color: #fff; font-weight: 700; font-size: 15px; text-decoration: none; }
        .link-groups a:hover, .link-groups a:focus-visible { color: #d7f477; text-decoration: underline; }
        .link-groups li span { display: block; font-size: 12px; color: rgba(255,255,255,0.6); }
      `}</style>
    </main>
  );
}
