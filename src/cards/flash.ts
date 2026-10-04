import type { Ctx, FlashCard } from "../core/types";
import { W, TAU, rng, pick, clamp01, easeIn, easeInOut, easeBack, shade } from "../core/math";
import { heartPath, sparkle, rrect, wrapLines } from "../core/draw";
import { state } from "../state";
import { CONF_COLS, designById, type Design } from "./designs";

/* ---------- Flash cards ---------- */
export const CW = 820,
  CH = 1040,
  CCX = W / 2,
  CCY = 690;

const paperOf = (d: Design) =>
  d.id === "golden" ? { fill: "#18214A", edge: "#C9A659" } : { fill: d.id === "floral" ? "#FFFBF8" : "#FFFFFF", edge: d.sign };
const font = (d: Design, s: number) => d.head.replace("{s}", String(s));

function fitText(ctx: Ctx, text: string, mk: (s: number) => string, maxW: number, maxLines: number, start: number, min: number, step: number) {
  let s = start,
    lines: string[];
  do {
    ctx.font = mk(s);
    lines = wrapLines(ctx, text, maxW);
    s -= step;
  } while ((lines.length > maxLines || lines.some((l) => ctx.measureText(l).width > maxW)) && s >= min);
  s += step;
  ctx.font = mk(s);
  return { size: s, lines: wrapLines(ctx, text, maxW) };
}

function ornament(ctx: Ctx, d: Design, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = d.sign;
  ctx.strokeStyle = d.sign;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x - 100, y);
  ctx.lineTo(x - 24, y);
  ctx.moveTo(x + 24, y);
  ctx.lineTo(x + 100, y);
  ctx.stroke();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-8, -8, 16, 16);
  ctx.restore();
}

function headFill(ctx: Ctx, d: Design): string | CanvasGradient {
  if (d.headColor !== "gold") return d.headColor;
  const g = ctx.createLinearGradient(80, 0, CW - 80, 0);
  g.addColorStop(0, "#C9A24E");
  g.addColorStop(0.5, "#F6E2A8");
  g.addColorStop(1, "#C9A24E");
  return g;
}

// Draw one card's face into its own canvas (cached; reused every frame)
function renderCardFace(d: Design, card: FlashCard, idx: number, total: number, photo: HTMLCanvasElement | null): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = CW;
  c.height = CH;
  const ctx = c.getContext("2d")!,
    P = paperOf(d),
    cx = CW / 2,
    maxW = CW - 150;
  rrect(ctx, 0, 0, CW, CH, 36);
  ctx.fillStyle = P.fill;
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = d.id === "golden" ? 0.9 : 0.35;
  ctx.strokeStyle = P.edge;
  ctx.lineWidth = 3;
  rrect(ctx, 26, 26, CW - 52, CH - 52, 22);
  ctx.stroke();
  ctx.restore();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  if (card.type === "title") {
    let y: number;
    const head = fitText(ctx, card.text, (s) => font(d, s), maxW, 3, photo ? 96 : 116, 52, 4);
    const lh = head.size * 1.14,
      headH = head.lines.length * lh;
    if (photo) {
      const r = 165,
        blockH = r * 2 + 90 + headH + 90,
        top = (CH - blockH) / 2;
      const py = top + r;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.2)";
      ctx.shadowBlur = 26;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = d.id === "golden" ? "#C9A659" : shade(d.env, 1.55);
      ctx.beginPath();
      ctx.arc(cx, py, r + 12, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, py, r, 0, TAU);
      ctx.clip();
      const pw = photo.width,
        ph = photo.height,
        sc = Math.max((2 * r) / pw, (2 * r) / ph);
      ctx.drawImage(photo, cx - (pw * sc) / 2, py - (ph * sc) / 2, pw * sc, ph * sc);
      ctx.restore();
      y = py + r + 90;
    } else {
      y = (CH - headH - 90) / 2 + head.size * 0.4;
      // sparkle accents above the headline
      ctx.fillStyle = d.sign;
      ctx.globalAlpha = 0.8;
      sparkle(ctx, cx - 70, y - 120, 18);
      sparkle(ctx, cx, y - 150, 26);
      sparkle(ctx, cx + 70, y - 120, 18);
      ctx.globalAlpha = 1;
    }
    ctx.font = font(d, head.size);
    ctx.fillStyle = headFill(ctx, d);
    head.lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lh));
    ornament(ctx, d, cx, y + (head.lines.length - 1) * lh + 70);
  } else if (card.type === "msg") {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = d.sign;
    ctx.font = '400 260px "Young Serif", Georgia, serif';
    ctx.fillText("“", 150, 290);
    ctx.restore();
    const body = fitText(ctx, card.text, (s) => `500 ${s}px "Figtree", system-ui, sans-serif`, maxW, 8, 74, 34, 2);
    const lh = body.size * 1.45,
      bh = body.lines.length * lh;
    const y = (CH - bh) / 2 + body.size * 0.9;
    ctx.fillStyle = d.body;
    body.lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lh));
  } else {
    ctx.fillStyle = d.sign;
    const hs = 90;
    ctx.save();
    ctx.globalAlpha = 0.9;
    heartPath(ctx, cx, CH / 2 - 260, hs);
    ctx.fill();
    ctx.restore();
    const sg = fitText(ctx, card.text, (s) => `600 ${s}px "Caveat", "Segoe Script", cursive`, maxW, 4, 110, 60, 4);
    const lh = sg.size * 1.1,
      bh = sg.lines.length * lh;
    const y = CH / 2 - bh / 2 + sg.size * 0.75 + 40;
    ctx.fillStyle = d.sign;
    sg.lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lh));
  }
  // progress dots: which card of how many
  const gap = 30,
    x0 = cx - ((total - 1) * gap) / 2;
  for (let i = 0; i < total; i++) {
    ctx.beginPath();
    ctx.arc(x0 + i * gap, CH - 62, i === idx ? 8 : 6, 0, TAU);
    ctx.fillStyle = d.sign;
    ctx.globalAlpha = i === idx ? 1 : 0.3;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return c;
}

/** Rebuild the flash-card faces from the current text, design and photo. */
export function buildCards(): void {
  const t = state.text;
  if (!t) {
    state.cards = [];
    return;
  }
  const d = designById(state.design);
  const list: FlashCard[] = [{ type: "title", text: t.headline || "" }];
  (t.cards || [])
    .filter((s) => s && s.trim())
    .slice(0, 2)
    .forEach((m) => list.push({ type: "msg", text: m.trim() }));
  if (t.signoff && t.signoff.trim()) list.push({ type: "sign", text: t.signoff.trim() });
  state.cards = list.map((c, i) => ({ ...c, face: renderCardFace(d, c, i, list.length, state.photo) }));
}

/* ---------- Story timeline (seconds) ---------- */
const T_FLAP = 0.9,
  T_RISE = 1.6,
  T_DROP = 2.4,
  T_SETTLE = 2.6,
  HOLD = 2.8,
  SWIPE = 0.75;
export const T_IN = 3.3;
export const cardStart = (k: number): number => T_IN + k * HOLD;
export const flashLength = (): number => cardStart(Math.max(0, state.cards.length - 1)) + 3.2;

export function drawCardAt(ctx: Ctx, face: HTMLCanvasElement, x: number, y: number, s: number, rot: number, alpha: number, shadow: boolean): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  if (shadow) {
    ctx.shadowColor = "rgba(15,20,40,.35)";
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 22;
  }
  ctx.drawImage(face, -CW / 2, -CH / 2);
  ctx.restore();
}
function drawBlank(ctx: Ctx, d: Design, x: number, y: number, s: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.shadowColor = "rgba(15,20,40,.25)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  rrect(ctx, -CW / 2, -CH / 2, CW, CH, 36);
  ctx.fillStyle = shade(paperOf(d).fill === "#18214A" ? "#18214A" : "#FFFFFF", 0.96);
  ctx.fill();
  ctx.restore();
}

function drawEnvelope(ctx: Ctx, d: Design, e: number, cardFace: HTMLCanvasElement | null, name: string): boolean {
  const EW = 780,
    EH = 520;
  const drop = 820 * easeIn((e - T_DROP) / 0.75),
    alpha = 1 - clamp01((e - T_DROP - 0.35) / 0.5);
  if (alpha <= 0) return false;
  const cx = W / 2,
    cy = 860 + drop,
    L = cx - EW / 2,
    R = cx + EW / 2,
    top = cy - EH / 2,
    bot = cy + EH / 2;
  const p = easeInOut((e - T_FLAP) / 0.7);
  const apex = top + EH * 0.56 * Math.cos(Math.PI * p);
  const col = d.env;
  ctx.save();
  ctx.globalAlpha = alpha;
  // back
  ctx.save();
  ctx.shadowColor = "rgba(15,20,40,.35)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  rrect(ctx, L, top, EW, EH, 18);
  ctx.fillStyle = shade(col, 0.78);
  ctx.fill();
  ctx.restore();
  const flap = (fill: string) => {
    ctx.beginPath();
    ctx.moveTo(L + 6, top + 2);
    ctx.lineTo(R - 6, top + 2);
    ctx.lineTo(cx, apex);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  if (p >= 0.5) flap(shade(col, 0.7));
  // card rising out of the envelope
  if (cardFace && e > T_FLAP + 0.4) {
    const rise = easeInOut((e - T_RISE) / 0.9);
    const y0 = top + 40 + CH * 0.42,
      y1 = 470;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, bot - 4);
    ctx.clip();
    drawCardAt(ctx, cardFace, cx, y0 + (y1 - y0) * rise + drop * 0.15, 0.84, 0, 1, false);
    ctx.restore();
  }
  // front pocket
  const vy = top + EH * 0.58;
  ctx.beginPath();
  ctx.moveTo(L, top + 18);
  ctx.lineTo(cx, vy);
  ctx.lineTo(R, top + 18);
  ctx.lineTo(R, bot - 18);
  ctx.arcTo(R, bot, R - 18, bot, 18);
  ctx.lineTo(L + 18, bot);
  ctx.arcTo(L, bot, L, bot - 18, 18);
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
  ctx.strokeStyle = shade(col, 0.86);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(L + 10, bot - 10);
  ctx.lineTo(cx - 40, vy + 40);
  ctx.moveTo(R - 10, bot - 10);
  ctx.lineTo(cx + 40, vy + 40);
  ctx.stroke();
  if (name) {
    ctx.fillStyle = "#FFFFFF";
    ctx.globalAlpha = alpha * 0.95;
    ctx.textAlign = "center";
    ctx.font = '600 70px "Caveat", "Segoe Script", cursive';
    ctx.fillText("For " + name, cx, bot - 70);
    ctx.globalAlpha = alpha;
  }
  if (p < 0.5) flap(shade(col, 0.9));
  // wax seal
  const sealA = 1 - clamp01((e - T_FLAP) / 0.25);
  if (sealA > 0) {
    const pulse = e < T_FLAP ? 1 + 0.06 * Math.sin(e * 7) : 1;
    ctx.save();
    ctx.globalAlpha = alpha * sealA;
    ctx.translate(cx, apex - 6);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = "rgba(0,0,0,.3)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = "#B3263A";
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, TAU);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#F7D9DE";
    heartPath(ctx, 0, -20, 40);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  return true;
}

function burst(ctx: Ctx, tau: number) {
  if (tau < 0 || tau > 1.8) return;
  const r = rng(17);
  for (let i = 0; i < 70; i++) {
    const a = r() * TAU,
      v = 500 + r() * 700,
      c = pick(r, CONF_COLS),
      sz = 8 + r() * 10;
    const x = CCX + Math.cos(a) * v * tau,
      y = CCY - 80 + Math.sin(a) * v * tau + 500 * tau * tau;
    ctx.save();
    ctx.globalAlpha = 1 - tau / 1.8;
    ctx.translate(x, y);
    ctx.rotate(tau * 8 + i);
    ctx.fillStyle = c;
    if (i % 3) ctx.fillRect(-sz, -sz / 2, sz * 2, sz);
    else {
      ctx.beginPath();
      ctx.arc(0, 0, sz * 0.7, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function drawStory(ctx: Ctx, d: Design, e: number, name: string): void {
  const cards = state.cards,
    N = cards.length;
  if (!N) {
    drawEnvelope(ctx, d, Math.min(e, 0), null, name);
    return;
  }
  // stage 1: envelope opening, first card rising
  if (e < T_SETTLE + 0.01) {
    drawEnvelope(ctx, d, e, cards[0].face, name);
    return;
  }
  // stage 2: first card settles, envelope drops away underneath
  const settle = easeInOut((e - T_SETTLE) / (T_IN - T_SETTLE));
  // remaining-card stack behind the current card
  let cur = 0;
  for (let k = 1; k < N; k++) if (e >= cardStart(k) - SWIPE) cur = k;
  drawEnvelope(ctx, d, e, null, name);
  const left = N - 1 - cur;
  if (settle >= 1) for (let j = Math.min(left, 2); j >= 1; j--) drawBlank(ctx, d, CCX + j * 14, CCY + j * 16, 1, j * 0.035);
  if (cur === 0) {
    const s = 0.84 + 0.16 * settle,
      y = 470 + (CCY - 470) * settle;
    drawCardAt(ctx, cards[0].face, CCX, y, s, 0, 1, true);
  } else {
    const q = clamp01((e - (cardStart(cur) - SWIPE)) / SWIPE);
    const inP = easeBack(q),
      outP = easeIn(q);
    drawCardAt(ctx, cards[cur].face, CCX + (1 - inP) * W * 0.95, CCY + (1 - inP) * 40, 1, (1 - inP) * 0.22, 1, true);
    if (outP < 1) drawCardAt(ctx, cards[cur - 1].face, CCX - outP * W * 1.05, CCY - outP * 60, 1, -outP * 0.3, 1, true);
  }
  if (N > 1) burst(ctx, e - cardStart(N - 1));
}
