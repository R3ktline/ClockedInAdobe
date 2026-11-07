// Taraba's product pictures: original flat illustrations drawn in code (no photos, no brand assets,
// nothing hotlinked). One glyph per kind of product, coloured per product. Labelled "Illustration".
import type { ReactNode } from "react";
import type { Category, Product } from "@/babel/sdk";

const HUE: Record<Category, number> = { electronics: 225, fashion: 335, home: 150, groceries: 38, toys: 18, health_beauty: 262 };

type Kind =
  | "drum" | "tall" | "disc" | "machine" | "sofa" | "bed" | "chair" | "laptop" | "headphones" | "screen" | "tablet"
  | "phone" | "watch" | "speaker" | "router" | "ereader" | "shoe" | "boot" | "jacket" | "dress" | "jeans" | "bag"
  | "jar" | "bottle" | "sack" | "box" | "bar" | "tube" | "pills" | "brush" | "dryer" | "scale" | "blocks" | "scooter"
  | "bike" | "board" | "puzzle" | "palette" | "flask" | "car" | "plush" | "kitchen";

const KIND: Record<string, Kind> = {
  wm: "drum", dw: "drum", fridge: "tall", robot: "disc", airfryer: "machine", espresso: "machine", sofa: "sofa",
  mattress: "bed", chair: "chair", lap: "laptop", hp: "headphones", mon: "screen", tv: "screen", tab: "tablet",
  phone: "phone", watch: "watch", spk: "speaker", router: "router", ereader: "ereader", snk: "shoe", boot: "boot",
  kboot: "boot", jkt: "jacket", coat: "jacket", sweat: "jacket", tee: "jacket", dress: "dress", jeans: "jeans",
  pack: "bag", honey: "jar", nuts: "jar", olive: "bottle", water: "bottle", shampoo: "bottle", coffee: "sack",
  rice: "sack", oats: "sack", pasta: "box", tea: "box", choc: "bar", cream: "tube", spf: "tube", lip: "tube",
  vit: "pills", mag: "pills", tooth: "brush", shaver: "brush", dryer: "dryer", scale: "scale", blocks: "blocks",
  scooter: "scooter", bike: "bike", game: "board", puzzle: "puzzle", art: "palette", sci: "flask", rc: "car",
  plush: "plush", kitchen: "kitchen",
};

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function palette(p: Product) {
  const h = (HUE[p.category] + (hash(p.id) % 41) - 20 + 360) % 360;
  return {
    dark: `hsl(${h} 42% 26%)`, mid: `hsl(${h} 52% 52%)`, light: `hsl(${h} 70% 88%)`,
    bgA: `hsl(${h} 80% 95%)`, bgB: `hsl(${(h + 28) % 360} 70% 88%)`, white: "#fff",
  };
}

type C = ReturnType<typeof palette>;

function Glyph({ kind, c }: { kind: Kind; c: C }): ReactNode {
  const { dark, mid, light, white } = c;
  switch (kind) {
    case "drum": return <><rect x="22" y="12" width="76" height="96" rx="8" fill={mid} /><rect x="22" y="12" width="76" height="20" rx="8" fill={dark} /><circle cx="34" cy="22" r="3" fill={white} /><rect x="70" y="19" width="20" height="6" rx="3" fill={light} /><circle cx="60" cy="70" r="27" fill={white} /><circle cx="60" cy="70" r="20" fill={light} /><circle cx="60" cy="70" r="10" fill={mid} opacity=".5" /></>;
    case "tall": return <><rect x="34" y="8" width="52" height="104" rx="6" fill={mid} /><rect x="34" y="44" width="52" height="3" fill={dark} /><rect x="76" y="18" width="3" height="20" rx="1.5" fill={white} /><rect x="76" y="54" width="3" height="34" rx="1.5" fill={white} /><rect x="40" y="14" width="28" height="4" rx="2" fill={light} opacity=".7" /></>;
    case "disc": return <><circle cx="60" cy="62" r="42" fill={dark} /><circle cx="60" cy="62" r="34" fill={mid} /><circle cx="60" cy="62" r="11" fill={light} /><circle cx="60" cy="62" r="4" fill={dark} /><rect x="44" y="26" width="32" height="6" rx="3" fill={light} /><circle cx="92" cy="86" r="5" fill={light} /></>;
    case "machine": return <><rect x="26" y="30" width="68" height="72" rx="14" fill={mid} /><rect x="26" y="20" width="68" height="26" rx="12" fill={dark} /><circle cx="60" cy="72" r="17" fill={light} /><circle cx="60" cy="72" r="8" fill={white} opacity=".7" /><rect x="94" y="56" width="14" height="14" rx="6" fill={dark} /><circle cx="44" cy="33" r="3" fill={light} /></>;
    case "sofa": return <><rect x="20" y="30" width="80" height="44" rx="14" fill={mid} /><rect x="8" y="52" width="22" height="42" rx="10" fill={dark} /><rect x="90" y="52" width="22" height="42" rx="10" fill={dark} /><rect x="24" y="58" width="72" height="30" rx="10" fill={light} /><rect x="30" y="94" width="6" height="10" rx="2" fill={dark} /><rect x="84" y="94" width="6" height="10" rx="2" fill={dark} /></>;
    case "bed": return <><rect x="8" y="30" width="8" height="64" rx="3" fill={dark} /><rect x="14" y="56" width="98" height="30" rx="8" fill={light} /><rect x="14" y="56" width="98" height="10" rx="5" fill={mid} /><rect x="22" y="44" width="30" height="16" rx="8" fill={white} /><rect x="104" y="86" width="8" height="12" rx="2" fill={dark} /></>;
    case "chair": return <><rect x="36" y="12" width="48" height="50" rx="14" fill={mid} /><rect x="30" y="62" width="60" height="14" rx="7" fill={dark} /><rect x="57" y="76" width="6" height="20" fill={dark} /><path d="M28 102 H92" stroke={dark} strokeWidth="6" strokeLinecap="round" /><circle cx="30" cy="108" r="4" fill={mid} /><circle cx="90" cy="108" r="4" fill={mid} /><circle cx="60" cy="108" r="4" fill={mid} /></>;
    case "laptop": return <><rect x="24" y="22" width="72" height="52" rx="5" fill={dark} /><rect x="29" y="27" width="62" height="42" rx="2" fill={light} /><path d="M10 78 H110 L104 90 H16Z" fill={mid} /><rect x="50" y="78" width="20" height="3" rx="1.5" fill={dark} opacity=".5" /></>;
    case "headphones": return <><path d="M28 74 A32 32 0 0 1 92 74" fill="none" stroke={dark} strokeWidth="8" strokeLinecap="round" /><rect x="18" y="62" width="22" height="38" rx="10" fill={mid} /><rect x="80" y="62" width="22" height="38" rx="10" fill={mid} /><rect x="22" y="68" width="8" height="26" rx="4" fill={light} /><rect x="90" y="68" width="8" height="26" rx="4" fill={light} /></>;
    case "screen": return <><rect x="8" y="20" width="104" height="66" rx="5" fill={dark} /><rect x="13" y="25" width="94" height="56" rx="2" fill={light} /><path d="M20 72 L44 48 L62 64 L78 44 L100 70Z" fill={mid} opacity=".6" /><rect x="54" y="86" width="12" height="12" fill={mid} /><rect x="38" y="98" width="44" height="6" rx="3" fill={mid} /></>;
    case "tablet": return <><rect x="26" y="10" width="68" height="100" rx="9" fill={dark} /><rect x="32" y="18" width="56" height="84" rx="3" fill={light} /><circle cx="60" cy="14" r="1.8" fill={light} /><rect x="38" y="30" width="44" height="26" rx="4" fill={mid} opacity=".7" /><rect x="38" y="64" width="30" height="5" rx="2.5" fill={mid} /><rect x="38" y="75" width="40" height="5" rx="2.5" fill={mid} opacity=".6" /></>;
    case "phone": return <><rect x="38" y="8" width="44" height="104" rx="10" fill={dark} /><rect x="43" y="17" width="34" height="86" rx="4" fill={light} /><rect x="52" y="12" width="16" height="3" rx="1.5" fill={mid} /><circle cx="60" cy="48" r="14" fill={mid} opacity=".7" /><rect x="48" y="72" width="24" height="5" rx="2.5" fill={mid} /></>;
    case "watch": return <><rect x="44" y="6" width="32" height="108" rx="10" fill={mid} /><rect x="33" y="34" width="54" height="52" rx="15" fill={dark} /><rect x="38" y="39" width="44" height="42" rx="11" fill={light} /><path d="M60 50 V62 L68 68" stroke={dark} strokeWidth="3.5" fill="none" strokeLinecap="round" /><rect x="87" y="52" width="4" height="12" rx="2" fill={dark} /></>;
    case "speaker": return <><path d="M42 26 A18 18 0 0 1 78 26" fill="none" stroke={dark} strokeWidth="5" strokeLinecap="round" /><rect x="32" y="26" width="56" height="80" rx="18" fill={dark} /><circle cx="60" cy="52" r="14" fill={mid} /><circle cx="60" cy="52" r="5" fill={dark} /><circle cx="60" cy="84" r="9" fill={mid} /></>;
    case "router": return <><rect x="20" y="34" width="34" height="68" rx="8" fill={white} stroke={mid} strokeWidth="3" /><rect x="66" y="34" width="34" height="68" rx="8" fill={white} stroke={mid} strokeWidth="3" /><circle cx="37" cy="46" r="4" fill={mid} /><circle cx="83" cy="46" r="4" fill={mid} /><path d="M37 60 H37 M83 60 H83" stroke={dark} /><path d="M30 78 H44 M76 78 H90 M30 86 H44 M76 86 H90" stroke={light} strokeWidth="3" strokeLinecap="round" /><path d="M42 20 Q60 6 78 20" fill="none" stroke={dark} strokeWidth="4" strokeLinecap="round" /></>;
    case "ereader": return <><rect x="28" y="8" width="64" height="104" rx="8" fill={dark} /><rect x="34" y="14" width="52" height="82" rx="2" fill={light} /><path d="M40 28 H80 M40 38 H80 M40 48 H72 M40 58 H80 M40 68 H66" stroke={mid} strokeWidth="3" strokeLinecap="round" /><rect x="52" y="102" width="16" height="3" rx="1.5" fill={mid} /></>;
    case "shoe": return <><path d="M10 80 L12 56 Q38 56 50 40 L62 50 Q88 52 110 72 V84 H10Z" fill={mid} /><rect x="8" y="80" width="104" height="12" rx="6" fill={dark} /><path d="M50 40 L62 50 M56 48 L66 56 M62 54 L72 60" stroke={light} strokeWidth="3" strokeLinecap="round" /><path d="M10 80 H112" stroke={light} strokeWidth="2" /></>;
    case "boot": return <><path d="M34 10 H62 V50 Q90 54 108 72 V88 H22 V30Z" fill={mid} /><rect x="20" y="86" width="90" height="14" rx="6" fill={dark} /><rect x="34" y="10" width="28" height="12" rx="3" fill={dark} /><path d="M38 28 H58 M38 38 H58 M44 48 H62" stroke={light} strokeWidth="3" strokeLinecap="round" /></>;
    case "jacket": return <><path d="M42 12 L20 26 L8 62 L24 68 L32 48 V106 H88 V48 L96 68 L112 62 L100 26 L78 12 Q60 30 42 12Z" fill={mid} /><path d="M60 30 V106" stroke={dark} strokeWidth="3" /><path d="M42 12 Q60 30 78 12" fill="none" stroke={dark} strokeWidth="4" /><rect x="38" y="76" width="16" height="4" rx="2" fill={light} /><rect x="66" y="76" width="16" height="4" rx="2" fill={light} /></>;
    case "dress": return <><path d="M44 10 H76 L72 44 L100 108 H20 L48 44Z" fill={mid} /><path d="M48 44 H72" stroke={dark} strokeWidth="5" /><path d="M44 10 Q60 28 76 10" fill="none" stroke={dark} strokeWidth="4" /><path d="M36 84 Q60 94 84 84" fill="none" stroke={light} strokeWidth="3" /></>;
    case "jeans": return <><path d="M32 8 H88 L98 112 H68 L60 46 L52 112 H22Z" fill={mid} /><rect x="32" y="8" width="56" height="12" fill={dark} /><path d="M60 20 V46" stroke={dark} strokeWidth="2" /><path d="M40 28 q6 4 12 0 M68 28 q6 4 12 0" stroke={light} strokeWidth="2.5" fill="none" /></>;
    case "bag": return <><path d="M44 28 V20 Q60 8 76 20 V28" fill="none" stroke={dark} strokeWidth="6" /><rect x="28" y="24" width="64" height="86" rx="22" fill={mid} /><rect x="38" y="64" width="44" height="34" rx="9" fill={dark} /><path d="M38 42 H82" stroke={light} strokeWidth="3" strokeLinecap="round" /><rect x="54" y="74" width="12" height="4" rx="2" fill={light} /></>;
    case "jar": return <><rect x="36" y="22" width="48" height="14" rx="4" fill={dark} /><rect x="30" y="34" width="60" height="72" rx="14" fill={light} stroke={mid} strokeWidth="3" /><rect x="36" y="56" width="48" height="30" rx="4" fill={mid} /><circle cx="60" cy="71" r="7" fill={light} /></>;
    case "bottle": return <><rect x="52" y="8" width="16" height="12" rx="3" fill={dark} /><path d="M54 20 H66 V32 Q82 40 82 58 V100 Q82 110 72 110 H48 Q38 110 38 100 V58 Q38 40 54 32Z" fill={mid} /><rect x="38" y="62" width="44" height="30" fill={white} opacity=".85" /><circle cx="60" cy="77" r="7" fill={mid} /></>;
    case "sack": return <><path d="M32 16 H88 L92 108 H28Z" fill={mid} /><path d="M32 16 L38 8 L44 16 L50 8 L56 16 L62 8 L68 16 L74 8 L80 16 L86 8 L88 16" fill={dark} stroke={dark} /><rect x="38" y="44" width="44" height="42" rx="5" fill={white} opacity=".9" /><circle cx="60" cy="65" r="11" fill={light} /><path d="M54 65 H66" stroke={dark} strokeWidth="3" strokeLinecap="round" /></>;
    case "box": return <><rect x="32" y="14" width="56" height="94" rx="5" fill={mid} /><rect x="32" y="14" width="56" height="12" rx="5" fill={dark} /><rect x="38" y="40" width="44" height="40" rx="4" fill={white} opacity=".9" /><circle cx="60" cy="60" r="10" fill={light} /><rect x="42" y="90" width="36" height="5" rx="2.5" fill={light} /></>;
    case "bar": return <><rect x="22" y="30" width="76" height="62" rx="6" fill={dark} /><path d="M41 30 V92 M60 30 V92 M79 30 V92 M22 51 H98 M22 71 H98" stroke={mid} strokeWidth="2.5" /><path d="M22 30 L34 18 H98 L98 30Z" fill={light} /><path d="M22 92 H98" stroke={mid} strokeWidth="2" /></>;
    case "tube": return <><rect x="40" y="12" width="40" height="22" rx="4" fill={dark} /><path d="M38 34 H82 L78 100 H42Z" fill={mid} /><rect x="42" y="98" width="36" height="12" rx="3" fill={dark} /><rect x="46" y="52" width="28" height="22" rx="4" fill={white} opacity=".9" /><circle cx="60" cy="63" r="6" fill={light} /></>;
    case "pills": return <><rect x="36" y="18" width="48" height="22" rx="6" fill={dark} /><rect x="32" y="38" width="56" height="66" rx="12" fill={mid} /><rect x="38" y="56" width="44" height="30" rx="4" fill={white} opacity=".9" /><circle cx="60" cy="71" r="8" fill={light} /><rect x="92" y="86" width="22" height="9" rx="4.5" fill={light} transform="rotate(-24 103 90)" /></>;
    case "brush": return <><rect x="46" y="8" width="28" height="38" rx="14" fill={dark} /><rect x="50" y="12" width="20" height="14" rx="6" fill={light} /><rect x="50" y="44" width="20" height="68" rx="10" fill={mid} /><circle cx="60" cy="62" r="4" fill={light} /></>;
    case "dryer": return <><rect x="16" y="26" width="70" height="34" rx="17" fill={mid} /><rect x="76" y="32" width="20" height="22" rx="6" fill={dark} /><rect x="40" y="54" width="20" height="54" rx="9" fill={dark} /><rect x="24" y="36" width="36" height="6" rx="3" fill={light} /></>;
    case "scale": return <><rect x="16" y="20" width="88" height="80" rx="18" fill={light} stroke={mid} strokeWidth="3" /><rect x="40" y="30" width="40" height="16" rx="4" fill={dark} /><rect x="44" y="34" width="12" height="8" rx="1.5" fill={light} /><circle cx="42" cy="78" r="9" fill={mid} opacity=".6" /><circle cx="78" cy="78" r="9" fill={mid} opacity=".6" /></>;
    case "blocks": return <><rect x="14" y="68" width="40" height="36" rx="4" fill={mid} /><rect x="58" y="68" width="40" height="36" rx="4" fill={dark} /><rect x="36" y="30" width="40" height="36" rx="4" fill={light} stroke={mid} strokeWidth="3" />{[26, 38, 70, 82, 46, 62].map((x, i) => <circle key={x} cx={x} cy={i < 2 ? 66 : i < 4 ? 66 : 28} r="3.5" fill={i < 2 ? mid : i < 4 ? dark : light} />)}</>;
    case "scooter": return <><path d="M92 92 L82 18 H98" stroke={dark} strokeWidth="6" fill="none" strokeLinecap="round" /><rect x="22" y="86" width="74" height="9" rx="4.5" fill={mid} /><circle cx="26" cy="102" r="9" fill={dark} /><circle cx="94" cy="102" r="9" fill={dark} /><circle cx="26" cy="102" r="3" fill={light} /><circle cx="94" cy="102" r="3" fill={light} /></>;
    case "bike": return <><circle cx="30" cy="86" r="20" fill="none" stroke={dark} strokeWidth="6" /><circle cx="90" cy="86" r="20" fill="none" stroke={dark} strokeWidth="6" /><path d="M30 86 L52 52 H80 L90 86 M52 52 L44 38 H34 M80 52 L78 38 H90" stroke={mid} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>;
    case "board": return <><rect x="12" y="20" width="96" height="80" rx="6" fill={mid} /><rect x="20" y="28" width="80" height="64" rx="3" fill={light} /><path d="M20 60 H100 M60 28 V92" stroke={mid} strokeWidth="2" /><circle cx="40" cy="44" r="8" fill={dark} /><rect x="68" y="66" width="16" height="16" rx="3" fill={dark} /><circle cx="84" cy="44" r="6" fill={mid} /></>;
    case "puzzle": return <><rect x="16" y="16" width="44" height="44" rx="5" fill={mid} /><rect x="62" y="16" width="44" height="44" rx="5" fill={dark} /><rect x="16" y="62" width="44" height="44" rx="5" fill={dark} /><rect x="62" y="62" width="44" height="44" rx="5" fill={mid} /><circle cx="61" cy="38" r="7" fill={mid} /><circle cx="38" cy="61" r="7" fill={dark} /><circle cx="84" cy="61" r="7" fill={mid} /></>;
    case "palette": return <><path d="M60 12 C94 12 112 36 106 62 C102 80 84 78 80 90 C76 104 60 108 44 104 C20 98 8 76 10 54 C12 30 32 12 60 12Z" fill={light} stroke={mid} strokeWidth="3" /><circle cx="36" cy="46" r="8" fill={mid} /><circle cx="58" cy="34" r="8" fill={dark} /><circle cx="82" cy="44" r="8" fill={mid} /><circle cx="30" cy="72" r="8" fill={dark} /><circle cx="76" cy="76" r="7" fill={white} stroke={mid} strokeWidth="2" /></>;
    case "flask": return <><rect x="48" y="8" width="24" height="10" rx="3" fill={dark} /><path d="M52 18 H68 V46 L100 98 Q104 110 92 110 H28 Q16 110 20 98 L52 46Z" fill={light} stroke={mid} strokeWidth="3" /><path d="M32 86 H88 L98 102 Q100 108 92 108 H28 Q20 108 22 102Z" fill={mid} /><circle cx="52" cy="70" r="4" fill={dark} /><circle cx="68" cy="62" r="3" fill={dark} /></>;
    case "car": return <><rect x="12" y="58" width="96" height="26" rx="11" fill={mid} /><path d="M36 58 L44 38 H78 L88 58Z" fill={dark} /><path d="M46 56 L50 43 H60 V56Z M64 56 V43 H76 L82 56Z" fill={light} /><circle cx="34" cy="86" r="13" fill={dark} /><circle cx="88" cy="86" r="13" fill={dark} /><circle cx="34" cy="86" r="5" fill={light} /><circle cx="88" cy="86" r="5" fill={light} /></>;
    case "plush": return <><circle cx="40" cy="28" r="10" fill={mid} /><circle cx="80" cy="28" r="10" fill={mid} /><circle cx="40" cy="28" r="5" fill={light} /><circle cx="80" cy="28" r="5" fill={light} /><ellipse cx="60" cy="90" rx="30" ry="24" fill={mid} /><circle cx="60" cy="52" r="28" fill={mid} /><ellipse cx="60" cy="90" rx="16" ry="14" fill={light} /><circle cx="60" cy="60" r="11" fill={light} /><circle cx="49" cy="46" r="3.5" fill={dark} /><circle cx="71" cy="46" r="3.5" fill={dark} /><ellipse cx="60" cy="57" rx="4" ry="3" fill={dark} /></>;
    case "kitchen": return <><rect x="16" y="16" width="88" height="94" rx="6" fill={mid} /><rect x="16" y="16" width="88" height="14" rx="6" fill={dark} /><circle cx="40" cy="24" r="4" fill={light} /><circle cx="60" cy="24" r="4" fill={light} /><circle cx="80" cy="24" r="4" fill={light} /><rect x="26" y="52" width="68" height="46" rx="4" fill={light} /><rect x="36" y="60" width="48" height="22" rx="3" fill={white} opacity=".8" /><rect x="50" y="88" width="20" height="4" rx="2" fill={mid} /></>;
  }
}

const kindOf = (p: Product): Kind => KIND[p.id.split("-")[1]] ?? "box";

/** A product picture. `view` 0 = whole, 1 = close-up, 2 = tilted on a second background (for galleries). */
export function ProductArt({ p, view = 0, decorative = false, className = "" }: { p: Product; view?: 0 | 1 | 2; decorative?: boolean; className?: string }) {
  const c = palette(p);
  const gid = `bg-${hash(p.id)}-${view}`;
  return (
    <svg
      viewBox={view === 1 ? "22 22 76 76" : "0 0 120 120"}
      className={`block h-full w-full ${className}`}
      preserveAspectRatio="xMidYMid meet"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : `Illustration of ${p.name}`}
      aria-hidden={decorative || undefined}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={view === 2 ? c.bgB : c.bgA} />
          <stop offset="1" stopColor={view === 2 ? c.bgA : c.bgB} />
        </linearGradient>
      </defs>
      <rect x="-600" y="-600" width="1320" height="1320" fill={`url(#${gid})`} />
      <ellipse cx="60" cy="112" rx="34" ry="4" fill={c.dark} opacity=".12" />
      <g transform={view === 2 ? "rotate(-8 60 60) translate(3 -2) scale(.94)" : view === 0 ? "translate(0 -2)" : undefined}>
        <Glyph kind={kindOf(p)} c={c} />
      </g>
    </svg>
  );
}
