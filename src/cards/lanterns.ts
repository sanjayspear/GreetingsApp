import type { Ctx } from "../core/types";
import { W, H, TAU, rng, pick, seeds, clamp01, easeOut, easeIn, easeInOut, mod } from "../core/math";
import { wrapLines } from "../core/draw";
import { state } from "../state";

/* ================= NIGHT OF LANTERNS ================= */
const HZ = 1060; // horizon (water line)
export const LT = { FADE: 1.2, FIRST: 2.0, GAP: 3.1, RISE: 1.7, TXT_IN: 1.0 };

interface Block {
  lines: string[];
  size: number;
  style: string | undefined;
}
interface NameParticle {
  tx: number;
  ty: number;
  b: number;
  ox: number;
  oy: number;
  d: number;
  ph: number;
}
export interface LanternLayout {
  blocks: Block[];
  targets: NameParticle[];
  sign: string[];
  /** Time the fireworks start. */
  F: number;
  end: number;
}

function lanternSprite(size: number, bright: number): HTMLCanvasElement {
  const w = Math.round(size * 2.4),
    h = Math.round(size * 2.8),
    c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d")!,
    cx = w / 2,
    cy = h / 2;
  const glow = x.createRadialGradient(cx, cy + size * 0.1, 0, cx, cy + size * 0.1, w / 2);
  glow.addColorStop(0, `rgba(255,190,100,${0.55 * bright})`);
  glow.addColorStop(0.35, `rgba(255,150,60,${0.22 * bright})`);
  glow.addColorStop(1, "rgba(255,120,40,0)");
  x.fillStyle = glow;
  x.fillRect(0, 0, w, h);
  const bw = size * 0.62,
    tw = size * 0.5,
    bh = size,
    top = cy - bh / 2,
    bot = cy + bh / 2;
  x.beginPath();
  x.moveTo(cx - tw / 2, top);
  x.quadraticCurveTo(cx, top - size * 0.08, cx + tw / 2, top);
  x.quadraticCurveTo(cx + bw / 2 + size * 0.08, cy, cx + bw / 2, bot);
  x.quadraticCurveTo(cx, bot + size * 0.05, cx - bw / 2, bot);
  x.quadraticCurveTo(cx - bw / 2 - size * 0.08, cy, cx - tw / 2, top);
  x.closePath();
  const body = x.createLinearGradient(0, top, 0, bot);
  body.addColorStop(0, "#E8742C");
  body.addColorStop(0.45, "#FFB04A");
  body.addColorStop(1, "#FFD98A");
  x.fillStyle = body;
  x.fill();
  x.save();
  x.clip();
  const core = x.createRadialGradient(cx, bot - bh * 0.18, 0, cx, bot - bh * 0.18, bh * 0.7);
  core.addColorStop(0, "rgba(255,250,220,.95)");
  core.addColorStop(0.5, "rgba(255,220,140,.35)");
  core.addColorStop(1, "rgba(255,200,120,0)");
  x.fillStyle = core;
  x.fillRect(0, 0, w, h);
  x.strokeStyle = "rgba(150,60,20,.25)";
  x.lineWidth = Math.max(1, size * 0.02);
  [-0.18, 0, 0.18].forEach((f) => {
    x.beginPath();
    x.moveTo(cx + f * tw, top);
    x.quadraticCurveTo(cx + f * bw * 1.35, cy, cx + f * bw, bot);
    x.stroke();
  });
  x.restore();
  x.fillStyle = "#7A3410";
  x.fillRect(cx - tw / 2, top - size * 0.03, tw, size * 0.05);
  x.fillStyle = "rgba(255,245,200,.9)";
  x.beginPath();
  x.ellipse(cx, bot, bw * 0.38, size * 0.05, 0, 0, TAU);
  x.fill();
  return c;
}
let SPR: { small: HTMLCanvasElement; hero: HTMLCanvasElement } | null = null;
function sprites() {
  if (!SPR) SPR = { small: lanternSprite(40, 0.9), hero: lanternSprite(120, 1) };
  return SPR;
}

let skyStatic: HTMLCanvasElement | null = null,
  grainPat: HTMLCanvasElement | null = null;
function buildSkyStatic(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 0, HZ);
  g.addColorStop(0, "#070B24");
  g.addColorStop(0.45, "#15184A");
  g.addColorStop(0.78, "#3B2463");
  g.addColorStop(1, "#7A3E6E");
  x.fillStyle = g;
  x.fillRect(0, 0, W, HZ);
  const band = x.createLinearGradient(0, 100, W, 700);
  band.addColorStop(0, "rgba(160,150,255,0)");
  band.addColorStop(0.5, "rgba(170,160,255,.10)");
  band.addColorStop(1, "rgba(160,150,255,0)");
  x.fillStyle = band;
  x.fillRect(0, 0, W, HZ);
  const hz = x.createRadialGradient(W / 2, HZ, 0, W / 2, HZ, 700);
  hz.addColorStop(0, "rgba(255,150,110,.35)");
  hz.addColorStop(1, "rgba(255,150,110,0)");
  x.fillStyle = hz;
  x.fillRect(0, HZ - 700, W, 700);
  const hills = (seed: number, base: number, amp: number, col: string) => {
    const r = rng(seed);
    x.fillStyle = col;
    x.beginPath();
    x.moveTo(0, HZ);
    let y = base;
    for (let px = 0; px <= W; px += 40) {
      y += (r() - 0.5) * amp;
      y = Math.min(HZ - 10, Math.max(base - amp * 2, y));
      x.lineTo(px, y);
    }
    x.lineTo(W, HZ);
    x.closePath();
    x.fill();
  };
  hills(31, HZ - 70, 30, "#1D1840");
  hills(37, HZ - 30, 22, "#120F2C");
  return c;
}
function grain(): HTMLCanvasElement {
  if (grainPat) return grainPat;
  const c = document.createElement("canvas");
  c.width = c.height = 200;
  const x = c.getContext("2d")!,
    id = x.createImageData(200, 200),
    r = rng(77);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = r() * 255;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
    id.data[i + 3] = 22;
  }
  x.putImageData(id, 0, 0);
  grainPat = c;
  return c;
}
const lStars = seeds(230, 41, (r) => ({ x: r() * W, y: r() * (HZ - 120), s: 0.6 + r() * 2.2, f: 0.4 + r() * 2.4, ph: r() * TAU }));
const ambient = seeds(38, 43, (r) => ({
  x: r() * W,
  y0: r() * 1400,
  z: 0.25 + r() * 0.75,
  sw: 10 + r() * 30,
  f: 0.2 + r() * 0.4,
  ph: r() * TAU,
  fl: 3 + r() * 5
})).sort((a, b) => a.z - b.z);

// Layout: hero lines, name particle targets
let LL: LanternLayout | null = null;
export const getLanternLayout = (): LanternLayout | null => LL;

export function buildLanternLayout(name: string): void {
  if (!state.text) {
    LL = null;
    return;
  }
  const t = state.text,
    m = document.createElement("canvas").getContext("2d")!;
  const blocks: Block[] = [];
  const mk = (txt: string, size: number, style?: string): Block => {
    m.font = `italic 600 ${size}px "Cormorant Garamond", Georgia, serif`;
    return { lines: wrapLines(m, txt, 860), size, style };
  };
  if (t.headline) blocks.push(mk(t.headline, 92, "head"));
  (t.cards || [])
    .filter(Boolean)
    .slice(0, 2)
    .forEach((c) => {
      let s = 68;
      let b: Block;
      do {
        b = mk(c, s);
        s -= 4;
      } while (b.lines.length > 5 && s > 42);
      blocks.push(b);
    });
  const who = name || "You";
  // sample name into particle targets
  const nc = document.createElement("canvas");
  nc.width = W;
  nc.height = 320;
  const nx = nc.getContext("2d", { willReadFrequently: true })!;
  let ns = 230;
  do {
    nx.font = `italic 700 ${ns}px "Cormorant Garamond", Georgia, serif`;
    ns -= 10;
  } while (nx.measureText(who).width > 900 && ns > 90);
  nx.textAlign = "center";
  nx.textBaseline = "middle";
  nx.fillStyle = "#fff";
  nx.fillText(who, W / 2, 160);
  const data = nx.getImageData(0, 0, W, 320).data,
    pts: [number, number][] = [],
    step = 6;
  for (let y = 0; y < 320; y += step) for (let x = 0; x < W; x += step) if (data[(y * W + x) * 4 + 3] > 140) pts.push([x, y + 400]);
  const r = rng(53);
  for (let i = pts.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pts[i], pts[j]] = [pts[j], pts[i]];
  }
  const targets = pts.slice(0, 1100).map((p) => ({ tx: p[0], ty: p[1], b: Math.floor(r() * 3), ox: (r() - 0.5) * 260, oy: (r() - 0.5) * 260, d: r() * 0.5, ph: r() * TAU }));
  const F = LT.FIRST + blocks.length * LT.GAP + 0.8;
  LL = { blocks, targets, sign: (t.signoff || "").split("\n").filter(Boolean), F, end: F + 8.2 };
}
export const lanternLength = (): number => (LL ? LL.end : 20);

const ROCKETS = [
  { x: 330, y: 380, L: 0 },
  { x: 760, y: 330, L: 0.45 },
  { x: 540, y: 470, L: 0.9 }
];
const BURST_COLS = ["#FFD27A", "#FF9FB2", "#9FE7FF", "#FFF1C8"];
const burstPts = seeds(80, 61, (r) => ({ a: r() * TAU, v: 260 + r() * 340, c: pick(r, BURST_COLS) }));

function drawSky(x: Ctx, t: number, e: number, F: number) {
  if (!skyStatic) skyStatic = buildSkyStatic();
  x.drawImage(skyStatic, 0, 0);
  lStars.forEach((s) => {
    x.fillStyle = `rgba(255,248,230,${0.15 + 0.8 * (0.5 + 0.5 * Math.sin(t * s.f + s.ph))})`;
    x.beginPath();
    x.arc(s.x, s.y, s.s, 0, TAU);
    x.fill();
  });
  // moon (becomes their photo in the finale)
  const mx = 830,
    my = 210,
    mr = 86,
    photoA = state.photo && LL ? easeOut((e - F - 1.2) / 1.6) : 0;
  x.save();
  const mg = x.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 2.6);
  mg.addColorStop(0, "rgba(255,236,190,.35)");
  mg.addColorStop(1, "rgba(255,236,190,0)");
  x.fillStyle = mg;
  x.fillRect(mx - mr * 3, my - mr * 3, mr * 6, mr * 6);
  x.beginPath();
  x.arc(mx, my, mr, 0, TAU);
  x.clip();
  const mf = x.createRadialGradient(mx - 25, my - 25, 10, mx, my, mr);
  mf.addColorStop(0, "#FFF8E4");
  mf.addColorStop(1, "#E9D6A8");
  x.fillStyle = mf;
  x.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
  x.fillStyle = "rgba(190,165,120,.35)";
  [
    [-25, 10, 16],
    [20, -22, 11],
    [28, 28, 9],
    [-8, -35, 7]
  ].forEach(([dx, dy, rr]) => {
    x.beginPath();
    x.arc(mx + dx, my + dy, rr, 0, TAU);
    x.fill();
  });
  if (photoA > 0 && state.photo) {
    const p = state.photo,
      sc = Math.max((2 * mr) / p.width, (2 * mr) / p.height);
    x.globalAlpha = photoA;
    x.drawImage(p, mx - (p.width * sc) / 2, my - (p.height * sc) / 2, p.width * sc, p.height * sc);
    const v = x.createRadialGradient(mx, my, mr * 0.55, mx, my, mr);
    v.addColorStop(0, "rgba(255,220,160,0)");
    v.addColorStop(1, "rgba(255,200,130,.55)");
    x.fillStyle = v;
    x.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
  }
  x.restore();
  // ambient lanterns
  const S = sprites();
  x.save();
  x.globalCompositeOperation = "lighter";
  ambient.forEach((a) => {
    const span = HZ + 260,
      y = HZ + 60 - mod(a.y0 + t * (14 + 34 * a.z), span),
      xx = a.x + Math.sin(t * a.f + a.ph) * a.sw;
    const s = 0.35 + a.z * 0.75,
      fade = clamp01((HZ + 40 - y) / 120) * clamp01((y + 80) / 260);
    x.globalAlpha = fade * (0.55 + 0.45 * a.z) * (0.85 + 0.15 * Math.sin(t * a.fl + a.ph));
    const w = S.small.width * s,
      h = S.small.height * s;
    x.drawImage(S.small, xx - w / 2, y - h / 2, w, h);
  });
  x.restore();
  if (!LL) return;
  // hero lanterns (one per message)
  x.save();
  x.globalCompositeOperation = "lighter";
  LL.blocks.forEach((_b, i) => {
    const r0 = LT.FIRST + i * LT.GAP,
      k = e - r0;
    if (k < 0) return;
    const sx = i % 2 ? 690 : 390,
      rise = easeOut(k / LT.RISE);
    const y = HZ + 40 - (HZ + 40 - 300) * rise - Math.max(0, k - LT.RISE) * 38;
    const xx = sx + Math.sin(k * 0.7 + i) * 18 + (W / 2 - sx) * 0.15 * rise;
    const s = 0.8 + 0.35 * rise - Math.max(0, k - LT.RISE) * 0.045;
    if (s <= 0.1 || y < -200) return;
    x.globalAlpha = clamp01(k / 0.4) * (0.9 + 0.1 * Math.sin(k * 9 + i));
    const w = S.hero.width * s,
      h = S.hero.height * s;
    x.drawImage(S.hero, xx - w / 2, y - h / 2, w, h);
  });
  // fireworks
  ROCKETS.forEach((rk) => {
    const k = e - F - rk.L;
    if (k < 0) return;
    if (k < 1) {
      const p = easeOut(k),
        yy = HZ - (HZ - rk.y) * p;
      const tr = x.createLinearGradient(rk.x, yy + 160, rk.x, yy);
      tr.addColorStop(0, "rgba(255,210,140,0)");
      tr.addColorStop(1, "rgba(255,230,180,.95)");
      x.globalAlpha = 1;
      x.strokeStyle = tr;
      x.lineWidth = 4;
      x.beginPath();
      x.moveTo(rk.x, Math.min(HZ, yy + 160));
      x.lineTo(rk.x, yy);
      x.stroke();
    } else if (k < 3.2) {
      const tau = k - 1;
      burstPts.forEach((bp) => {
        const px = rk.x + Math.cos(bp.a) * bp.v * tau * (1 - tau * 0.18),
          py = rk.y + Math.sin(bp.a) * bp.v * tau * (1 - tau * 0.18) + 90 * tau * tau;
        x.globalAlpha = Math.max(0, 1 - tau / 2.2);
        x.fillStyle = bp.c;
        x.beginPath();
        x.arc(px, py, 3.2, 0, TAU);
        x.fill();
        x.globalAlpha *= 0.25;
        x.beginPath();
        x.arc(px, py, 9, 0, TAU);
        x.fill();
      });
      if (tau < 0.25) {
        x.globalAlpha = 1 - tau / 0.25;
        const fl = x.createRadialGradient(rk.x, rk.y, 0, rk.x, rk.y, 260);
        fl.addColorStop(0, "rgba(255,240,210,.8)");
        fl.addColorStop(1, "rgba(255,240,210,0)");
        x.fillStyle = fl;
        x.fillRect(rk.x - 260, rk.y - 260, 520, 520);
      }
    }
  });
  x.restore();
}

let skyLayer: HTMLCanvasElement | null = null;
export function paintLanterns(ctx: Ctx, t: number, e: number): void {
  if (!skyLayer) {
    skyLayer = document.createElement("canvas");
    skyLayer.width = W;
    skyLayer.height = HZ;
  }
  const sx = skyLayer.getContext("2d")!,
    F = LL ? LL.F : 1e9;
  drawSky(sx, t, e, F);
  ctx.drawImage(skyLayer, 0, 0);
  // lake reflection with ripples
  ctx.fillStyle = "#0A0B22";
  ctx.fillRect(0, HZ, W, H - HZ);
  const strips = 46,
    wh = H - HZ,
    sh = wh / strips;
  ctx.save();
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < strips; i++) {
    const dy = i * sh,
      srcY = HZ - (dy / wh) * 520 - 2,
      off = Math.sin(i * 0.9 + t * 2.2) * (2 + i * 0.25);
    ctx.save();
    ctx.translate(off, HZ + dy + sh);
    ctx.scale(1, -1);
    ctx.drawImage(skyLayer, 0, srcY - 520 / strips, W, 520 / strips + 1, 0, 0, W, sh + 1);
    ctx.restore();
  }
  ctx.restore();
  const wg = ctx.createLinearGradient(0, HZ, 0, H);
  wg.addColorStop(0, "rgba(10,11,34,.15)");
  wg.addColorStop(1, "rgba(5,6,20,.85)");
  ctx.fillStyle = wg;
  ctx.fillRect(0, HZ, W, H - HZ);
  ctx.fillStyle = "rgba(255,200,150,.35)";
  ctx.fillRect(0, HZ, W, 2);

  if (LL) {
    const ll = LL;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    // message lines, each carried by a lantern
    ll.blocks.forEach((b, i) => {
      const r0 = LT.FIRST + i * LT.GAP,
        k = e - r0 - LT.TXT_IN,
        next = i < ll.blocks.length - 1 ? LT.GAP - LT.TXT_IN : ll.F - r0 - LT.TXT_IN;
      const aIn = easeOut(k / 0.9),
        aOut = 1 - easeIn((k - next + 0.5) / 0.7),
        a = Math.min(aIn, aOut);
      if (a <= 0) return;
      const lh = b.size * 1.18,
        total = b.lines.length * lh,
        y0 = 640 - total / 2 + b.size * 0.8 + (1 - aIn) * 30 - (1 - aOut) * 40;
      ctx.save();
      ctx.globalAlpha = a * 0.55;
      const dk = ctx.createRadialGradient(W / 2, 640, 40, W / 2, 640, 520);
      dk.addColorStop(0, "rgba(8,8,30,.75)");
      dk.addColorStop(1, "rgba(8,8,30,0)");
      ctx.fillStyle = dk;
      ctx.fillRect(0, 640 - 520, W, 1040);
      ctx.restore();
      ctx.font = `italic 600 ${b.size}px "Cormorant Garamond", Georgia, serif`;
      ctx.shadowColor = "rgba(255,180,90,.85)";
      ctx.shadowBlur = 28;
      b.lines.forEach((l, j) => {
        const la = clamp01((k - j * 0.22) / 0.7) * aOut;
        if (la <= 0) return;
        ctx.globalAlpha = la;
        ctx.fillStyle = b.style === "head" ? "#FFE3A6" : "#FFF4DE";
        ctx.fillText(l, W / 2, y0 + j * lh);
      });
    });
    ctx.shadowBlur = 0;
    // finale: fireworks dissolve into their name
    const f0 = e - ll.F - 1.6;
    if (f0 > 0) {
      ctx.globalCompositeOperation = "lighter";
      ll.targets.forEach((p) => {
        const rk = ROCKETS[p.b],
          q = easeInOut((f0 - p.d) / 1.6);
        const sx0 = rk.x + p.ox,
          sy0 = rk.y + p.oy;
        const px = sx0 + (p.tx - sx0) * q + Math.sin(e * 2 + p.ph) * 1.5 * q,
          py = sy0 + (p.ty - sy0) * q + Math.cos(e * 2.3 + p.ph) * 1.5 * q;
        const tw = 0.65 + 0.35 * Math.sin(e * 5 + p.ph);
        ctx.globalAlpha = clamp01((f0 - p.d) / 0.3) * tw;
        ctx.fillStyle = "#FFE7B0";
        ctx.beginPath();
        ctx.arc(px, py, 2.6, 0, TAU);
        ctx.fill();
        ctx.globalAlpha *= 0.22;
        ctx.fillStyle = "#FFB45E";
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, TAU);
        ctx.fill();
      });
      ctx.globalCompositeOperation = "source-over";
      // sign-off written in light
      const s0 = f0 - 2.0;
      if (s0 > 0 && ll.sign.length) {
        ctx.font = '600 76px "Caveat", "Segoe Script", cursive';
        ctx.fillStyle = "#FFE3A6";
        ctx.shadowColor = "rgba(255,180,90,.8)";
        ctx.shadowBlur = 20;
        ll.sign.forEach((l, j) => {
          const p = clamp01((s0 - j * 0.9) / 1.1);
          if (p <= 0) return;
          const w = ctx.measureText(l).width + 20,
            y = 830 + j * 84;
          ctx.save();
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.rect(W / 2 - w / 2, y - 80, w * p, 110);
          ctx.clip();
          ctx.fillText(l, W / 2, y);
          ctx.restore();
        });
        ctx.shadowBlur = 0;
      }
    }
    ctx.restore();
  }
  // opening fade from black + vignette + film grain
  if (e >= 0 && e < LT.FADE) {
    ctx.fillStyle = `rgba(0,0,0,${1 - easeOut(e / LT.FADE)})`;
    ctx.fillRect(0, 0, W, H);
  }
  const vg = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.35, W / 2, H * 0.5, H * 0.85);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,.45)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = ctx.createPattern(grain(), "repeat")!;
  ctx.translate(Math.floor(t * 997) % 200, Math.floor(t * 613) % 200);
  ctx.fillRect(-200, -200, W + 400, H + 400);
  ctx.restore();
}
