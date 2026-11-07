"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const STAGE = { width: 1920, height: 1080 };

const TIMING = {
  hold: 1.5,
  anticipation: 0.45,
  zoom: 6,
  acceleration: 2,
  shatter: 0.55,
  black: 0.55,
  textIn: 1.6,
  textHold: 1.1,
  exit: 0.45,
} as const;

const SHATTER = {
  columns: 12,
  rows: 8,
  distance: 1.15,
};

const COLORS = {
  black: "#030303",
  white: "#ffffff",
  ink: "#191820",
  lime: "#d7f477",
};

const LEVELS = [
  {
    name: "SOFT FOCUS",
    palette: ["#f5f0ff", "#8067dc", "#ff86c8"],
    device: "browser",
    headline: "A more human way to work.",
  },
  {
    name: "CLOUD / CLOUD",
    palette: ["#e8f4ff", "#5296ec", "#b995ff"],
    device: "laptop",
    headline: "Your workflow, reimagined.",
  },
  {
    name: "FEEL BETTER",
    palette: ["#efe8d6", "#9d8c69", "#d4a47b"],
    device: "tablet",
    headline: "Find your future self.",
  },
  {
    name: "HYPER / HUMAN",
    palette: ["#211a42", "#fa59c8", "#54deef"],
    device: "phone",
    headline: "Unlock what comes next.",
  },
  {
    name: "SIMPLE / FUTURE",
    palette: ["#fff7eb", "#fe936e", "#ecb64d"],
    device: "display",
    headline: "Less busy. More brilliant.",
  },
  {
    name: "NOVA SYSTEMS",
    palette: ["#12243b", "#4b8cff", "#55e1cc"],
    device: "crt",
    headline: "Your AI, everywhere.",
  },
  {
    name: "DAYLIGHT STUDIO",
    palette: ["#f5eefe", "#a477ea", "#fa83b8"],
    device: "browser",
    headline: "Make room for magic.",
  },
] as const;

const TOTAL =
  TIMING.hold +
  TIMING.anticipation +
  TIMING.zoom +
  TIMING.acceleration +
  TIMING.shatter +
  TIMING.black +
  TIMING.textIn +
  TIMING.textHold +
  TIMING.exit;

type Point = { x: number; y: number };

type Shard = {
  bitmap: HTMLCanvasElement;
  points: Point[];
  bitmapX: number;
  bitmapY: number;
  centerX: number;
  centerY: number;
  velocityX: number;
  velocityY: number;
  spin: number;
  delay: number;
};

type Screen = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function makeCanvas(width = STAGE.width, height = STAGE.height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "transparent");

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

function drawProductArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  hue: number,
) {
  const cx = x + width * 0.5;
  const cy = y + height * 0.51;
  const size = Math.min(width, height);

  const backdrop = ctx.createLinearGradient(x, y, x + width, y + height);
  backdrop.addColorStop(0, `hsl(${hue}, 28%, 91%)`);
  backdrop.addColorStop(1, `hsl(${hue + 24}, 38%, 80%)`);
  ctx.fillStyle = backdrop;
  ctx.fillRect(x, y, width, height);

  ctx.save();
  ctx.shadowColor = "#1a172b45";
  ctx.shadowBlur = size * 0.09;
  ctx.shadowOffsetY = size * 0.045;

  roundedRect(
    ctx,
    cx - size * 0.34,
    cy - size * 0.24,
    size * 0.68,
    size * 0.43,
    size * 0.035,
  );
  ctx.fillStyle = "#343743";
  ctx.fill();
  ctx.restore();

  const screenGradient = ctx.createLinearGradient(
    cx - size * 0.3,
    cy - size * 0.2,
    cx + size * 0.3,
    cy + size * 0.17,
  );
  screenGradient.addColorStop(0, `hsl(${hue + 55}, 79%, 72%)`);
  screenGradient.addColorStop(0.52, `hsl(${hue + 5}, 74%, 58%)`);
  screenGradient.addColorStop(1, `hsl(${hue - 30}, 57%, 39%)`);

  roundedRect(
    ctx,
    cx - size * 0.3,
    cy - size * 0.2,
    size * 0.6,
    size * 0.35,
    size * 0.012,
  );
  ctx.fillStyle = screenGradient;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - size * 0.29, cy - size * 0.19, size * 0.58, size * 0.33);
  ctx.clip();

  ctx.strokeStyle = "#ffffff80";
  ctx.lineWidth = Math.max(1, size * 0.004);
  ctx.beginPath();
  ctx.ellipse(cx, cy, size * 0.22, size * 0.07, -0.3, 0, Math.PI * 2);
  ctx.stroke();

  const orb = ctx.createRadialGradient(
    cx - size * 0.045,
    cy - size * 0.075,
    size * 0.008,
    cx,
    cy - size * 0.045,
    size * 0.11,
  );
  orb.addColorStop(0, "#fff9e6");
  orb.addColorStop(0.35, `hsl(${hue + 72}, 94%, 78%)`);
  orb.addColorStop(1, `hsl(${hue + 12}, 75%, 53%)`);
  ctx.fillStyle = orb;
  ctx.beginPath();
  ctx.arc(cx, cy - size * 0.045, size * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = "#14121b38";
  ctx.shadowBlur = size * 0.035;
  ctx.shadowOffsetY = size * 0.015;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.4, cy + size * 0.2);
  ctx.lineTo(cx + size * 0.4, cy + size * 0.2);
  ctx.lineTo(cx + size * 0.47, cy + size * 0.255);
  ctx.quadraticCurveTo(
    cx,
    cy + size * 0.29,
    cx - size * 0.47,
    cy + size * 0.255,
  );
  ctx.closePath();
  ctx.fillStyle = "#c9cbd0";
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(cx - size * 0.08, cy + size * 0.21);
  ctx.lineTo(cx + size * 0.08, cy + size * 0.21);
  ctx.lineTo(cx + size * 0.105, cy + size * 0.235);
  ctx.lineTo(cx - size * 0.105, cy + size * 0.235);
  ctx.closePath();
  ctx.fillStyle = "#a3a6ac";
  ctx.fill();
}

function drawMarketingPage(
  ctx: CanvasRenderingContext2D,
  levelIndex: number,
  width: number,
  height: number,
) {
  const level = LEVELS[levelIndex % LEVELS.length];
  const [background, accent, accent2] = level.palette;
  const dark = levelIndex === 3 || levelIndex === 5;
  const ink = dark ? "#f7f5ff" : "#201c2b";
  const muted = dark ? "#c4bfd5" : "#6f6a78";

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  drawGlow(ctx, width * 0.77, height * 0.32, width * 0.45, accent, 0.24);
  drawGlow(ctx, width * 0.2, height * 0.82, width * 0.36, accent2, 0.14);

  ctx.fillStyle = dark ? "#171426" : "#ffffffd9";
  ctx.fillRect(0, 0, width, height * 0.105);

  ctx.fillStyle = ink;
  ctx.font = "700 24px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(level.name, width * 0.065, height * 0.067);

  ctx.fillStyle = muted;
  ctx.font = "14px Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("PLATFORM　 PRODUCT　 COMPANY", width * 0.935, height * 0.067);

  ctx.textAlign = "left";
  ctx.fillStyle = muted;
  ctx.font = "700 14px Arial, sans-serif";
  ctx.fillText("A NEW WAY TO DO MORE", width * 0.075, height * 0.25);

  ctx.fillStyle = ink;
  ctx.font = `700 ${Math.round(height * 0.075)}px Arial, sans-serif`;
  ctx.fillText(level.headline, width * 0.075, height * 0.36, width * 0.5);

  ctx.fillStyle = muted;
  ctx.font = `${Math.round(height * 0.021)}px Arial, sans-serif`;
  ctx.fillText(
    "Everything you need. Nothing you don't.",
    width * 0.078,
    height * 0.405,
  );

  roundedRect(ctx, width * 0.075, height * 0.45, width * 0.17, height * 0.065, 12);
  ctx.fillStyle = accent;
  ctx.fill();

  ctx.fillStyle = dark ? "#171426" : "#fff";
  ctx.font = "700 15px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Get started free", width * 0.16, height * 0.49);

  roundedRect(ctx, width * 0.255, height * 0.45, width * 0.15, height * 0.065, 12);
  ctx.fillStyle = dark ? "#ffffff18" : "#ffffff";
  ctx.fill();
  ctx.strokeStyle = dark ? "#ffffff4d" : "#d7d2df";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = ink;
  ctx.fillText("Watch demo", width * 0.33, height * 0.49);

  drawProductArt(
    ctx,
    width * 0.57,
    height * 0.15,
    width * 0.35,
    height * 0.44,
    218 + levelIndex * 17,
  );

  ctx.fillStyle = muted;
  ctx.font = "13px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("TRUSTED BY 10,000+ TEAMS", width * 0.5, height * 0.65);

  ctx.fillStyle = accent;
  ctx.font = "700 19px Arial, sans-serif";
  ctx.fillText(
    "NORTHSTAR   /   FORM   /   DAYLIGHT   /   OTHERCO",
    width * 0.5,
    height * 0.7,
  );

  const cardY = height * 0.77;
  const cardWidth = width * 0.245;
  const cardHeight = height * 0.14;
  const cardGap = width * 0.025;
  const cardStart = (width - (cardWidth * 3 + cardGap * 2)) / 2;
  const icons = ["✦", "↗", "◉"];
  const titles = ["Work beautifully", "Move a little faster", "Feel in control"];

  for (let i = 0; i < 3; i += 1) {
    const x = cardStart + i * (cardWidth + cardGap);

    roundedRect(ctx, x, cardY, cardWidth, cardHeight, 13);
    ctx.fillStyle = dark ? "#ffffff12" : "#ffffffdf";
    ctx.fill();
    ctx.strokeStyle = dark ? "#ffffff26" : "#ded9e3";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = accent2;
    ctx.font = "700 24px Arial, sans-serif";
    ctx.fillText(icons[i], x + 17, cardY + 36);

    ctx.fillStyle = ink;
    ctx.font = "700 15px Arial, sans-serif";
    ctx.fillText(titles[i], x + 50, cardY + 35);

    ctx.fillStyle = muted;
    ctx.font = "12px Arial, sans-serif";
    ctx.fillText("A smarter way to get it done.", x + 17, cardY + 66);
  }
}

function screenRect(levelIndex: number): Screen {
  const widths = [1560, 1300, 1080, 920, 1460, 1210, 1400];
  const width = widths[(levelIndex - 1) % widths.length];
  const height = width * (STAGE.height / STAGE.width);

  return {
    x: (STAGE.width - width) / 2,
    y: (STAGE.height - height) / 2,
    width,
    height,
  };
}

function drawDeviceFrame(
  ctx: CanvasRenderingContext2D,
  levelIndex: number,
  rect: Screen,
) {
  const type = LEVELS[(levelIndex - 1) % LEVELS.length].device;

  ctx.save();

  if (type === "browser") {
    roundedRect(ctx, rect.x - 16, rect.y - 36, rect.width + 32, rect.height + 52, 18);
    ctx.fillStyle = "#25252b";
    ctx.fill();

    ctx.fillStyle = "#e7e5df";
    ctx.fillRect(rect.x - 16, rect.y - 36, rect.width + 32, 36);

    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(rect.x + 5 + i * 18, rect.y - 18, 5, 0, Math.PI * 2);
      ctx.fillStyle = ["#f27e70", "#e7c56e", "#79bd83"][i];
      ctx.fill();
    }

    ctx.fillStyle = "#c8c6c0";
    ctx.fillRect(rect.x + 80, rect.y - 22, rect.width * 0.45, 8);
  } else if (type === "laptop") {
    roundedRect(ctx, rect.x - 25, rect.y - 28, rect.width + 50, rect.height + 56, 24);
    ctx.fillStyle = "#33343a";
    ctx.fill();

    ctx.fillStyle = "#aeb2b4";
    ctx.beginPath();
    ctx.moveTo(rect.x - 60, rect.y + rect.height + 25);
    ctx.lineTo(rect.x + rect.width + 60, rect.y + rect.height + 25);
    ctx.lineTo(rect.x + rect.width + 100, rect.y + rect.height + 57);
    ctx.lineTo(rect.x - 100, rect.y + rect.height + 57);
    ctx.closePath();
    ctx.fill();
  } else if (type === "tablet" || type === "phone") {
    roundedRect(ctx, rect.x - 30, rect.y - 30, rect.width + 60, rect.height + 60, 42);
    ctx.fillStyle = "#25252b";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(rect.x + rect.width / 2, rect.y - 13, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#92949b";
    ctx.fill();
  } else if (type === "crt") {
    roundedRect(ctx, rect.x - 40, rect.y - 40, rect.width + 80, rect.height + 80, 52);
    ctx.fillStyle = "#34343a";
    ctx.fill();

    roundedRect(ctx, rect.x - 18, rect.y + rect.height + 30, rect.width + 36, 36, 12);
    ctx.fillStyle = "#77777b";
    ctx.fill();
  } else {
    roundedRect(ctx, rect.x - 28, rect.y - 27, rect.width + 56, rect.height + 55, 30);
    ctx.fillStyle = "#282a2d";
    ctx.fill();

    ctx.fillStyle = "#86898a";
    ctx.fillRect(rect.x + rect.width * 0.38, rect.y + rect.height + 29, rect.width * 0.24, 50);
    ctx.fillRect(rect.x + rect.width * 0.24, rect.y + rect.height + 72, rect.width * 0.52, 20);
  }

  ctx.restore();
}

function buildLevels(): HTMLCanvasElement[] {
  const levels: HTMLCanvasElement[] = [];

  const base = makeCanvas();
  const baseContext = base.getContext("2d");
  if (!baseContext) return levels;

  drawMarketingPage(baseContext, 0, STAGE.width, STAGE.height);
  levels.push(base);

  for (let levelIndex = 1; levelIndex <= LEVELS.length; levelIndex += 1) {
    const canvas = makeCanvas();
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    const rect = screenRect(levelIndex);
    drawMarketingPage(ctx, levelIndex, STAGE.width, STAGE.height);
    drawDeviceFrame(ctx, levelIndex, rect);

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
    ctx.clip();
    ctx.drawImage(levels[levelIndex - 1], rect.x, rect.y, rect.width, rect.height);
    ctx.restore();

    const reflection = ctx.createLinearGradient(
      rect.x,
      rect.y,
      rect.x + rect.width * 0.4,
      rect.y,
    );
    reflection.addColorStop(0, "#ffffff22");
    reflection.addColorStop(1, "transparent");
    ctx.fillStyle = reflection;
    ctx.fillRect(rect.x, rect.y, rect.width * 0.4, 5);

    levels.push(canvas);
  }

  return levels;
}

function createShards(snapshot: HTMLCanvasElement): Shard[] {
  const cols = SHATTER.columns;
  const rows = SHATTER.rows;
  const grid: Point[][] = [];

  for (let row = 0; row <= rows; row += 1) {
    const line: Point[] = [];
    for (let col = 0; col <= cols; col += 1) {
      const edge = row === 0 || row === rows || col === 0 || col === cols;

      line.push({
        x:
          (col / cols) * STAGE.width +
          (edge ? 0 : Math.sin(row * 71 + col * 19) * 17),
        y:
          (row / rows) * STAGE.height +
          (edge ? 0 : Math.cos(row * 31 + col * 47) * 14),
      });
    }
    grid.push(line);
  }

  const shards: Shard[] = [];
  let seed = 0;

  function addTriangle(triangle: Point[]) {
    const minX = Math.floor(Math.min(...triangle.map((point) => point.x)));
    const minY = Math.floor(Math.min(...triangle.map((point) => point.y)));
    const maxX = Math.ceil(Math.max(...triangle.map((point) => point.x)));
    const maxY = Math.ceil(Math.max(...triangle.map((point) => point.y)));
    const bitmap = makeCanvas(
      Math.max(1, maxX - minX),
      Math.max(1, maxY - minY),
    );
    const ctx = bitmap.getContext("2d");

    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(triangle[0].x - minX, triangle[0].y - minY);
    ctx.lineTo(triangle[1].x - minX, triangle[1].y - minY);
    ctx.lineTo(triangle[2].x - minX, triangle[2].y - minY);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(snapshot, -minX, -minY);

    const centerX = triangle.reduce((sum, point) => sum + point.x, 0) / 3;
    const centerY = triangle.reduce((sum, point) => sum + point.y, 0) / 3;
    const angle = Math.atan2(centerY - STAGE.height / 2, centerX - STAGE.width / 2);
    const variation = Math.sin(seed * 91.7) * 0.35;

    shards.push({
      bitmap,
      points: triangle.map((point) => ({
        x: point.x - centerX,
        y: point.y - centerY,
      })),
      bitmapX: minX - centerX,
      bitmapY: minY - centerY,
      centerX,
      centerY,
      velocityX: Math.cos(angle + variation) * (480 + (seed % 7) * 54),
      velocityY: Math.sin(angle + variation) * (500 + (seed % 5) * 62),
      spin: variation * 2.5,
      delay: (seed % 9) * 0.012,
    });

    seed += 1;
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const topLeft = grid[row][col];
      const topRight = grid[row][col + 1];
      const bottomLeft = grid[row + 1][col];
      const bottomRight = grid[row + 1][col + 1];

      if ((row + col) % 2 === 0) {
        addTriangle([topLeft, topRight, bottomRight]);
        addTriangle([topLeft, bottomRight, bottomLeft]);
      } else {
        addTriangle([topLeft, topRight, bottomLeft]);
        addTriangle([topRight, bottomRight, bottomLeft]);
      }
    }
  }

  return shards;
}

function drawShards(
  ctx: CanvasRenderingContext2D,
  shards: Shard[],
  progress: number,
) {
  for (const shard of shards) {
    const local = Math.max(0, Math.min(1, (progress - shard.delay) / (1 - shard.delay)));

    const eased =
      local < 0.32
        ? 0.08 * Math.pow(local / 0.32, 1.6)
        : 0.08 + 0.92 * Math.pow((local - 0.32) / 0.68, 0.78);

    const x = shard.centerX + shard.velocityX * eased * SHATTER.distance;
    const y = shard.centerY + shard.velocityY * eased * SHATTER.distance;
    const rotation = shard.spin * eased * (1.2 + local);
    const scale = 1 - local * 0.16;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);

    ctx.drawImage(shard.bitmap, shard.bitmapX, shard.bitmapY);

    ctx.beginPath();
    ctx.moveTo(shard.points[0].x, shard.points[0].y);
    ctx.lineTo(shard.points[1].x, shard.points[1].y);
    ctx.lineTo(shard.points[2].x, shard.points[2].y);
    ctx.closePath();
    ctx.strokeStyle = `rgba(255,255,255,${0.42 * (1 - local)})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

function easeInExpo(value: number) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return (Math.pow(2, 7 * value) - 1) / (Math.pow(2, 7) - 1);
}

function easeInOut(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function getZoomPosition(progress: number, levelCount: number) {
  const segments = levelCount - 1;
  if (segments <= 0) return 0;

  const weights = Array.from({ length: segments }, (_, index) =>
    Math.pow(0.78, index),
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  let remaining = Math.max(0, Math.min(0.999999, progress)) * totalWeight;

  for (let index = 0; index < segments; index += 1) {
    if (remaining <= weights[index]) {
      const withinLevel = remaining / weights[index];
      return index + easeInOut(withinLevel);
    }
    remaining -= weights[index];
  }

  return segments;
}

function drawTransition(
  ctx: CanvasRenderingContext2D,
  levels: HTMLCanvasElement[],
  position: number,
) {
  const safePosition = Math.max(0, Math.min(levels.length - 1, position));
  const index = Math.min(Math.floor(safePosition), levels.length - 1);

  const oldLevel = levels[index];
  if (!oldLevel) return;

  if (index >= levels.length - 1) {
    ctx.drawImage(oldLevel, 0, 0);
    return;
  }

  const nextLevel = levels[index + 1];
  if (!nextLevel) {
    ctx.drawImage(oldLevel, 0, 0);
    return;
  }

  const local = easeInOut(safePosition - index);
  const target = screenRect(index + 1);

  ctx.drawImage(nextLevel, 0, 0);

  const x = target.x * local;
  const y = target.y * local;
  const width = STAGE.width + (target.width - STAGE.width) * local;
  const height = STAGE.height + (target.height - STAGE.height) * local;

  ctx.drawImage(oldLevel, x, y, width, height);
}

function wrapWords(
  ctx: CanvasRenderingContext2D,
  words: string[],
  maxWidth: number,
) {
  const lines: string[][] = [];
  let current: string[] = [];

  for (const word of words) {
    const candidate = [...current, word].join(" ");

    if (current.length > 0 && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = [word];
    } else {
      current.push(word);
    }
  }

  if (current.length > 0) lines.push(current);
  return lines;
}

function drawStatement(
  ctx: CanvasRenderingContext2D,
  elapsed: number,
  mode: "in" | "hold" | "out",
) {
  const words = "Aren't you tired of AI slop and greedy companies?".split(" ");
  const fontSize = 84;
  const lineHeight = 112;
  const maxWidth = 1580;

  ctx.save();
  ctx.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const lines = wrapWords(ctx, words, maxWidth);
  const placements: Array<{ word: string; x: number; y: number; index: number }> = [];
  let wordIndex = 0;
  const firstY = STAGE.height / 2 - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, lineIndex) => {
    const lineWidth = line.reduce(
      (sum, word, index) =>
        sum + ctx.measureText(word).width + (index < line.length - 1 ? 20 : 0),
      0,
    );

    let x = (STAGE.width - lineWidth) / 2;
    const y = firstY + lineIndex * lineHeight;

    line.forEach((word) => {
      const width = ctx.measureText(word).width;
      placements.push({ word, x: x + width / 2, y, index: wordIndex });
      x += width + 20;
      wordIndex += 1;
    });
  });

  const textStart =
    TIMING.hold +
    TIMING.anticipation +
    TIMING.zoom +
    TIMING.acceleration +
    TIMING.shatter +
    TIMING.black;

  const exitStart = textStart + TIMING.textIn + TIMING.textHold;

  placements.forEach(({ word, x, y, index }) => {
    const delay = index * 0.075;
    let opacity = 1;
    let offsetY = 0;
    let blur = 0;
    let scale = 1;
    let driftX = 0;
    let rotation = 0;

    if (mode === "in") {
      const progress = Math.max(0, Math.min(1, (elapsed - textStart - delay) / 0.66));
      const eased = 1 - Math.pow(1 - progress, 3);
      opacity = eased;
      offsetY = 40 * (1 - eased);
      blur = 6 * (1 - eased);
      scale = index === placements.length - 1
        ? 1 + Math.sin(progress * Math.PI) * 0.035
        : 1;
    } else if (mode === "hold") {
      const drift = Math.max(
        0,
        Math.min(1, (elapsed - (textStart + TIMING.textIn)) / TIMING.textHold),
      );
      scale = 1 + drift * 0.015;
      offsetY = Math.sin(drift * Math.PI * 2) * 2;
    } else {
      const progress = Math.max(
        0,
        Math.min(1, (elapsed - exitStart - index * 0.045) / TIMING.exit),
      );
      const eased = Math.pow(progress, 3);
      const directionX = x - STAGE.width / 2;
      const directionY = y - STAGE.height / 2;

      driftX = directionX * eased * 0.48 + Math.sin(index * 2.4) * 32 * eased;
      offsetY = directionY * eased * 0.56 - 18 * Math.sin(progress * Math.PI);
      rotation = (index % 2 === 0 ? 1 : -1) * progress * 0.09;
      scale = 1 + eased * 2.3;
      blur = eased * 5;
      opacity = progress < 0.8 ? 1 : 1 - (progress - 0.8) / 0.2;
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, opacity);
    ctx.filter = blur > 0.05 ? `blur(${blur}px)` : "none";
    ctx.translate(x + driftX, y + offsetY);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    ctx.fillStyle = word.toLowerCase() === "slop" ? COLORS.lime : COLORS.white;
    ctx.textAlign = "center";
    ctx.fillText(word, 0, 0);
    ctx.restore();
  });

  ctx.restore();
}

function drawGrain(ctx: CanvasRenderingContext2D, elapsed: number) {
  ctx.save();
  ctx.globalAlpha = 0.035;
  ctx.fillStyle = "#fff";

  const offset = Math.floor(elapsed * 12) % 4;

  for (let y = offset; y < STAGE.height; y += 14) {
    for (let x = (y % 3) * 4; x < STAGE.width; x += 17) {
      if ((x * 7 + y * 13) % 5 === 0) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }
  }

  ctx.restore();
}

export default function IntroPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ended, setEnded] = useState(false);
  const [replayKey, setReplayKey] = useState(0);

  const enterShop = useCallback(() => {
    router.replace("/taraba");
  }, [router]);

  const replay = useCallback(() => {
    setEnded(false);
    setReplayKey((key) => key + 1);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    const ctx: CanvasRenderingContext2D = context;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion) {
      setEnded(true);
      return;
    }

    const levels = buildLevels();
    if (levels.length === 0) return;

    const startedAt = performance.now();
    let animationFrame = 0;
    let hasEnded = false;
    let shards: Shard[] | null = null;

    function frame(now: number) {
      const elapsed = (now - startedAt) / 1000;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, STAGE.width, STAGE.height);

      const holdEnd = TIMING.hold;
      const anticipationEnd = holdEnd + TIMING.anticipation;
      const zoomEnd = anticipationEnd + TIMING.zoom;
      const accelerationEnd = zoomEnd + TIMING.acceleration;
      const shatterEnd = accelerationEnd + TIMING.shatter;
      const blackEnd = shatterEnd + TIMING.black;
      const textInEnd = blackEnd + TIMING.textIn;
      const textHoldEnd = textInEnd + TIMING.textHold;

      if (elapsed < holdEnd) {
        const push = 1 + 0.025 * (elapsed / holdEnd);
        ctx.translate(STAGE.width / 2, STAGE.height / 2);
        ctx.scale(push, push);
        ctx.translate(-STAGE.width / 2, -STAGE.height / 2);
        ctx.drawImage(levels[0], 0, 0);
      } else if (elapsed < anticipationEnd) {
        const progress = (elapsed - holdEnd) / TIMING.anticipation;
        const push = 1.025 + 0.025 * (1 - Math.pow(1 - progress, 3));

        ctx.translate(STAGE.width / 2, STAGE.height / 2);
        ctx.scale(push, push);
        ctx.translate(-STAGE.width / 2, -STAGE.height / 2);
        ctx.drawImage(levels[0], 0, 0);
      } else if (elapsed < zoomEnd) {
        const progress = (elapsed - anticipationEnd) / TIMING.zoom;
        drawTransition(ctx, levels, getZoomPosition(progress, levels.length));
      } else if (elapsed < accelerationEnd) {
        const zoomElapsed = elapsed - anticipationEnd;
        const zoomDuration = TIMING.zoom + TIMING.acceleration;
        const progress = Math.max(0, Math.min(1, zoomElapsed / zoomDuration));
        const position = getZoomPosition(progress, levels.length);

        const acceleration = Math.max(
          0,
          (zoomElapsed - TIMING.zoom) / TIMING.acceleration,
        );
        const shake = acceleration * acceleration * 5;

        ctx.save();
        ctx.translate(
          Math.sin(elapsed * 31) * shake,
          Math.cos(elapsed * 27) * shake,
        );
        ctx.rotate(acceleration * 0.012);
        ctx.filter = acceleration > 0 ? `blur(${acceleration * 1.2}px)` : "none";
        drawTransition(ctx, levels, position);
        ctx.restore();
      } else if (elapsed < shatterEnd) {
        if (!shards) shards = createShards(levels[levels.length - 1]);

        const progress = (elapsed - accelerationEnd) / TIMING.shatter;

        if (progress < 0.045) {
          ctx.drawImage(levels[levels.length - 1], 0, 0);
        } else {
          drawShards(ctx, shards, Math.min(1, (progress - 0.045) / 0.955));

          if (progress > 0.07 && progress < 0.15) {
            const flashOpacity = 0.72 * (1 - (progress - 0.07) / 0.08);
            ctx.fillStyle = `rgba(255,255,255,${flashOpacity})`;
            ctx.fillRect(0, 0, STAGE.width, STAGE.height);
          }
        }
      } else if (elapsed < blackEnd) {
        ctx.fillStyle = COLORS.black;
        ctx.fillRect(0, 0, STAGE.width, STAGE.height);
      } else if (elapsed < textInEnd) {
        ctx.fillStyle = COLORS.black;
        ctx.fillRect(0, 0, STAGE.width, STAGE.height);
        drawStatement(ctx, elapsed, "in");
      } else if (elapsed < textHoldEnd) {
        ctx.fillStyle = COLORS.black;
        ctx.fillRect(0, 0, STAGE.width, STAGE.height);
        drawStatement(ctx, elapsed, "hold");
      } else if (elapsed < TOTAL) {
        ctx.fillStyle = COLORS.black;
        ctx.fillRect(0, 0, STAGE.width, STAGE.height);
        drawStatement(ctx, elapsed, "out");
      } else {
        ctx.fillStyle = COLORS.black;
        ctx.fillRect(0, 0, STAGE.width, STAGE.height);

        if (!hasEnded) {
          hasEnded = true;
          setEnded(true);
        }
        return;
      }

      drawGrain(ctx, elapsed);
      animationFrame = window.requestAnimationFrame(frame);
    }

    animationFrame = window.requestAnimationFrame(frame);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [replayKey]);

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
        A visual intro about repetitive AI-generated storefronts. The message reads:
        Aren&apos;t you tired of AI slop and greedy companies?
      </p>

      <button className="skip" type="button" onClick={enterShop}>
        Skip intro
      </button>

      {ended && (
        <div className="end-controls">
          <button type="button" onClick={replay}>
            Replay
          </button>
          <button className="continue" type="button" onClick={enterShop}>
            Enter Taraba
          </button>
        </div>
      )}

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          width: 100%;
          min-height: 100%;
          margin: 0;
          background: #000;
        }

        body {
          font-family: Arial, Helvetica, sans-serif;
        }

        .intro-shell {
          position: relative;
          display: grid;
          width: 100vw;
          height: 100vh;
          height: 100dvh;
          overflow: hidden;
          place-items: center;
          background: #000;
        }

        .stage {
          display: block;
          width: min(100vw, 177.7778dvh);
          height: min(100dvh, 56.25vw);
          aspect-ratio: 16 / 9;
          background: #000;
        }

        .intro-shell::after {
          position: fixed;
          z-index: 2;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.16'/%3E%3C/svg%3E");
          content: "";
          opacity: .14;
          pointer-events: none;
        }

        .skip,
        .end-controls button {
          position: fixed;
          z-index: 5;
          top: 16px;
          right: 16px;
          min-height: 38px;
          padding: 8px 13px;
          border: 1px solid #ffffff55;
          color: #fff;
          background: #111;
          font: 12px Arial, sans-serif;
          cursor: pointer;
        }

        .skip:hover,
        .end-controls button:hover {
          background: #292929;
        }

        .end-controls {
          position: fixed;
          z-index: 5;
          right: 22px;
          bottom: 22px;
          display: flex;
          gap: 9px;
        }

        .end-controls button {
          position: static;
          border-color: #777;
        }

        .end-controls .continue {
          border-color: #fff;
          color: #111;
          background: #fff;
        }

        .end-controls .continue:hover {
          background: #e7e7e7;
        }

        .visually-hidden {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          clip-path: inset(50%);
        }

        @media (prefers-reduced-motion: reduce) {
          .stage {
            image-rendering: auto;
          }
        }
      `}</style>
    </main>
  );
}
