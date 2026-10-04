import type { Ctx, SurpriseData } from "../core/types";
import { W, H } from "../core/math";
import { $ } from "../core/dom";
import { now, reduced, state } from "../state";
import { details, toName } from "../ui/form";
import { create as createSurprise, createAudio, type SurpriseAudio, type SurpriseEngine } from "../surprise/engine";
import { isMusicOn, stopMusic } from "../audio/music";
import { designById } from "./designs";
import { T_IN, buildCards, cardStart, drawStory, flashLength } from "./flash";
import { LT, buildLanternLayout, getLanternLayout, lanternLength, paintLanterns } from "./lanterns";

export const cv = $<HTMLCanvasElement>("cv");
const cctx = cv.getContext("2d")!;

/* ================= INTERACTIVE SURPRISE (glue) ================= */
let surprise: SurpriseEngine | null = null,
  sAudio: SurpriseAudio | null = null,
  sLen: number | null = null,
  sDown = false;

export const getSurprise = (): SurpriseEngine | null => surprise;
export const getSurpriseAudio = (): SurpriseAudio | null => sAudio;

export function surpriseData(): SurpriseData {
  const d = details(),
    t = state.text;
  return { occ: d.occ, to: d.to || "You", number: d.number, headline: t ? t.headline : undefined, cards: t ? t.cards : [], signoff: t ? t.signoff : "", photo: state.photo };
}
function buildSurprise() {
  sLen = null;
  if (state.style !== "surprise" || !state.text) {
    surprise = null;
    return;
  }
  surprise = createSurprise(surpriseData(), {
    onSfx: (n) => {
      if (sAudio && isMusicOn()) sAudio.sfx(n);
    }
  });
  surprise.reset(now());
}
function surpriseLength(): number {
  if (sLen) return sLen;
  const sim = createSurprise(surpriseData());
  sim.reset(0);
  let t = 0;
  for (; t < 45; t += 1 / 30) {
    sim.auto(t);
    sim.step(t);
    if (sim.ended) break;
  }
  return (sLen = t + 0.2);
}
export function surpriseAudio(): SurpriseAudio | null {
  // Sound is optional: if the browser (notably iOS Safari) refuses, the game must still play.
  try {
    if (!sAudio) sAudio = createAudio();
    if (sAudio) {
      sAudio.resume();
      if (isMusicOn()) sAudio.music().catch(() => {});
    }
  } catch {
    sAudio = null;
  }
  return sAudio;
}
const canvasPoint = (ev: PointerEvent): [number, number] => {
  const r = cv.getBoundingClientRect();
  return [((ev.clientX - r.left) * W) / r.width, ((ev.clientY - r.top) * H) / r.height];
};
export function bindSurpriseInput(): void {
  cv.addEventListener("pointerdown", (ev) => {
    if (state.style !== "surprise" || !surprise) return;
    ev.preventDefault();
    sDown = true;
    try {
      cv.setPointerCapture(ev.pointerId);
    } catch {
      /* pointer capture is best-effort */
    }
    stopMusic();
    surpriseAudio();
    const [x, y] = canvasPoint(ev);
    surprise.tap(x, y, now());
  });
  cv.addEventListener("pointermove", (ev) => {
    if (!sDown || state.style !== "surprise" || !surprise) return;
    const [x, y] = canvasPoint(ev);
    surprise.drag(x, y, now());
  });
  const end = () => {
    sDown = false;
    if (surprise) surprise.up();
  };
  cv.addEventListener("pointerup", end);
  cv.addEventListener("pointercancel", end);
}

/* ================= Painting & timeline ================= */
export const storyLength = (): number => (state.style === "lanterns" ? lanternLength() : state.style === "surprise" ? surpriseLength() : flashLength());

/** Draw one frame of the current style. `t` = clock seconds, `e` = seconds into the story. */
export function paintTo(ctx: Ctx, t: number, e: number): void {
  if (state.style === "lanterns") {
    paintLanterns(ctx, t, e);
    return;
  }
  if (state.style === "surprise") {
    if (surprise) surprise.render(ctx, t);
    else {
      ctx.fillStyle = "#1A0B2E";
      ctx.fillRect(0, 0, W, H);
    }
    return;
  }
  const d = designById(state.design);
  d.draw(ctx, t);
  drawStory(ctx, d, e, toName());
}
export function frame(t: number, full?: boolean): void {
  paintTo(cctx, reduced ? 0 : t, full || reduced ? 99 : t - state.revealAt);
}
function loop() {
  if (!state.running) return;
  frame(now());
  requestAnimationFrame(loop);
}
export function startLoop(): void {
  if (reduced) {
    frame(0, true);
    return;
  }
  if (!state.running) {
    state.running = true;
    requestAnimationFrame(loop);
  }
}
/** Rebuild everything derived from the current text / photo / style, then repaint. */
export function render(): void {
  buildCards();
  buildLanternLayout(toName());
  buildSurprise();
  if (reduced || !state.running) frame(now(), true);
}
export function replay(): void {
  state.revealAt = now();
}
/** Jump the animation to the moment card `k` is on screen (used after edits). */
export function showCard(k: number): void {
  const LL = getLanternLayout();
  if (state.style === "lanterns" && LL) {
    const last = k >= state.cards.length - 1 && k > 0 && state.text && state.text.signoff;
    state.revealAt = now() - (last ? LL.F + 4.2 : LT.FIRST + Math.min(k, LL.blocks.length - 1) * LT.GAP + 1.3);
    return;
  }
  state.revealAt = now() - (k === 0 ? T_IN + 0.01 : cardStart(k) + 0.01);
}
