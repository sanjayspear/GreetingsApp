import "./styles/fonts";
import "./styles/main.css";
import { registerSW } from "virtual:pwa-register";
import type { CardStyle, Occasion, Tone } from "./core/types";
import { $, $$ } from "./core/dom";
import { OCC, now, reduced, state } from "./state";
import { DESIGNS } from "./cards/designs";
import { bindSurpriseInput, frame, getSurprise, getSurpriseAudio, render, replay, showCard, startLoop, storyLength, surpriseAudio } from "./cards/render";
import { getGreeting } from "./greeting/ai";
import { cardsFromEditor } from "./greeting/text";
import { ensureAudio, isMusicOn, playMusic, setMusicOn, stopMusic } from "./audio/music";
import { details, validate } from "./ui/form";
import { initPhoto } from "./ui/photo";
import { closeSheets, initSheets, togglePanel } from "./ui/sheets";
import { initShare } from "./ui/share";
import { initDates } from "./dates/ui";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
let busy = false;

/** Start the soundtrack for the current style (the surprise game plays its own audio). */
function play(delay: number) {
  if (state.style === "surprise" || !state.cards.length) return;
  void playMusic(delay, storyLength());
}

/* ---------- Fonts: canvas text needs them loaded before the first draw ---------- */
const fontsReady = Promise.all(
  [
    '400 40px "Figtree"',
    '500 40px "Figtree"',
    '400 40px "Young Serif"',
    '600 40px "Caveat"',
    '600 40px "Fredoka"',
    'italic 600 40px "Playfair Display"',
    'italic 600 40px "Cormorant Garamond"',
    'italic 700 40px "Cormorant Garamond"'
  ].map((f) => (document.fonts ? document.fonts.load(f).catch(() => {}) : null))
);

/* ---------- Design picker ---------- */
function syncPicker() {
  $$("#designs .design").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.id === state.design)));
}
function buildPicker() {
  const box = $("designs");
  box.innerHTML = "";
  DESIGNS.forEach((d) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "design";
    b.dataset.id = d.id;
    b.setAttribute("aria-pressed", String(d.id === state.design));
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = d.swatch;
    b.append(dot, document.createTextNode(d.name));
    b.addEventListener("click", () => {
      state.design = d.id;
      state.designChosen = true;
      syncPicker();
      render();
    });
    box.appendChild(b);
  });
}

/* ---------- Form ---------- */
function initForm() {
  $$(".occ").forEach((b) =>
    b.addEventListener("click", () => {
      state.occ = b.dataset.occ as Occasion;
      $$(".occ").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      $("customWrap").classList.toggle("hidden", state.occ !== "custom");
      const o = OCC[state.occ];
      $("numberWrap").classList.toggle("hidden", !o.numLabel);
      if (o.numLabel) $("numberLabel").innerHTML = o.numLabel + ' <span class="hint">(optional)</span>';
      $<HTMLInputElement>("number").placeholder = state.occ === "anniversary" ? "e.g. 10" : "e.g. 30";
      const rel = $<HTMLSelectElement>("relation");
      if (state.occ === "anniversary" && rel.value === "friend") rel.value = "partner";
      if (!state.designChosen) {
        state.design = o.design;
        syncPicker();
      }
      if (state.occ === "custom") $("customEvent").focus();
    })
  );
  $$(".tone").forEach((b) =>
    b.addEventListener("click", () => {
      state.tone = b.dataset.tone as Tone;
      $$(".tone").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    })
  );
  $("toName").addEventListener("change", () => {
    if (state.text) render();
  });
}

/* ---------- Generate ---------- */
function fillEditors() {
  if (!state.text) return;
  $<HTMLInputElement>("eHead").value = state.text.headline;
  $<HTMLTextAreaElement>("eMsg").value = state.text.cards.join("\n\n");
  $<HTMLTextAreaElement>("eSign").value = state.text.signoff;
}

async function create() {
  if (busy) return;
  const d = details(),
    problem = validate(d);
  $("err").textContent = problem;
  if (problem) return;
  busy = true;
  state.variant = 0;
  ensureAudio();
  stopMusic();
  const go = $<HTMLButtonElement>("go");
  go.disabled = true;
  go.textContent = "Creating your card…";
  state.text = null;
  state.cards = [];
  state.revealAt = Infinity;
  $("result").classList.add("show");
  document.body.classList.add("locked");
  $("writingNote").classList.remove("hidden");
  startLoop();
  frame(now());
  $("stage").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  const [g] = await Promise.all([getGreeting(d, state.variant), wait(reduced ? 0 : 900), fontsReady]);
  state.text = g;
  fillEditors();
  render();
  $("writingNote").classList.add("hidden");
  state.revealAt = now() + 0.2;
  play(0.2);
  busy = false;
  go.disabled = false;
  go.textContent = "Create my card";
}

async function newWords() {
  if (busy) return;
  const d = details(),
    problem = validate(d);
  $("err").textContent = problem;
  if (problem) return;
  busy = true;
  state.variant++;
  const again = $<HTMLButtonElement>("again");
  again.disabled = true;
  again.textContent = "Writing…";
  state.text = await getGreeting(d, state.variant);
  fillEditors();
  render();
  replay();
  ensureAudio();
  play(0);
  again.disabled = false;
  again.textContent = "New words";
  busy = false;
}

/* ---------- Preview screen ---------- */
function syncStyleUI() {
  $$("#styles .design").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.style === state.style)));
  const flash = state.style === "flash",
    sur = state.style === "surprise";
  $("des-h").classList.toggle("hidden", !flash);
  $("designs").classList.toggle("hidden", !flash);
  $("stage").classList.toggle("surprise", sur);
  $("liveHint").textContent = sur ? "Tap the card to play." : "Your card is live.";
  const sAudio = getSurpriseAudio();
  if (sur) stopMusic();
  else if (sAudio) sAudio.stop();
}

function initPreview() {
  let editTimer: ReturnType<typeof setTimeout> | undefined;
  const editTarget: Record<string, () => number> = { eHead: () => 0, eMsg: () => 1, eSign: () => state.cards.length - 1 };
  ["eHead", "eMsg", "eSign"].forEach((id) =>
    $(id).addEventListener("input", () => {
      if (!state.text) return;
      state.text = {
        headline: $<HTMLInputElement>("eHead").value,
        cards: cardsFromEditor($<HTMLTextAreaElement>("eMsg").value),
        signoff: $<HTMLTextAreaElement>("eSign").value
      };
      clearTimeout(editTimer);
      editTimer = setTimeout(() => {
        render();
        showCard(Math.max(0, Math.min(editTarget[id](), state.cards.length - 1)));
      }, 250);
    })
  );
  $$("#styles .design").forEach((b) =>
    b.addEventListener("click", () => {
      if (state.style === b.dataset.style) return;
      state.style = b.dataset.style as CardStyle;
      syncStyleUI();
      render();
      if (state.text && state.style !== "surprise") {
        replay();
        ensureAudio();
        play(0);
      }
    })
  );
  syncStyleUI();
  bindSurpriseInput();

  $("fullBtn").addEventListener("click", () => $("stage").classList.add("full"));
  $("closeFull").addEventListener("click", () => $("stage").classList.remove("full"));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") $("stage").classList.remove("full");
  });
  $("editBtn").addEventListener("click", () => togglePanel($("editBtn"), $("editPanel")));

  $("musicBtn").addEventListener("click", () => {
    setMusicOn(!isMusicOn());
    $("musicBtn").setAttribute("aria-pressed", String(isMusicOn()));
    if (state.style === "surprise") {
      const sAudio = getSurpriseAudio();
      if (sAudio) sAudio.setOn(isMusicOn());
      else if (isMusicOn()) surpriseAudio();
      return;
    }
    if (!isMusicOn()) stopMusic();
    else {
      ensureAudio();
      replay();
      play(0);
    }
  });
  $("replay").addEventListener("click", () => {
    if (state.style === "surprise") {
      getSurprise()?.reset(now());
      return;
    }
    replay();
    ensureAudio();
    play(0);
  });
  $("replay").classList.toggle("hidden", reduced);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopMusic();
  });
  $("backBtn").addEventListener("click", () => {
    closeSheets();
    $("stage").classList.remove("full");
    $("result").classList.remove("show");
    document.body.classList.remove("locked");
    stopMusic();
    getSurpriseAudio()?.stop();
  });
  $("go").addEventListener("click", () => void create());
  $("again").addEventListener("click", () => void newWords());
}

buildPicker();
initForm();
initPhoto();
initSheets();
initPreview();
initShare();
initDates();
void fontsReady.then(() => {
  if (state.text) render();
});

// Offline support: the service worker precaches the app shell; updates apply on next load.
registerSW({ immediate: true });
