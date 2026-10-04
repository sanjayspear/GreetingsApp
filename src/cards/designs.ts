import type { Ctx } from "../core/types";
import { W, H, TAU, rng, pick, seeds, clamp01, mod } from "../core/math";
import { heartPath, sparkle, flower, leaf, balloon } from "../core/draw";

export interface Design {
  id: string;
  name: string;
  swatch: string;
  env: string;
  head: string;
  headColor: string;
  body: string;
  sign: string;
  ring: string;
  plate: string | null;
  draw(ctx: Ctx, t: number): void;
}

// Particle seeds built once per design (positions are pure functions of time)
const CONF_COLS = ["#F25F5C", "#FFC93C", "#3BCEAC", "#6A4C93", "#1982C4", "#FF8FAB"];
export { CONF_COLS };

const confetti = seeds(110, 7, (r) => ({
  x: r() * W,
  y: r() * (H + 100),
  v: 70 + r() * 110,
  sw: 10 + r() * 30,
  f: 0.6 + r() * 1.4,
  ph: r() * TAU,
  rs: (r() - 0.5) * 5,
  c: pick(r, CONF_COLS),
  k: r()
}));
const balloons: [number, number, number, string][] = [
  [95, 230, 70, "#F25F5C"],
  [195, 130, 62, "#FFC93C"],
  [120, 390, 58, "#6A4C93"],
  [985, 220, 72, "#3BCEAC"],
  [890, 120, 60, "#FF8FAB"],
  [960, 390, 56, "#1982C4"]
];
type FloralItem = { t: "leaf"; x: number; y: number; s: number; rot: number } | { t: "fl"; x: number; y: number; s: number; c: string; rot: number; sp: number };
const floralStatic = (() => {
  const r = rng(11),
    cols = ["#E8899E", "#F4B9C6", "#C4577A", "#F7C6A5"],
    items: FloralItem[] = [];
  const cluster = (cx: number, cy: number) => {
    for (let i = 0; i < 9; i++) items.push({ t: "leaf", x: cx + (r() - 0.5) * 260, y: cy + (r() - 0.5) * 200, s: 70 + r() * 40, rot: r() * TAU });
    for (let i = 0; i < 8; i++)
      items.push({ t: "fl", x: cx + (r() - 0.5) * 280, y: cy + (r() - 0.5) * 200, s: 46 + r() * 34, c: pick(r, cols), rot: r() * 3, sp: (r() - 0.5) * 0.4 });
  };
  cluster(110, 110);
  cluster(W - 110, H - 110);
  for (let i = 0; i < 4; i++) items.push({ t: "fl", x: W - 70 - r() * 60, y: 70 + r() * 80, s: 22 + r() * 10, c: pick(r, cols), rot: r() * 3, sp: 0.5 });
  for (let i = 0; i < 4; i++) items.push({ t: "fl", x: 70 + r() * 60, y: H - 70 - r() * 80, s: 22 + r() * 10, c: pick(r, cols), rot: r() * 3, sp: -0.5 });
  return items;
})();
const petals = seeds(22, 13, (r) => ({
  x: r() * W,
  y: r() * (H + 100),
  v: 40 + r() * 50,
  sw: 30 + r() * 50,
  f: 0.4 + r() * 0.6,
  ph: r() * TAU,
  s: 12 + r() * 10,
  c: pick(r, ["#F4B9C6", "#E8899E", "#F7C6A5"])
}));
const stars = seeds(170, 3, (r) => ({ x: r() * W, y: r() * H, s: 0.8 + r() * 2.4, f: 0.5 + r() * 2.5, ph: r() * TAU }));
const sparkles = seeds(9, 4, (r) => ({
  x: 80 + r() * (W - 160),
  y: r() < 0.5 ? 70 + r() * 160 : H - 70 - r() * 140,
  s: 10 + r() * 16,
  f: 0.8 + r() * 1.5,
  ph: r() * TAU
}));
const hearts = seeds(34, 5, (r) => ({
  x: r() * W,
  y: r() * (H + 200),
  v: 45 + r() * 70,
  s: 24 + r() * 64,
  sw: 15 + r() * 30,
  f: 0.5 + r(),
  ph: r() * TAU,
  c: pick(r, ["#F4708A", "#E23E5C", "#FFB3C1", "#FF8FA3"])
}));

let paper: HTMLCanvasElement | null = null;
function paperTexture(): HTMLCanvasElement {
  if (paper) return paper;
  paper = document.createElement("canvas");
  paper.width = W;
  paper.height = H;
  const x = paper.getContext("2d")!,
    r = rng(9);
  for (let i = 0; i < 1500; i++) {
    x.fillStyle = `rgba(0,0,0,${r() * 0.035})`;
    x.fillRect(r() * W, r() * H, 2, 2);
  }
  return paper;
}

/* ---------- Card designs (draw(ctx, t) = background + motion at time t seconds) ---------- */
export const DESIGNS: Design[] = [
  {
    id: "confetti",
    name: "Confetti",
    swatch: "#F2A541",
    env: "#F2A541",
    head: '600 {s}px "Fredoka", "Trebuchet MS", sans-serif',
    headColor: "#2B2141",
    body: "#3B3450",
    sign: "#E0475B",
    ring: "#FFFFFF",
    plate: "rgba(255,246,234,.82)",
    draw(ctx, t) {
      ctx.fillStyle = "#FFF6EA";
      ctx.fillRect(0, 0, W, H);
      confetti.forEach((p) => {
        const y = mod(p.y + p.v * t, H + 100) - 50,
          x = p.x + Math.sin(t * p.f + p.ph) * p.sw;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.ph + t * p.rs);
        ctx.fillStyle = p.c;
        if (p.k < 0.5) {
          ctx.scale(1, Math.cos(t * p.f * 3 + p.ph));
          ctx.fillRect(-14, -6, 28, 12);
        } else if (p.k < 0.85) {
          ctx.beginPath();
          ctx.arc(0, 0, 8, 0, TAU);
          ctx.fill();
        } else {
          ctx.lineWidth = 6;
          ctx.strokeStyle = p.c;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(-20, 0);
          ctx.quadraticCurveTo(-10, -14, 0, 0);
          ctx.quadraticCurveTo(10, 14, 20, 0);
          ctx.stroke();
        }
        ctx.restore();
      });
    }
  },
  {
    id: "balloons",
    name: "Balloons",
    swatch: "#4A90C2",
    env: "#4A90C2",
    head: '600 {s}px "Fredoka", "Trebuchet MS", sans-serif',
    headColor: "#1E3A5F",
    body: "#2E4560",
    sign: "#D9485F",
    ring: "#FFFFFF",
    plate: null,
    draw(ctx, t) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#CFEAFF");
      g.addColorStop(1, "#FFFFFF");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,.9)";
      (
        [
          [300, 120, 1, 18],
          [820, 1180, 1.2, -14]
        ] as const
      ).forEach(([x, y, s, v]) => {
        const ox = mod(x + v * t + 200, W + 400) - 200;
        (
          [
            [0, 0, 50],
            [45, -18, 60],
            [100, 0, 48]
          ] as const
        ).forEach(([dx, dy, rr]) => {
          ctx.beginPath();
          ctx.arc(ox + dx * s, y + dy * s, rr * s, 0, TAU);
          ctx.fill();
        });
      });
      balloons.forEach(([x, y, r, c], i) => {
        const sway = Math.sin(t * 0.9 + i) * 10;
        balloon(ctx, x + sway, y + Math.sin(t * 1.3 + i * 1.7) * 16, r, c, sway);
      });
    }
  },
  {
    id: "floral",
    name: "Flowers",
    swatch: "#D4789A",
    env: "#D4789A",
    head: 'italic 600 {s}px "Playfair Display", Georgia, serif',
    headColor: "#5A2337",
    body: "#4A3038",
    sign: "#B5476C",
    ring: "#FFFFFF",
    plate: null,
    draw(ctx, t) {
      ctx.fillStyle = "#FCF4F1";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#E9B9C6";
      ctx.lineWidth = 3;
      ctx.strokeRect(40, 40, W - 80, H - 80);
      floralStatic.forEach((it) => {
        if (it.t === "leaf") leaf(ctx, it.x, it.y, it.s, it.rot + Math.sin(t * 0.8 + it.x) * 0.05);
        else flower(ctx, it.x, it.y, it.s * (1 + Math.sin(t * 1.2 + it.x) * 0.03), it.c, it.rot + t * it.sp * 0.3);
      });
      petals.forEach((p) => {
        const y = mod(p.y + p.v * t, H + 100) - 50,
          x = p.x + Math.sin(t * p.f + p.ph) * p.sw;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * p.f + p.ph);
        ctx.fillStyle = p.c;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.s * 0.55, p.s, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      });
    }
  },
  {
    id: "golden",
    name: "Golden night",
    swatch: "#24305E",
    env: "#24305E",
    head: 'italic 600 {s}px "Playfair Display", Georgia, serif',
    headColor: "gold",
    body: "#EDE3CC",
    sign: "#E8C77A",
    ring: "#E8C77A",
    plate: null,
    draw(ctx, t) {
      const g = ctx.createRadialGradient(W / 2, H * 0.35, 100, W / 2, H / 2, H * 0.8);
      g.addColorStop(0, "#26336B");
      g.addColorStop(1, "#0D1330");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      stars.forEach((s) => {
        ctx.fillStyle = `rgba(240,215,150,${0.15 + 0.75 * (0.5 + 0.5 * Math.sin(t * s.f + s.ph))})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.s, 0, TAU);
        ctx.fill();
      });
      ctx.fillStyle = "#F1D58E";
      sparkles.forEach((s) => sparkle(ctx, s.x, s.y, s.s * (0.6 + 0.5 * (0.5 + 0.5 * Math.sin(t * s.f + s.ph)))));
      // shooting star every 6s
      const p = (t % 6) / 1.1;
      if (p < 1) {
        const x0 = 150 + 500 * p,
          y0 = 120 + 220 * p,
          gr = ctx.createLinearGradient(x0 - 180, y0 - 80, x0, y0);
        gr.addColorStop(0, "rgba(246,226,168,0)");
        gr.addColorStop(1, `rgba(246,226,168,${1 - p})`);
        ctx.strokeStyle = gr;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x0 - 180, y0 - 80);
        ctx.lineTo(x0, y0);
        ctx.stroke();
      }
      ctx.save();
      ctx.shadowColor = "rgba(241,213,142,.6)";
      ctx.shadowBlur = 30 + 12 * Math.sin(t * 1.5);
      ctx.fillStyle = "#F1D58E";
      ctx.beginPath();
      ctx.arc(W - 170, 170, 62, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#1E2A5C";
      ctx.beginPath();
      ctx.arc(W - 145, 150, 56, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#C9A659";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(44, 44, W - 88, H - 88);
      ctx.lineWidth = 1.2;
      ctx.strokeRect(58, 58, W - 116, H - 116);
    }
  },
  {
    id: "hearts",
    name: "Hearts",
    swatch: "#D64563",
    env: "#D64563",
    head: 'italic 600 {s}px "Playfair Display", Georgia, serif',
    headColor: "#7A1733",
    body: "#5C2232",
    sign: "#D64563",
    ring: "#FFFFFF",
    plate: "rgba(255,237,241,.8)",
    draw(ctx, t) {
      ctx.fillStyle = "#FFEDF1";
      ctx.fillRect(0, 0, W, H);
      hearts.forEach((h) => {
        const y = H + 100 - mod(h.y + h.v * t, H + 200),
          x = h.x + Math.sin(t * h.f + h.ph) * h.sw;
        const fade = clamp01(y / 300) * clamp01((H + 100 - y) / 200);
        ctx.globalAlpha = 0.75 * fade;
        ctx.fillStyle = h.c;
        const beat = 1 + 0.06 * Math.sin(t * 4 + h.ph);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(t + h.ph) * 0.3);
        ctx.scale(beat, beat);
        heartPath(ctx, 0, -h.s / 2, h.s);
        ctx.fill();
        ctx.restore();
      });
      ctx.globalAlpha = 1;
    }
  },
  {
    id: "watercolor",
    name: "Watercolor",
    swatch: "#3E9C91",
    env: "#3E9C91",
    head: '400 {s}px "Young Serif", Georgia, serif',
    headColor: "#1F3B45",
    body: "#2F4650",
    sign: "#2E8C82",
    ring: "#FFFFFF",
    plate: null,
    draw(ctx, t) {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, W, H);
      const blob = (x: number, y: number, rad: number, c: string) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, c + "B3");
        g.addColorStop(0.6, c + "55");
        g.addColorStop(1, c + "00");
        ctx.fillStyle = g;
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      };
      const d = (i: number, a: number) => Math.sin(t * 0.35 + i * 1.9) * a;
      blob(120 + d(1, 60), 120 + d(2, 50), 420, "#7FD1C7");
      blob(420 + d(3, 80), -40 + d(4, 40), 320, "#B9A7F2");
      blob(W - 60 + d(5, 50), 260 + d(6, 70), 300, "#FFC8A8");
      blob(W - 140 + d(7, 60), H - 120 + d(8, 50), 440, "#B9A7F2");
      blob(140 + d(9, 70), H - 40 + d(10, 40), 340, "#FFC8A8");
      blob(W - 420 + d(11, 80), H + 20 + d(12, 30), 280, "#7FD1C7");
      ctx.drawImage(paperTexture(), 0, 0);
    }
  }
];

export const designById = (id: string): Design => DESIGNS.find((d) => d.id === id) || DESIGNS[0];
