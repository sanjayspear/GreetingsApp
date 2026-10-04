import giftEngineSource from "virtual:gift-engine";
import { state } from "../state";
import { surpriseData } from "../cards/render";
import { giftFontCss } from "./giftFonts";

// The shared file needs no network at all: block every request so it can never phone home.
const GIFT_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src blob:";

/**
 * The "surprise" file: one self-contained HTML page (engine + data + photo inlined) that the
 * recipient opens from WhatsApp / Files / email. It must not depend on this app's origin.
 */
export function buildGiftHtml(): string {
  const data = surpriseData();
  const payload = { ...data, photo: state.photo ? state.photo.toDataURL("image/jpeg", 0.85) : null };
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  const title = `A surprise for ${data.to}`.replace(/[<>&"]/g, "");
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${GIFT_CSP}">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title} 🎁</title>
<style>
${giftFontCss}
html,body{margin:0;height:100%;background:#0B0614;overflow:hidden;font-family:Figtree,system-ui,sans-serif}
body{display:flex;align-items:center;justify-content:center;padding:env(safe-area-inset-top,0) 0 env(safe-area-inset-bottom,0);box-sizing:border-box}
canvas{display:block;max-width:100vw;max-height:100%;width:auto;height:auto;touch-action:none}
#snd{position:fixed;top:calc(12px + env(safe-area-inset-top,0px));right:12px;width:46px;height:46px;border-radius:50%;border:0;background:rgba(255,255,255,.16);color:#fff;font-size:20px}
</style></head><body>
<canvas id="c" width="1080" height="1350"></canvas>
<button id="snd" aria-label="Sound on or off">🔊</button>
<script>${giftEngineSource.replace(/<\/script/gi, "<\\/script")}</script>
<script>
(function(){
  var data=${json};
  var cv=document.getElementById("c"),ctx=cv.getContext("2d"),audio=null,on=true,down=false,t0=performance.now();
  var now=function(){return (performance.now()-t0)/1000};
  var eng=SurpriseEngine.create(data,{onSfx:function(n){if(audio&&on)audio.sfx(n)}});eng.reset(0);
  function fitCanvas(){var s=Math.min(innerWidth/1080,(innerHeight)/1350);cv.style.width=(1080*s)+"px";cv.style.height=(1350*s)+"px"}
  addEventListener("resize",fitCanvas);fitCanvas();
  function pt(e){var r=cv.getBoundingClientRect();return[(e.clientX-r.left)*1080/r.width,(e.clientY-r.top)*1350/r.height]}
  cv.addEventListener("pointerdown",function(e){e.preventDefault();down=true;try{cv.setPointerCapture(e.pointerId)}catch(_){}
    if(!audio){audio=SurpriseEngine.createAudio();} if(audio){audio.resume();if(on)audio.music();}
    var p=pt(e);eng.tap(p[0],p[1],now())});
  cv.addEventListener("pointermove",function(e){if(!down)return;var p=pt(e);eng.drag(p[0],p[1],now())});
  cv.addEventListener("pointerup",function(){down=false;eng.up()});cv.addEventListener("pointercancel",function(){down=false;eng.up()});
  document.getElementById("snd").addEventListener("click",function(){on=!on;this.textContent=on?"🔊":"🔈";if(!audio&&on){audio=SurpriseEngine.createAudio()}if(audio){audio.resume();audio.setOn(on)}});
  (function loop(){eng.render(ctx,now());requestAnimationFrame(loop)})();
})();
</script></body></html>`;
}
