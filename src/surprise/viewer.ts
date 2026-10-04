import { W, H } from "../core/math";
import type { SurpriseData } from "../core/types";
import { create, createAudio, type SurpriseAudio } from "./engine";

/**
 * Full-screen player for a surprise opened from a shared link. It covers the whole app and only
 * ever draws the recipient's text onto a canvas (never into the DOM as HTML).
 */
export function startViewer(data: SurpriseData): void {
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "position:fixed;inset:0;z-index:1000;background:#0B0614;display:flex;align-items:center;justify-content:center;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px);box-sizing:border-box;overflow:hidden";
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  cv.style.cssText = "display:block;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none";
  const snd = document.createElement("button");
  snd.type = "button";
  snd.textContent = "🔊";
  snd.setAttribute("aria-label", "Sound on or off");
  snd.style.cssText =
    "position:fixed;top:calc(12px + env(safe-area-inset-top,0px));right:12px;width:46px;height:46px;border-radius:50%;border:0;background:rgba(255,255,255,.16);color:#fff;font-size:20px;cursor:pointer";
  wrap.append(cv, snd);
  document.body.append(wrap);
  document.body.classList.add("locked");

  const ctx = cv.getContext("2d")!;
  let audio: SurpriseAudio | null = null,
    on = true,
    down = false;
  const t0 = performance.now(),
    now = () => (performance.now() - t0) / 1000;
  const eng = create(data, {
    onSfx: (n) => {
      if (audio && on) audio.sfx(n);
    }
  });
  eng.reset(0);

  const fitCanvas = () => {
    const s = Math.min(innerWidth / W, innerHeight / H);
    cv.style.width = W * s + "px";
    cv.style.height = H * s + "px";
  };
  addEventListener("resize", fitCanvas);
  fitCanvas();
  const pt = (e: PointerEvent): [number, number] => {
    const r = cv.getBoundingClientRect();
    return [((e.clientX - r.left) * W) / r.width, ((e.clientY - r.top) * H) / r.height];
  };
  // Sound is optional: never let an audio failure (common on iOS) stop the game.
  const wake = () => {
    try {
      if (!audio) audio = createAudio();
      if (audio) {
        audio.resume();
        if (on) audio.music().catch(() => {});
      }
    } catch {
      audio = null;
    }
  };
  cv.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    down = true;
    try {
      cv.setPointerCapture(e.pointerId);
    } catch {
      /* best effort */
    }
    wake();
    const [x, y] = pt(e);
    eng.tap(x, y, now());
  });
  cv.addEventListener("pointermove", (e) => {
    if (!down) return;
    const [x, y] = pt(e);
    eng.drag(x, y, now());
  });
  const end = () => {
    down = false;
    eng.up();
  };
  cv.addEventListener("pointerup", end);
  cv.addEventListener("pointercancel", end);
  snd.addEventListener("click", () => {
    on = !on;
    snd.textContent = on ? "🔊" : "🔈";
    if (!audio && on) wake();
    if (audio) {
      audio.resume();
      audio.setOn(on);
    }
  });
  const loop = () => {
    eng.render(ctx, now());
    requestAnimationFrame(loop);
  };
  loop();
}
