import type { Ctx, SurpriseData } from "../core/types";
import { W, H, TAU, rng, pick, clamp01, easeOut, easeBack } from "../core/math";
import { heartPath, rrect, wrapLines } from "../core/draw";

// The interactive "gift -> candles/balloons -> scratch card -> finale" mini-game.
// This file is also bundled on its own into the exported surprise HTML (see plugins/giftEngine.ts),
// so it must stay free of app state and DOM lookups.

const SERIF = '"Cormorant Garamond", "Playfair Display", Georgia, serif';
const SANS = '"Figtree", system-ui, sans-serif';
const HAND = '"Caveat", "Segoe Script", cursive';
const CONF = ["#FFD166", "#EF476F", "#06D6A0", "#118AB2", "#FF9F1C", "#F7AEF8", "#FFFFFF"];

function fit(ctx: Ctx, text: string, mk: (s: number) => string, maxW: number, maxLines: number, start: number, min: number) {
  let s = start,
    L: string[];
  do {
    ctx.font = mk(s);
    L = wrapLines(ctx, text, maxW);
    s -= 3;
  } while (L.length > maxLines && s >= min);
  ctx.font = mk(s + 3);
  return { size: s + 3, lines: L };
}

function shadeC(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16),
    r = n >> 16,
    g = (n >> 8) & 255,
    b = n & 255;
  return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
}

/* ----- Sound (optional, created by the host on first tap) ----- */
export type SfxName = "tap" | "open" | "blow" | "pop" | "scratch" | "chime" | "boom" | "tada";

export interface SurpriseAudio {
  resume(): void;
  sfx(name: string): void;
  music(): Promise<void>;
  setOn(v: boolean): void;
  stop(): void;
}

export function createAudio(): SurpriseAudio | null {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const ac = new AC(),
    out = ac.createGain();
  out.gain.value = 0.9;
  out.connect(ac.destination);
  let on = true,
    musicSrc: AudioBufferSourceNode | null = null;
  const noise = (() => {
    const b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate),
      d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  })();
  const tone = (f: number, t: number, dur: number, vol: number, type?: OscillatorType) => {
    const o = ac.createOscillator(),
      g = ac.createGain();
    o.type = type || "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  const hiss = (t: number, dur: number, vol: number, freq: number, q: number) => {
    const s = ac.createBufferSource(),
      f = ac.createBiquadFilter(),
      g = ac.createGain();
    s.buffer = noise;
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = q || 1;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(out);
    s.start(t);
    s.stop(t + dur + 0.05);
  };
  const hz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
  const SFX: Record<SfxName, (t: number) => void> = {
    tap: (t) => {
      tone(660, t, 0.15, 0.12, "triangle");
      tone(990, t + 0.03, 0.12, 0.06);
    },
    open: (t) => {
      [72, 76, 79, 84, 88, 91].forEach((n, i) => tone(hz(n), t + i * 0.06, 1.2, 0.1));
      hiss(t, 0.5, 0.15, 3000, 0.7);
    },
    blow: (t) => {
      hiss(t, 0.45, 0.25, 900, 0.6);
    },
    pop: (t) => {
      hiss(t, 0.12, 0.5, 1800, 0.8);
      tone(180, t, 0.1, 0.25, "square");
    },
    scratch: (t) => {
      hiss(t, 0.07, 0.06, 5000, 2);
    },
    chime: (t) => {
      [79, 84, 88, 91].forEach((n, i) => tone(hz(n), t + i * 0.09, 1.6, 0.1));
    },
    boom: (t) => {
      hiss(t, 0.9, 0.35, 400, 0.5);
      tone(70, t, 0.5, 0.25);
      [0, 0.1, 0.2].forEach((d) => hiss(t + 0.3 + d * 2, 0.2, 0.08, 6000, 3));
    },
    tada: (t) => {
      [60, 64, 67, 72].forEach((n) => tone(hz(n), t, 1.8, 0.07, "triangle"));
      [72, 76, 79, 84].forEach((n, i) => tone(hz(n), t + 0.15 + i * 0.08, 1.5, 0.09));
    }
  };
  async function startMusic() {
    if (musicSrc || !on) return;
    const OAC = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    if (!OAC) return;
    const secs = 10,
      o = new OAC(2, 44100 * secs, 44100),
      m = o.createGain();
    m.gain.value = 0.5;
    m.connect(o.destination);
    const prog = [
        [60, 64, 67, 71],
        [57, 60, 64, 67],
        [53, 57, 60, 64],
        [55, 59, 62, 67]
      ],
      mel = [
        [72, 76, 79, 76],
        [72, 69, 72, 76],
        [77, 76, 72, 69],
        [74, 79, 83, 79]
      ];
    prog.forEach((c, i) => {
      const t = i * 2.5;
      c.forEach((n) => {
        const os = o.createOscillator(),
          g = o.createGain();
        os.type = "triangle";
        os.frequency.value = hz(n);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.03, t + 0.8);
        g.gain.linearRampToValueAtTime(0, t + 2.9);
        os.connect(g);
        g.connect(m);
        os.start(t);
        os.stop(t + 3);
      });
      mel[i].forEach((n, j) => {
        const tt = t + 0.3 + j * 0.55,
          os = o.createOscillator(),
          g = o.createGain();
        os.frequency.value = hz(n);
        g.gain.setValueAtTime(0, tt);
        g.gain.linearRampToValueAtTime(0.07, tt + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.6);
        os.connect(g);
        g.connect(m);
        os.start(tt);
        os.stop(tt + 1.7);
      });
    });
    const buf = await o.startRendering();
    if (musicSrc || !on) return;
    musicSrc = ac.createBufferSource();
    musicSrc.buffer = buf;
    musicSrc.loop = true;
    const g = ac.createGain();
    g.gain.value = 0.7;
    musicSrc.connect(g);
    g.connect(out);
    musicSrc.start();
  }
  return {
    resume() {
      if (ac.state === "suspended") ac.resume();
    },
    sfx(name) {
      if (on && name in SFX) SFX[name as SfxName](ac.currentTime);
    },
    music: startMusic,
    setOn(v) {
      on = v;
      out.gain.value = v ? 0.9 : 0;
      if (v) startMusic();
    },
    stop() {
      if (musicSrc) {
        try {
          musicSrc.stop();
        } catch {
          /* already stopped */
        }
        musicSrc = null;
      }
    }
  };
}

/* Shared, lazily built sprites. Every engine instance (including the length simulation and each
   edit-triggered rebuild) reuses them: iOS Safari caps total canvas memory and starts drawing
   blank canvases once it is exceeded. */
let bgCache: HTMLCanvasElement | null = null,
  bokehCache: HTMLCanvasElement | null = null;
function background(): HTMLCanvasElement {
  if (bgCache) return bgCache;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!,
    g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1A0B2E");
  g.addColorStop(0.55, "#3D1450");
  g.addColorStop(1, "#6B1F4F");
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  const v = x.createRadialGradient(W / 2, H * 0.45, 200, W / 2, H * 0.5, H * 0.85);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,.5)");
  x.fillStyle = v;
  x.fillRect(0, 0, W, H);
  return (bgCache = c);
}
function bokehSprite(): HTMLCanvasElement {
  if (bokehCache) return bokehCache;
  const c = document.createElement("canvas");
  c.width = c.height = 200;
  const x = c.getContext("2d")!,
    g = x.createRadialGradient(100, 100, 0, 100, 100, 100);
  g.addColorStop(0, "rgba(255,210,170,.55)");
  g.addColorStop(0.6, "rgba(255,170,150,.18)");
  g.addColorStop(1, "rgba(255,150,150,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 200, 200);
  return (bokehCache = c);
}

/* ----- Engine ----- */
interface Item {
  x: number;
  y: number;
  out: number | null;
  ph: number;
  c?: string;
}
interface Firework {
  x: number;
  y: number;
  t: number;
  seed: number;
}
interface Scene {
  scene: "gift" | "action" | "scratch" | "finale";
  t0: number;
  taps: number;
  lastTap: number;
  openAt: number | null;
  items: Item[];
  doneAt: number | null;
  holes: HTMLCanvasElement | null;
  revealAt: number | null;
  cells: Uint8Array | null;
  cleared: number;
  fireworks: Firework[];
  lastPt: [number, number] | null;
  lastScratchSfx: number;
  ended: boolean;
}

export interface SurpriseOptions {
  onSfx?: (name: string) => void;
}

export interface SurpriseEngine {
  reset(t: number): void;
  tap(x: number, y: number, t: number): void;
  drag(x: number, y: number, t: number): void;
  up(): void;
  render(ctx: Ctx, t: number): void;
  auto(t: number): void;
  teaser(ctx: Ctx, t: number): void;
  step(t: number): void;
  readonly ended: boolean;
  readonly scene: Scene["scene"];
}

export function create(data: SurpriseData, opts: SurpriseOptions = {}): SurpriseEngine {
  const sfx = (name: string) => {
    if (opts.onSfx) opts.onSfx(name);
  };
  let photo: CanvasImageSource | null = null;
  if (typeof data.photo === "string") {
    const im = new Image();
    im.onload = () => {
      photo = im;
    };
    im.src = data.photo;
  } else photo = data.photo || null;
  const photoSize = () => {
    const p = photo as HTMLImageElement | HTMLCanvasElement;
    return { w: "naturalWidth" in p ? p.naturalWidth : p.width, h: "naturalHeight" in p ? p.naturalHeight : p.height };
  };
  const name = data.to || "You",
    occ = data.occ || "birthday";
  const age = parseInt(data.number, 10);
  const nCandles = age > 0 && age <= 9 ? age : 5;
  const message = (data.cards || []).filter(Boolean).join("\n\n");

  const bg = background(),
    bokehSpr = bokehSprite();
  const bokeh = (() => {
    const r = rng(5),
      a: { x: number; y: number; s: number; v: number; ph: number; a: number }[] = [];
    for (let i = 0; i < 22; i++) a.push({ x: r() * W, y: r() * H, s: 60 + r() * 180, v: 6 + r() * 14, ph: r() * TAU, a: 0.25 + r() * 0.5 });
    return a;
  })();

  const BOX = { x: W / 2, y: 780, w: 420, h: 330 };
  const CARD = { x: 120, y: 360, w: 840, h: 720 };
  let st!: Scene;
  function reset(t: number) {
    st = {
      scene: "gift",
      t0: t,
      taps: 0,
      lastTap: -99,
      openAt: null,
      items: [],
      doneAt: null,
      holes: null,
      revealAt: null,
      cells: null,
      cleared: 0,
      fireworks: [],
      lastPt: null,
      lastScratchSfx: 0,
      ended: false
    };
  }
  function enter(scene: Scene["scene"], t: number) {
    st.scene = scene;
    st.t0 = t;
    st.doneAt = null;
    if (scene === "action") {
      st.items = [];
      if (occ === "birthday") {
        const span = Math.min(330, 60 * (nCandles - 1));
        for (let i = 0; i < nCandles; i++)
          st.items.push({ x: W / 2 - span / 2 + (nCandles > 1 ? (i * span) / (nCandles - 1) : 0), y: 470, out: null, ph: i * 1.7 });
      } else {
        const r = rng(9),
          cols =
            occ === "anniversary"
              ? ["#E63946", "#FF6B8B", "#C9184A", "#FF8FA3", "#E5383B", "#FFB3C1"]
              : ["#EF476F", "#FFD166", "#06D6A0", "#118AB2", "#F78C6B", "#9B5DE5"];
        [
          [270, 560],
          [540, 500],
          [810, 560],
          [380, 820],
          [700, 820],
          [540, 1060]
        ].forEach((p, i) => st.items.push({ x: p[0] + (r() - 0.5) * 40, y: p[1], c: cols[i], out: null, ph: r() * TAU }));
      }
    }
    if (scene === "scratch") {
      const f = document.createElement("canvas");
      f.width = CARD.w;
      f.height = CARD.h;
      const x = f.getContext("2d")!;
      const g = x.createLinearGradient(0, 0, CARD.w, CARD.h);
      g.addColorStop(0, "#B8862F");
      g.addColorStop(0.3, "#F5D97A");
      g.addColorStop(0.5, "#FFF0B8");
      g.addColorStop(0.7, "#E8BE55");
      g.addColorStop(1, "#A8761F");
      rrect(x, 0, 0, CARD.w, CARD.h, 40);
      x.fillStyle = g;
      x.fill();
      x.save();
      x.clip();
      x.globalAlpha = 0.18;
      x.strokeStyle = "#fff";
      x.lineWidth = 3;
      for (let i = -CARD.h; i < CARD.w; i += 26) {
        x.beginPath();
        x.moveTo(i, 0);
        x.lineTo(i + CARD.h, CARD.h);
        x.stroke();
      }
      x.restore();
      const r = rng(4);
      x.fillStyle = "rgba(255,255,255,.8)";
      for (let i = 0; i < 90; i++) {
        x.beginPath();
        x.arc(r() * CARD.w, r() * CARD.h, r() * 2.5, 0, TAU);
        x.fill();
      }
      x.fillStyle = "#6E4A0E";
      x.textAlign = "center";
      x.font = `600 64px ${SANS}`;
      x.fillText("Scratch here", CARD.w / 2, CARD.h / 2 + 10);
      x.font = `400 40px ${SANS}`;
      x.globalAlpha = 0.8;
      x.fillText("with your finger", CARD.w / 2, CARD.h / 2 + 70);
      st.holes = f;
      st.cells = new Uint8Array(16 * 14);
      st.cleared = 0;
      st.revealAt = null;
      st.lastPt = null;
    }
    if (scene === "finale") {
      st.fireworks = [];
      sfx("tada");
    }
  }

  function tap(x: number, y: number, t: number) {
    if (st.scene === "gift") {
      if (st.openAt != null) return;
      if (Math.abs(x - BOX.x) < BOX.w * 0.75 && y > BOX.y - BOX.h && y < BOX.y + BOX.h * 0.8) {
        st.taps++;
        st.lastTap = t;
        sfx("tap");
        if (st.taps >= 3) {
          st.openAt = t + 0.25;
          sfx("open");
        }
      }
    } else if (st.scene === "action") {
      st.items.forEach((it) => {
        if (it.out != null) return;
        const hit =
          occ === "birthday" ? Math.hypot(x - it.x, y - it.y) < 80 : Math.hypot(x - it.x, y - (it.y + Math.sin(t * 1.4 + it.ph) * 14)) < 110;
        if (hit) {
          it.out = t;
          sfx(occ === "birthday" ? "blow" : "pop");
        }
      });
      if (st.doneAt == null && st.items.every((i) => i.out != null)) {
        st.doneAt = t + 0.4;
        sfx("chime");
      }
    } else if (st.scene === "scratch") {
      if (st.revealAt != null && t - st.revealAt > 1) enter("finale", t);
      else {
        st.lastPt = [x, y];
        scratchAt(x, y, x, y, t);
      }
    } else if (st.scene === "finale") {
      if (y > 1200 && Math.abs(x - W / 2) < 220 && t - st.t0 > 3) {
        reset(t);
        return;
      }
      st.fireworks.push({ x, y, t, seed: st.fireworks.length + 3 });
      sfx("boom");
      if (st.fireworks.length > 14) st.fireworks.shift();
    }
  }
  function scratchAt(x0: number, y0: number, x1: number, y1: number, t: number) {
    if (st.revealAt != null || !st.holes || !st.cells) return;
    const ctx = st.holes.getContext("2d")!;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    const d = Math.hypot(x1 - x0, y1 - y0),
      n = Math.max(1, Math.ceil(d / 18));
    for (let i = 0; i <= n; i++) {
      const px = x0 + ((x1 - x0) * i) / n - CARD.x,
        py = y0 + ((y1 - y0) * i) / n - CARD.y;
      ctx.beginPath();
      ctx.arc(px, py, 62, 0, TAU);
      ctx.fill();
      const cx = Math.floor(px / (CARD.w / 16)),
        cy = Math.floor(py / (CARD.h / 14));
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const gx = cx + dx,
            gy = cy + dy;
          if (gx >= 0 && gx < 16 && gy >= 0 && gy < 14 && !st.cells[gy * 16 + gx]) {
            const ccx = ((gx + 0.5) * CARD.w) / 16,
              ccy = ((gy + 0.5) * CARD.h) / 14;
            if (Math.hypot(ccx - px, ccy - py) < 62) {
              st.cells[gy * 16 + gx] = 1;
              st.cleared++;
            }
          }
        }
    }
    ctx.restore();
    if (t - st.lastScratchSfx > 0.09) {
      st.lastScratchSfx = t;
      sfx("scratch");
    }
    if (st.cleared / st.cells.length > 0.55) {
      st.revealAt = t;
      sfx("chime");
    }
  }
  function drag(x: number, y: number, t: number) {
    if (st.scene !== "scratch" || !st.lastPt) return;
    const [px, py] = st.lastPt;
    scratchAt(px, py, x, y, t);
    st.lastPt = [x, y];
  }
  function up() {
    st.lastPt = null;
  }

  function update(t: number) {
    if (st.scene === "gift" && st.openAt != null && t > st.openAt + 1.4) enter("action", t);
    if (st.scene === "action" && st.doneAt != null && t > st.doneAt + 2.4) enter("scratch", t);
    if (st.scene === "finale" && t - st.t0 > 7) st.ended = true;
  }

  // Scripted taps for the auto-played video
  function auto(t: number) {
    const rel = t - st.t0;
    if (st.scene === "gift" && st.openAt == null) {
      const due = [1.0, 1.6, 2.2][st.taps];
      if (due != null && rel >= due) tap(BOX.x, BOX.y - 40, t);
    } else if (st.scene === "action") {
      st.items.forEach((it, i) => {
        if (it.out == null && rel >= 1.3 + i * 0.5) tap(it.x, occ === "birthday" ? it.y : it.y + Math.sin(t * 1.4 + it.ph) * 14, t);
      });
    } else if (st.scene === "scratch") {
      if (st.revealAt == null && rel >= 1.0) {
        const u = clamp01((rel - 1.0) / 2.6) * 6,
          row = Math.min(5, Math.floor(u)),
          f = u - row;
        const xx = CARD.x + 70 + (row % 2 ? 1 - f : f) * (CARD.w - 140),
          yy = CARD.y + 70 + (row * (CARD.h - 140)) / 5 + ((f * (CARD.h - 140)) / 5) * 0.3;
        if (!st.lastPt) {
          st.lastPt = [xx, yy];
        }
        drag(xx, yy, t);
      } else if (st.revealAt != null && t - st.revealAt > 3.6) tap(W / 2, H / 2, t);
    } else if (st.scene === "finale") {
      const shots = [
        [1.8, 300, 520],
        [2.6, 790, 420],
        [3.4, 540, 300],
        [4.6, 230, 340],
        [5.2, 850, 600]
      ];
      shots.forEach(([tt, x, y], i) => {
        if (rel >= tt && st.fireworks.length <= i) tap(x, y, t);
      });
    }
  }

  /* ---- Drawing ---- */
  function hint(ctx: Ctx, text: string, t: number, y?: number) {
    ctx.save();
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 3);
    ctx.fillStyle = "#FFE9F0";
    ctx.textAlign = "center";
    ctx.font = `500 42px ${SANS}`;
    ctx.fillText(text, W / 2, y || 1250);
    ctx.restore();
  }
  function title(ctx: Ctx, text: string, y: number, size: number, a: number, gold: boolean) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = "center";
    const ft = fit(ctx, text, (s) => `italic 700 ${s}px ${SERIF}`, 920, 2, size, 50);
    ctx.shadowColor = "rgba(255,190,120,.8)";
    ctx.shadowBlur = 30;
    ctx.fillStyle = gold
      ? (() => {
          const g = ctx.createLinearGradient(100, 0, W - 100, 0);
          g.addColorStop(0, "#E9B85A");
          g.addColorStop(0.5, "#FFF3C8");
          g.addColorStop(1, "#E9B85A");
          return g;
        })()
      : "#FFF1E6";
    ft.lines.forEach((l, i) => ctx.fillText(l, W / 2, y + i * ft.size * 1.1));
    ctx.restore();
  }
  function confetti(ctx: Ctx, t: number, since: number, dur: number, n: number) {
    const k = t - since;
    if (k < 0 || k > dur) return;
    const r = rng(Math.floor(since * 10) + 1);
    for (let i = 0; i < (n || 120); i++) {
      const x0 = r() * W,
        v = 250 + r() * 400,
        delay = r() * 0.6,
        c = pick(r, CONF),
        sw = 20 + r() * 50,
        ph = r() * TAU,
        sz = 10 + r() * 10;
      const kk = k - delay;
      if (kk < 0) continue;
      const y = -40 + v * kk,
        x = x0 + Math.sin(kk * 3 + ph) * sw;
      if (y > H + 40) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (dur - k) / 0.8);
      ctx.translate(x, y);
      ctx.rotate(kk * 5 + ph);
      ctx.scale(1, Math.cos(kk * 7 + ph));
      ctx.fillStyle = c;
      ctx.fillRect(-sz, -sz / 2.5, sz * 2, sz / 1.25);
      ctx.restore();
    }
  }
  function sparkBurst(ctx: Ctx, x: number, y: number, k: number, seed: number, scale: number) {
    if (k < 0 || k > 2.2) return;
    const r = rng(seed * 7 + 1);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const col = pick(r, ["#FFD27A", "#FF9FB2", "#9FE7FF", "#C3A6FF", "#FFF1C8"]);
    for (let i = 0; i < 70; i++) {
      const a = r() * TAU,
        v = (220 + r() * 300) * (scale || 1),
        px = x + Math.cos(a) * v * k * (1 - k * 0.2),
        py = y + Math.sin(a) * v * k * (1 - k * 0.2) + 110 * k * k;
      ctx.globalAlpha = Math.max(0, 1 - k / 2.2);
      ctx.fillStyle = r() < 0.3 ? "#FFFFFF" : col;
      ctx.beginPath();
      ctx.arc(px, py, 3.4, 0, TAU);
      ctx.fill();
      ctx.globalAlpha *= 0.25;
      ctx.beginPath();
      ctx.arc(px, py, 10, 0, TAU);
      ctx.fill();
    }
    if (k < 0.2) {
      ctx.globalAlpha = 1 - k / 0.2;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 240);
      g.addColorStop(0, "rgba(255,240,220,.7)");
      g.addColorStop(1, "rgba(255,240,220,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - 240, y - 240, 480, 480);
    }
    ctx.restore();
  }

  function drawGift(ctx: Ctx, t: number, teaserMode?: boolean) {
    const rel = t - st.t0,
      open = st.openAt != null ? clamp01((t - st.openAt) / 1.2) : 0;
    if (!teaserMode) title(ctx, `A surprise for ${name}`, 280, 96, easeOut(rel / 1), false);
    const sh = Math.sin((t - st.lastTap) * 42) * 22 * Math.exp(-(t - st.lastTap) * 6) * (st.openAt == null ? 1 : 0);
    const idle = st.openAt == null && st.taps === 0 ? Math.sin(rel * 2.4) * 6 : 0;
    const { x: bx, y: by, w, h } = BOX,
      grow = easeBack(rel / 0.8);
    ctx.save();
    ctx.translate(bx + sh, by + idle);
    ctx.scale(grow, grow);
    ctx.rotate(sh * 0.004);
    // light rays when opening
    if (open > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.sin(open * Math.PI) * 0.9;
      for (let i = 0; i < 16; i++) {
        ctx.save();
        ctx.rotate((i * TAU) / 16 + t * 0.4);
        const g = ctx.createLinearGradient(0, 0, 0, -900);
        g.addColorStop(0, "rgba(255,230,170,.9)");
        g.addColorStop(1, "rgba(255,230,170,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-18, -h / 2);
        ctx.lineTo(18, -h / 2);
        ctx.lineTo(70, -900);
        ctx.lineTo(-70, -900);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      const orb = ctx.createRadialGradient(0, -h / 2, 0, 0, -h / 2, 420 * open);
      orb.addColorStop(0, "rgba(255,245,220,1)");
      orb.addColorStop(1, "rgba(255,220,170,0)");
      ctx.fillStyle = orb;
      ctx.fillRect(-500, -h / 2 - 500, 1000, 1000);
      ctx.restore();
    }
    const bodyA = 1 - clamp01((open - 0.5) / 0.5);
    ctx.globalAlpha = bodyA;
    // shadow
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath();
    ctx.ellipse(0, h / 2 + 20, w * 0.62, 30, 0, 0, TAU);
    ctx.fill();
    // box body
    const bgd = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    bgd.addColorStop(0, "#9E1B3B");
    bgd.addColorStop(0.5, "#D6335A");
    bgd.addColorStop(1, "#8C1534");
    rrect(ctx, -w / 2, -h / 2 + 40, w, h - 40, 16);
    ctx.fillStyle = bgd;
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.08)";
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(i * 60, 40 + (i % 2) * 70, 14, 0, TAU);
      ctx.fill();
    }
    const rib = ctx.createLinearGradient(-40, 0, 40, 0);
    rib.addColorStop(0, "#C8962E");
    rib.addColorStop(0.5, "#FFE08A");
    rib.addColorStop(1, "#C8962E");
    ctx.fillStyle = rib;
    ctx.fillRect(-36, -h / 2 + 40, 72, h - 40);
    // lid + bow (fly off when opening)
    const lo = easeOut(open / 0.8);
    ctx.save();
    ctx.globalAlpha = 1 - clamp01((open - 0.3) / 0.5);
    ctx.translate(lo * 120, -lo * 700);
    ctx.rotate(lo * 0.7);
    const lg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    lg.addColorStop(0, "#B32347");
    lg.addColorStop(0.5, "#E8456B");
    lg.addColorStop(1, "#A01D3F");
    rrect(ctx, -w / 2 - 22, -h / 2 - 30, w + 44, 86, 16);
    ctx.fillStyle = lg;
    ctx.fill();
    ctx.fillStyle = rib;
    ctx.fillRect(-36, -h / 2 - 30, 72, 86);
    ctx.fillStyle = "#F2C45A";
    ctx.strokeStyle = "#B8862F";
    ctx.lineWidth = 4;
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      ctx.moveTo(0, -h / 2 - 32);
      ctx.bezierCurveTo(s * 40, -h / 2 - 150, s * 150, -h / 2 - 120, s * 110, -h / 2 - 50);
      ctx.bezierCurveTo(s * 80, -h / 2 - 30, s * 30, -h / 2 - 30, 0, -h / 2 - 32);
      ctx.fill();
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.arc(0, -h / 2 - 34, 26, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    if (teaserMode) return;
    if (st.openAt == null) {
      hint(ctx, st.taps === 0 ? "Tap the gift to open it" : st.taps === 1 ? "Tap again…" : "One more tap!", t);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(W / 2 - 40 + i * 40, 1300, 9, 0, TAU);
        ctx.fillStyle = i < st.taps ? "#FFD166" : "rgba(255,255,255,.25)";
        ctx.fill();
      }
      if (st.taps === 0) {
        const p = (rel % 1.6) / 1.6;
        ctx.save();
        ctx.strokeStyle = "#FFE9F0";
        ctx.globalAlpha = 1 - p;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(bx, by - 20, 60 + p * 90, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawCake(ctx: Ctx, t: number) {
    const rel = t - st.t0,
      allOut = st.doneAt != null,
      cx = W / 2,
      grow = easeBack(rel / 0.9);
    ctx.save();
    ctx.translate(cx, 1000);
    ctx.scale(grow, grow);
    ctx.translate(-cx, -1000);
    // warm glow while candles are lit
    const lit = st.items.filter((i) => i.out == null).length / st.items.length;
    if (lit > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(cx, 470, 0, cx, 470, 600);
      g.addColorStop(0, `rgba(255,190,110,${0.35 * lit})`);
      g.addColorStop(1, "rgba(255,190,110,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath();
    ctx.ellipse(cx, 1010, 360, 36, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#F1E4D8";
    ctx.beginPath();
    ctx.ellipse(cx, 1000, 340, 30, 0, 0, TAU);
    ctx.fill();
    const tier = (y: number, w: number, h: number, body: string, top: string) => {
      const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
      g.addColorStop(0, shadeC(body, 0.8));
      g.addColorStop(0.5, body);
      g.addColorStop(1, shadeC(body, 0.75));
      ctx.fillStyle = g;
      ctx.fillRect(cx - w / 2, y, w, h);
      ctx.beginPath();
      ctx.ellipse(cx, y + h, w / 2, 26, 0, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = top;
      ctx.beginPath();
      ctx.ellipse(cx, y, w / 2, 26, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, y);
      for (let i = 0; i <= 12; i++) {
        const x = cx - w / 2 + (i * w) / 12;
        ctx.quadraticCurveTo(x - w / 24, y + 34 + (i % 2) * 22, x, y + 6);
      }
      ctx.lineTo(cx + w / 2, y);
      ctx.fill();
    };
    tier(790, 560, 200, "#F6C6D6", "#FFF4EC");
    tier(620, 400, 170, "#FAD7E3", "#FFF7F0");
    const r = rng(12);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = pick(r, CONF);
      const tw = r() < 0.5,
        x = cx + (r() - 0.5) * (tw ? 360 : 520),
        y = tw ? 680 + r() * 90 : 860 + r() * 110;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(r() * 3);
      ctx.fillRect(-8, -3, 16, 6);
      ctx.restore();
    }
    st.items.forEach((it) => {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(it.x - 11, it.y + 30, 22, 120);
      ctx.save();
      ctx.beginPath();
      ctx.rect(it.x - 11, it.y + 30, 22, 120);
      ctx.clip();
      ctx.strokeStyle = "#EF476F";
      ctx.lineWidth = 7;
      for (let k = -2; k < 8; k++) {
        ctx.beginPath();
        ctx.moveTo(it.x - 15, it.y + 30 + k * 22);
        ctx.lineTo(it.x + 15, it.y + 18 + k * 22);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(it.x, it.y + 30);
      ctx.lineTo(it.x, it.y + 16);
      ctx.stroke();
      if (it.out == null) {
        const fl = 1 + 0.08 * Math.sin(t * 13 + it.ph) + 0.05 * Math.sin(t * 23 + it.ph),
          sway = Math.sin(t * 6 + it.ph) * 3;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(it.x, it.y, 0, it.x, it.y, 90);
        g.addColorStop(0, "rgba(255,200,100,.6)");
        g.addColorStop(1, "rgba(255,160,60,0)");
        ctx.fillStyle = g;
        ctx.fillRect(it.x - 90, it.y - 90, 180, 180);
        ctx.restore();
        ctx.save();
        ctx.translate(it.x, it.y + 14);
        ctx.scale(1, fl);
        const fg = ctx.createRadialGradient(0, -6, 2, 0, -14, 34);
        fg.addColorStop(0, "#FFFFFF");
        fg.addColorStop(0.35, "#FFE27A");
        fg.addColorStop(1, "#FF8A2A");
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(sway, -52);
        ctx.bezierCurveTo(16, -26, 16, -4, 0, 0);
        ctx.bezierCurveTo(-16, -4, -16, -26, sway, -52);
        ctx.fill();
        ctx.restore();
        if (rel > 1.2 && !allOut) {
          const p = ((t + it.ph) % 1.4) / 1.4;
          ctx.save();
          ctx.strokeStyle = "rgba(255,240,220,.6)";
          ctx.globalAlpha = (1 - p) * 0.7;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(it.x, it.y - 6, 40 + p * 40, 0, TAU);
          ctx.stroke();
          ctx.restore();
        }
      } else {
        const k = t - it.out;
        for (let s = 0; s < 4; s++) {
          const kk = k - s * 0.12;
          if (kk < 0 || kk > 2) continue;
          ctx.fillStyle = `rgba(220,220,230,${0.45 * (1 - kk / 2)})`;
          ctx.beginPath();
          ctx.arc(it.x + Math.sin(kk * 3 + s) * 16, it.y + 10 - kk * 120, 10 + kk * 22, 0, TAU);
          ctx.fill();
        }
      }
    });
    ctx.restore();
    if (allOut) {
      title(ctx, data.headline || `Happy birthday, ${name}!`, 270, 100, easeOut((t - st.doneAt!) / 0.8), true);
      confetti(ctx, t, st.doneAt!, 3.4, 160);
    } else {
      title(ctx, "Make a wish…", 270, 96, easeOut(rel / 1), false);
      hint(ctx, "Tap each flame to blow it out", t);
    }
  }

  function drawBalloons(ctx: Ctx, t: number) {
    const rel = t - st.t0,
      allOut = st.doneAt != null;
    st.items.forEach((it, i) => {
      const y = it.y + Math.sin(t * 1.4 + it.ph) * 14 + (1 - easeOut((rel - i * 0.1) / 1)) * 900,
        x = it.x + Math.sin(t * 0.9 + it.ph) * 8;
      const col = it.c || "#EF476F";
      if (it.out == null) {
        ctx.strokeStyle = "rgba(255,255,255,.5)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y + 110);
        ctx.bezierCurveTo(x - 20, y + 200, x + 20, y + 280, x, y + 380);
        ctx.stroke();
        ctx.save();
        const g = ctx.createRadialGradient(x - 30, y - 40, 8, x, y, 130);
        g.addColorStop(0, "rgba(255,255,255,.85)");
        g.addColorStop(0.25, col);
        g.addColorStop(1, shadeC(col, 0.7));
        ctx.fillStyle = g;
        if (occ === "anniversary") {
          heartPath(ctx, x, y - 95, 200);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.ellipse(x, y, 88, 108, 0, 0, TAU);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(x, y + 104);
          ctx.lineTo(x - 14, y + 124);
          ctx.lineTo(x + 14, y + 124);
          ctx.fill();
        }
        ctx.restore();
      } else {
        const k = t - it.out;
        if (k > 1) return;
        const r = rng(i + 20);
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = col;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(x, y, 60 + k * 220, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = col;
        for (let j = 0; j < 14; j++) {
          const a = r() * TAU,
            v = 300 + r() * 400;
          ctx.save();
          ctx.translate(x + Math.cos(a) * v * k, y + Math.sin(a) * v * k + 400 * k * k);
          ctx.rotate(k * 8 + j);
          ctx.fillRect(-14, -8, 28, 16);
          ctx.restore();
        }
        ctx.restore();
      }
    });
    if (allOut) {
      title(ctx, data.headline || `Congratulations, ${name}!`, 300, 100, easeOut((t - st.doneAt!) / 0.8), true);
      confetti(ctx, t, st.doneAt!, 3.4, 160);
    } else {
      title(ctx, occ === "anniversary" ? "Pop the hearts" : "Pop the balloons", 260, 96, easeOut(rel / 1), false);
      hint(ctx, "Tap every balloon", t);
    }
  }

  function drawScratch(ctx: Ctx, t: number) {
    const rel = t - st.t0,
      grow = easeBack(rel / 0.8);
    title(ctx, st.revealAt != null ? "A message for you" : "A hidden message…", 250, st.revealAt != null ? 90 : 72, easeOut(rel / 0.8), st.revealAt != null);
    ctx.save();
    ctx.translate(W / 2, CARD.y + CARD.h / 2);
    ctx.scale(grow, grow);
    ctx.translate(-W / 2, -(CARD.y + CARD.h / 2));
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 20;
    rrect(ctx, CARD.x, CARD.y, CARD.w, CARD.h, 40);
    ctx.fillStyle = "#FFF8EE";
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = "rgba(200,150,80,.5)";
    ctx.lineWidth = 3;
    rrect(ctx, CARD.x + 24, CARD.y + 24, CARD.w - 48, CARD.h - 48, 26);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "#4A2A3A";
    const ft = fit(ctx, message || "You make every day brighter.", (s) => `italic 600 ${s}px ${SERIF}`, CARD.w - 140, 9, 66, 34);
    const lh = ft.size * 1.28,
      y0 = CARD.y + CARD.h / 2 - (ft.lines.length * lh) / 2 + ft.size * 0.8;
    ft.lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + i * lh));
    ctx.restore();
    if (st.holes) {
      const fa = st.revealAt != null ? 1 - clamp01((t - st.revealAt) / 0.6) : 1;
      if (fa > 0) {
        ctx.globalAlpha = fa;
        ctx.drawImage(st.holes, CARD.x, CARD.y);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    if (st.revealAt != null) {
      sparkBurst(ctx, W / 2, CARD.y + CARD.h / 2, t - st.revealAt, 3, 1.4);
      if (t - st.revealAt > 1) hint(ctx, "Tap for the final surprise", t, 1230);
    } else if (rel > 0.8) {
      hint(ctx, "Scratch the gold card", t, 1230);
      if (st.cleared === 0) {
        const p = (rel % 2) / 2,
          fx = CARD.x + 200 + Math.sin(p * TAU) * 220,
          fy = CARD.y + CARD.h / 2 + 140 + Math.cos(p * TAU * 2) * 40;
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(fx, fy, 26, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(fx, fy, 44, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawFinale(ctx: Ctx, t: number) {
    const rel = t - st.t0;
    confetti(ctx, t, st.t0, 5, 200);
    st.fireworks.forEach((f) => sparkBurst(ctx, f.x, f.y, t - f.t, f.seed, 1.2));
    let ny = 640;
    if (photo) {
      const pr = 190,
        py = 470,
        s = easeBack((rel - 0.2) / 0.9);
      if (s > 0.01) {
        const { w: pw, h: ph } = photoSize();
        ctx.save();
        ctx.translate(W / 2, py);
        ctx.scale(s, s);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(0, 0, pr * 0.8, 0, 0, pr * 1.8);
        g.addColorStop(0, "rgba(255,210,140,.5)");
        g.addColorStop(1, "rgba(255,210,140,0)");
        ctx.fillStyle = g;
        ctx.fillRect(-pr * 2, -pr * 2, pr * 4, pr * 4);
        ctx.restore();
        ctx.lineWidth = 10;
        ctx.strokeStyle = "#F2C45A";
        ctx.beginPath();
        ctx.arc(0, 0, pr + 14, 0, TAU);
        ctx.stroke();
        ctx.save();
        ctx.rotate(t * 0.5);
        ctx.setLineDash([4, 18]);
        ctx.lineWidth = 6;
        ctx.strokeStyle = "#FFF3C8";
        ctx.beginPath();
        ctx.arc(0, 0, pr + 34, 0, TAU);
        ctx.stroke();
        ctx.restore();
        ctx.beginPath();
        ctx.arc(0, 0, pr, 0, TAU);
        ctx.clip();
        const sc = Math.max((2 * pr) / pw, (2 * pr) / ph);
        ctx.drawImage(photo, (-pw * sc) / 2, (-ph * sc) / 2, pw * sc, ph * sc);
        ctx.restore();
      }
      ny = 860;
    }
    const na = easeOut((rel - 0.6) / 0.9);
    if (na > 0) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.globalAlpha = na;
      let s = 190;
      do {
        ctx.font = `italic 700 ${s}px ${SERIF}`;
        s -= 8;
      } while (ctx.measureText(name).width > 940 && s > 80);
      const sh = ((rel * 0.5) % 2) * 1400 - 700,
        g = ctx.createLinearGradient(W / 2 - 600 + sh, 0, W / 2 + sh, 0);
      g.addColorStop(0, "#E2AE4C");
      g.addColorStop(0.5, "#FFF6D6");
      g.addColorStop(1, "#E2AE4C");
      ctx.shadowColor = "rgba(255,190,110,.9)";
      ctx.shadowBlur = 40;
      ctx.fillStyle = g;
      const sc = 0.85 + 0.15 * easeBack((rel - 0.6) / 0.9);
      ctx.translate(W / 2, ny);
      ctx.scale(sc, sc);
      ctx.fillText(name, 0, 0);
      ctx.restore();
    }
    const sign = (data.signoff || "").split("\n").filter(Boolean);
    sign.forEach((l, i) => {
      const p = clamp01((rel - 1.8 - i * 0.8) / 1);
      if (p <= 0) return;
      ctx.save();
      ctx.font = `600 80px ${HAND}`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#FFE3EC";
      const w = ctx.measureText(l).width + 20,
        y = ny + 150 + i * 86;
      ctx.beginPath();
      ctx.rect(W / 2 - w / 2, y - 80, w * p, 110);
      ctx.clip();
      ctx.fillText(l, W / 2, y);
      ctx.restore();
    });
    if (rel > 3) {
      hint(ctx, "Tap anywhere for fireworks", t, 1180);
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = "#FFE9F0";
      ctx.textAlign = "center";
      ctx.font = `600 38px ${SANS}`;
      ctx.fillText("↺  Play again", W / 2, 1275);
      ctx.restore();
    }
  }

  function render(ctx: Ctx, t: number) {
    update(t);
    ctx.drawImage(bg, 0, 0);
    drawBokeh(ctx, t);
    if (st.scene === "gift") drawGift(ctx, t);
    else if (st.scene === "action") (occ === "birthday" ? drawCake : drawBalloons)(ctx, t);
    else if (st.scene === "scratch") drawScratch(ctx, t);
    else drawFinale(ctx, t);
    const k = t - st.t0;
    if (st.scene !== "gift" && k < 0.45) {
      ctx.fillStyle = `rgba(26,11,46,${1 - k / 0.45})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
  function drawBokeh(ctx: Ctx, t: number) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    bokeh.forEach((b) => {
      const y = ((((b.y - t * b.v) % (H + 300)) + H + 300) % (H + 300)) - 150;
      ctx.globalAlpha = b.a * (0.7 + 0.3 * Math.sin(t * 0.8 + b.ph));
      ctx.drawImage(bokehSpr, b.x - b.s / 2, y - b.s / 2, b.s, b.s);
    });
    ctx.restore();
  }
  // Teaser picture/clip: a wrapped gift that wiggles, inviting them to open the file
  function teaser(ctx: Ctx, t: number) {
    ctx.drawImage(bg, 0, 0);
    drawBokeh(ctx, t);
    const save = st;
    st = { ...save, scene: "gift", t0: -10, taps: 1, lastTap: Math.floor((t - 0.4) / 1.8) * 1.8 + 0.4, openAt: null };
    drawGift(ctx, Math.max(t, 0), true);
    st = save;
    // twinkling sparkles around the gift
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const r = rng(23);
    for (let i = 0; i < 14; i++) {
      const a = r() * TAU,
        d = 280 + r() * 160,
        x = BOX.x + Math.cos(a) * d,
        y = BOX.y - 60 + Math.sin(a) * d * 0.8,
        ph = r() * TAU,
        sz = 10 + r() * 18;
      const k = 0.5 + 0.5 * Math.sin(t * 2.2 + ph);
      ctx.globalAlpha = k;
      ctx.fillStyle = "#FFE7A8";
      ctx.beginPath();
      ctx.moveTo(x, y - sz * k);
      ctx.quadraticCurveTo(x, y, x + sz * k, y);
      ctx.quadraticCurveTo(x, y, x, y + sz * k);
      ctx.quadraticCurveTo(x, y, x - sz * k, y);
      ctx.quadraticCurveTo(x, y, x, y - sz * k);
      ctx.fill();
    }
    ctx.restore();
    title(ctx, `${name},`, 230, 120, 1, true);
    title(ctx, "a surprise is waiting for you", 330, 70, 1, false);
    // call to action pill + bouncing arrow
    ctx.save();
    ctx.font = `600 44px ${SANS}`;
    ctx.textAlign = "center";
    const label = "Tap the file below to unwrap it",
      pw = ctx.measureText(label).width + 90,
      py = 1170;
    rrect(ctx, W / 2 - pw / 2, py - 58, pw, 92, 46);
    ctx.fillStyle = "rgba(255,255,255,.14)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,231,168,.6)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#FFF1E6";
    ctx.fillText(label, W / 2, py + 2);
    const by = 1268 + Math.abs(Math.sin(t * 3)) * 18;
    ctx.strokeStyle = "#FFE7A8";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(W / 2 - 24, by - 14);
    ctx.lineTo(W / 2, by + 10);
    ctx.lineTo(W / 2 + 24, by - 14);
    ctx.stroke();
    ctx.restore();
  }
  reset(0);
  return {
    reset,
    tap,
    drag,
    up,
    render,
    auto,
    teaser,
    step: update,
    get ended() {
      return st.ended;
    },
    get scene() {
      return st.scene;
    }
  };
}
