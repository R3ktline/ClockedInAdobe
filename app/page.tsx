"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// --- CONSTANTS & CONFIGURATION ---
const STAGE = { width: 1920, height: 1080 };
const NUM_LEVELS = 8; 

const TIMING = {
  hold: 1.0,           // Hold inițial
  zoomOut: 6.5,        // Zoom-ul fractal
  blackGap: 0.3,       // Pauză scurtă în întuneric total
  textIn: 1.2,         // Apariția textului
  textHold: 2.2,       // Cât stă textul pe ecran
  textOut: 1.2,        // Fly-out spre cameră
} as const;

const TOTAL_TIME = 
  TIMING.hold + 
  TIMING.zoomOut + 
  TIMING.blackGap +
  TIMING.textIn +
  TIMING.textHold + 
  TIMING.textOut;

// --- UTILITIES ---
function makeCanvas(width = STAGE.width, height = STAGE.height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

// --- SLOP UI GENERATOR ---
function generateSlopUI(seed: number): HTMLCanvasElement {
  const canvas = makeCanvas();
  const ctx = canvas.getContext("2d")!;
  const w = STAGE.width;
  const h = STAGE.height;

  const palettes = [
    { bg: "#0d0e15", accent: "#7458e8", text: "#ffffff", card: "#1a1b26" }, 
    { bg: "#f5f0ff", accent: "#8067dc", text: "#191820", card: "#ffffff" }, 
    { bg: "#0f172a", accent: "#38bdf8", text: "#f8fafc", card: "#1e293b" }, 
    { bg: "#fff7eb", accent: "#fe936e", text: "#2c1a0b", card: "#ffffff" }, 
    { bg: "#111111", accent: "#d7f477", text: "#eeeeee", card: "#222222" }, 
  ];

  const p = palettes[seed % palettes.length];

  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, w, h);

  const gradient = ctx.createRadialGradient(w*0.8, h*0.2, 0, w*0.8, h*0.2, w*0.5);
  gradient.addColorStop(0, p.accent + "55");
  gradient.addColorStop(1, "transparent");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = p.card;
  ctx.fillRect(0, 0, w, 80);
  ctx.fillStyle = p.text;
  ctx.font = "bold 28px Inter, Arial, sans-serif";
  ctx.fillText("SlopAI™", 40, 50);

  ctx.fillStyle = p.text + "88";
  ctx.fillRect(w - 300, 38, 50, 6);
  ctx.fillRect(w - 220, 38, 50, 6);
  
  roundedRect(ctx, w - 140, 20, 100, 40, 8);
  ctx.fillStyle = p.accent;
  ctx.fill();

  ctx.fillStyle = p.text;
  ctx.font = "bold 84px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Revolutionize Your Workflow.", w/2, h * 0.35);
  
  ctx.fillStyle = p.text + "aa";
  ctx.font = "32px Inter, Arial, sans-serif";
  ctx.fillText("Unlock the power of generic algorithms today.", w/2, h * 0.42);

  const dashW = 900, dashH = 450;
  const dashX = w/2 - dashW/2, dashY = h * 0.5;
  
  ctx.shadowColor = "rgba(0,0,0,0.2)";
  ctx.shadowBlur = 40;
  roundedRect(ctx, dashX, dashY, dashW, dashH, 20);
  ctx.fillStyle = p.card;
  ctx.fill();
  ctx.shadowBlur = 0; 

  ctx.fillStyle = p.text + "22";
  roundedRect(ctx, dashX + 40, dashY + 40, 200, 370, 10);
  ctx.fill();
  roundedRect(ctx, dashX + 280, dashY + 40, 580, 200, 10);
  ctx.fill();
  roundedRect(ctx, dashX + 280, dashY + 280, 270, 130, 10);
  ctx.fill();
  roundedRect(ctx, dashX + 590, dashY + 280, 270, 130, 10);
  ctx.fill();

  return canvas;
}

// --- FRACTAL GRID GENERATOR ---
function generateGridCanvas(centerCanvas: HTMLCanvasElement | null, pool: HTMLCanvasElement[]): HTMLCanvasElement {
  const canvas = makeCanvas();
  const ctx = canvas.getContext("2d", { alpha: false })!;
  
  ctx.fillStyle = "#020202";
  ctx.fillRect(0, 0, STAGE.width, STAGE.height);

  const tileW = STAGE.width / 3;
  const tileH = STAGE.height / 3;

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      let img: HTMLCanvasElement;
      if (r === 1 && c === 1 && centerCanvas) {
        img = centerCanvas; 
      } else {
        img = pool[Math.floor(Math.random() * pool.length)]; 
      }
      ctx.drawImage(img, c * tileW, r * tileH, tileW, tileH);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 4;
      ctx.strokeRect(c * tileW, r * tileH, tileW, tileH);
    }
  }
  return canvas;
}

// --- MAIN COMPONENT ---
export default function IntroPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedAtRef = useRef(0);
  const [ended, setEnded] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const heroLevelsRef = useRef<HTMLCanvasElement[]>([]);

  useEffect(() => {
    const baseVariations = Array.from({ length: 5 }).map((_, i) => generateSlopUI(i));
    let currentHero = baseVariations[0];
    let currentPool = baseVariations;
    const levels = [currentHero];

    for (let L = 1; L <= NUM_LEVELS; L++) {
      const nextPool = [
        generateGridCanvas(null, currentPool),
        generateGridCanvas(null, currentPool),
        generateGridCanvas(null, currentPool),
      ];
      const nextHero = generateGridCanvas(currentHero, currentPool);
      levels.push(nextHero);
      currentHero = nextHero;
      currentPool = nextPool;
    }
    heroLevelsRef.current = levels;
  }, []);

  const enterShop = useCallback(() => router.replace("/taraba"), [router]);
  const replay = useCallback(() => {
    startedAtRef.current = performance.now();
    setEnded(false);
    setReplayKey((key) => key + 1);
  }, []);

  // --- RENDER LOOP ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !ctx || heroLevelsRef.current.length === 0) return;

    startedAtRef.current = performance.now();
    let animationFrame = 0;
    let hasEnded = false;

    function frame(now: number) {
      const elapsed = (now - startedAtRef.current) / 1000;
      
      // Resetăm complet transformările și curățăm canvasul pentru a preveni orice ghosting
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.fillStyle = "#000000";
      ctx!.fillRect(0, 0, STAGE.width, STAGE.height);

      const timeZoomEnd = TIMING.hold + TIMING.zoomOut;
      const timeGapEnd = timeZoomEnd + TIMING.blackGap;

      // --- PHASE 1: ZOOM & PROGRESIVE FADE TO BLACK ---
      if (elapsed < timeZoomEnd) {
        ctx!.save();

        const progress = Math.max(0, (elapsed - TIMING.hold) / TIMING.zoomOut);
        const maxZoomFactor = Math.pow(3, NUM_LEVELS);
        const easeProgress = Math.pow(progress, 2.5); 
        const currentScale = Math.exp(-easeProgress * Math.log(maxZoomFactor));
        const rotation = easeProgress * 0.15;

        let globalAlpha = 1.0;
        if (progress > 0.2) {
          const fadeProgress = (progress - 0.2) / 0.8; 
          globalAlpha = 1.0 - Math.pow(fadeProgress, 1.8);
        }

        ctx!.globalAlpha = Math.max(0, Math.min(1, globalAlpha));

        ctx!.translate(STAGE.width/2, STAGE.height/2);
        ctx!.rotate(rotation);
        
        for (let i = NUM_LEVELS; i >= 0; i--) {
          const levelScale = currentScale * Math.pow(3, i);
          if (levelScale < 0.005 || levelScale > 5) continue;
          ctx!.save();
          ctx!.scale(levelScale, levelScale);
          ctx!.drawImage(heroLevelsRef.current[i], -STAGE.width/2, -STAGE.height/2, STAGE.width, STAGE.height);
          ctx!.restore();
        }

        const grad = ctx!.createRadialGradient(0, 0, STAGE.height * 0.3, 0, 0, STAGE.width * 0.8);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(1, "rgba(0,0,0,0.95)");
        ctx!.fillStyle = grad;
        ctx!.fillRect(-STAGE.width, -STAGE.height, STAGE.width*2, STAGE.height*2);
        
        ctx!.restore();

      } 
      // --- PHASE 2: CINEMATIC SILENCE (BLACK GAP) ---
      else if (elapsed < timeGapEnd) {
        ctx!.fillStyle = "#000000";
        ctx!.fillRect(0, 0, STAGE.width, STAGE.height);
      } 
      // --- PHASE 3: TEXT REVEAL & FLY-OUT ---
      else if (elapsed < TOTAL_TIME) {
        // Asigurăm un fundal negru pur, fără urme din frame-urile trecute
        ctx!.fillStyle = "#000000";
        ctx!.fillRect(0, 0, STAGE.width, STAGE.height);

        const textElapsed = elapsed - timeGapEnd;
        
        ctx!.textAlign = "center";
        ctx!.textBaseline = "middle";
        ctx!.font = "bold 84px Arial, sans-serif";
        
        const text = "Aren't you tired of AI SLOP?";
        
        let opacity = 0, scale = 1, yOffset = 0;

        if (textElapsed < TIMING.textIn) {
          const p = 1 - Math.pow(1 - (textElapsed / TIMING.textIn), 3);
          opacity = p;
          scale = 0.96 + p * 0.04;
          yOffset = 30 * (1 - p);
        } else if (textElapsed < TIMING.textIn + TIMING.textHold) {
          opacity = 1;
          const holdP = (textElapsed - TIMING.textIn) / TIMING.textHold;
          scale = 1.0 + holdP * 0.015;
        } else {
          const outElapsed = textElapsed - (TIMING.textIn + TIMING.textHold);
          const p = Math.pow(outElapsed / TIMING.textOut, 3);
          opacity = 1 - Math.pow(p, 2); 
          scale = 1.015 + p * 3.5; 
        }

        ctx!.save();
        ctx!.translate(STAGE.width/2, STAGE.height/2 + yOffset);
        ctx!.scale(scale, scale);
        ctx!.globalAlpha = Math.max(0, opacity);
        
        const words = text.split(" ");
        let currentX = -ctx!.measureText(text).width / 2;
        
        words.forEach(word => {
          ctx!.fillStyle = word === "SLOP?" ? "#d7f477" : "#ffffff";
          ctx!.fillText(word, currentX + ctx!.measureText(word).width/2, 0);
          currentX += ctx!.measureText(word + " ").width;
        });
        
        ctx!.restore();

      } else {
        // --- END ---
        ctx!.fillStyle = "#000000";
        ctx!.fillRect(0, 0, STAGE.width, STAGE.height);
        if (!hasEnded) {
          hasEnded = true;
          setEnded(true);
        }
        return;
      }

      // --- GLOBAL FILM GRAIN (Aplicat doar pe elementele active, fără artefacte) ---
      ctx!.save();
      ctx!.globalAlpha = 0.03;
      ctx!.fillStyle = "#ffffff";
      const offset = Math.floor(elapsed * 12) % 4;
      for (let y = offset; y < STAGE.height; y += 8) {
        for (let x = (y % 3) * 4; x < STAGE.width; x += 11) {
          if ((x * 7 + y * 13) % 5 === 0) ctx!.fillRect(x, y, 1.5, 1.5);
        }
      }
      ctx!.restore();

      animationFrame = window.requestAnimationFrame(frame);
    }

    animationFrame = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [replayKey, setEnded]);

  return (
    <main className="intro-shell">
      <canvas
        ref={canvasRef}
        className="stage"
        width={STAGE.width}
        height={STAGE.height}
        aria-hidden="true"
      />

      <p className="visually-hidden" aria-live="polite">
        A cinematic zoom-out mosaic revealing the repetition of AI generated sites. Text reads: Aren't you tired of AI SLOP?
      </p>

      {/* Skip button discret în colțul din dreapta sus */}
      <button className="skip" type="button" onClick={enterShop}>
        Skip intro
      </button>

      {/* Ecranul final: Butoane centrate cinematic */}
      {ended && (
        <div className="end-controls-center">
          <div className="end-buttons-wrapper">
            <button className="cta-btn replay" type="button" onClick={replay}>
              Replay Intro
            </button>
            <button className="cta-btn continue" type="button" onClick={enterShop}>
              Enter Taraba →
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        * { box-sizing: border-box; }
        html, body {
          width: 100%; min-height: 100%; margin: 0; background: #000;
          font-family: Arial, Helvetica, sans-serif;
        }
        .intro-shell {
          position: relative; display: grid; width: 100vw; height: 100vh; height: 100dvh;
          overflow: hidden; place-items: center; background: #000;
        }
        .stage {
          display: block; width: min(100vw, 177.7778dvh); height: min(100dvh, 56.25vw);
          aspect-ratio: 16 / 9; background: #000;
        }
        
        .skip {
          position: fixed; z-index: 5; top: 20px; right: 20px;
          padding: 8px 16px; border: 1px solid rgba(255,255,255,0.2);
          color: rgba(255,255,255,0.7); background: rgba(0,0,0,0.5);
          backdrop-filter: blur(5px); font: 12px Arial, sans-serif;
          cursor: pointer; transition: all 0.2s ease; border-radius: 4px;
        }
        .skip:hover {
          background: rgba(255,255,255,0.1); color: #fff; border-color: rgba(255,255,255,0.5);
        }

        @keyframes menuAppear {
          0% { opacity: 0; transform: translate(-50%, -40%); }
          100% { opacity: 1; transform: translate(-50%, -50%); }
        }

        .end-controls-center {
          position: fixed;
          z-index: 10;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: menuAppear 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .end-buttons-wrapper {
          display: flex;
          gap: 16px;
          align-items: center;
          justify-content: center;
        }

        .cta-btn {
          padding: 16px 32px;
          font-size: 16px;
          font-weight: 700;
          font-family: Arial, sans-serif;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }

        .cta-btn.replay {
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
        }
        .cta-btn.replay:hover {
          background: rgba(255, 255, 255, 0.18);
          transform: translateY(-3px) scale(1.02);
          border-color: rgba(255, 255, 255, 0.5);
        }

        .cta-btn.continue {
          background: #ffffff;
          color: #030303;
          border: 1px solid #ffffff;
        }
        .cta-btn.continue:hover {
          background: #d7f477; 
          border-color: #d7f477;
          transform: translateY(-3px) scale(1.03);
          box-shadow: 0 15px 35px rgba(215, 244, 119, 0.3);
        }

        .visually-hidden {
          position: absolute; width: 1px; height: 1px; overflow: hidden;
          clip: rect(0, 0, 0, 0); white-space: nowrap; clip-path: inset(50%);
        }
      `}</style>
    </main>
  );
}
