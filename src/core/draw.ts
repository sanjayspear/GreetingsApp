import type { Ctx } from "./types";
import { TAU } from "./math";

export function heartPath(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + s / 4);
  ctx.bezierCurveTo(x, y, x - s / 2, y, x - s / 2, y + s / 4);
  ctx.bezierCurveTo(x - s / 2, y + s / 2, x, y + s * 0.75, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.75, x + s / 2, y + s / 2, x + s / 2, y + s / 4);
  ctx.bezierCurveTo(x + s / 2, y, x, y, x, y + s / 4);
  ctx.closePath();
}

export function sparkle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

export function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function flower(ctx: Ctx, x: number, y: number, r: number, color: string, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  for (let k = 0; k < 5; k++) {
    ctx.rotate(TAU / 5);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.52, r * 0.34, r * 0.52, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = "#F6D776";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function leaf(ctx: Ctx, x: number, y: number, len: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = "#86A97F";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.32, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.32, 0, 0);
  ctx.fill();
  ctx.restore();
}

export function balloon(ctx: Ctx, x: number, y: number, r: number, color: string, sway: number): void {
  ctx.strokeStyle = "rgba(60,70,90,.45)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y + r);
  ctx.bezierCurveTo(x - 30 - sway, y + r + 120, x + 30 + sway, y + r + 220, x - 10 - sway * 2, y + r + 340);
  ctx.stroke();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1);
  g.addColorStop(0, "rgba(255,255,255,.85)");
  g.addColorStop(0.25, color);
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.86, r, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + r - 4);
  ctx.lineTo(x - 12, y + r + 16);
  ctx.lineTo(x + 12, y + r + 16);
  ctx.closePath();
  ctx.fill();
}

/** Break text into lines that fit `maxW` at the context's current font. Honors "\n". */
export function wrapLines(ctx: Ctx, text: string, maxW: number): string[] {
  const out: string[] = [];
  String(text)
    .split("\n")
    .forEach((par) => {
      let line = "";
      par
        .split(/\s+/)
        .filter(Boolean)
        .forEach((w) => {
          const test = line ? line + " " + w : w;
          if (ctx.measureText(test).width > maxW && line) {
            out.push(line);
            line = w;
          } else line = test;
        });
      if (line) out.push(line);
    });
  return out;
}
