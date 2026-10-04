import { W, H } from "../core/math";
import { $, $$, toast } from "../core/dom";
import { now, reduced, state } from "../state";
import { CCX, CCY, drawCardAt } from "../cards/flash";
import { designById } from "../cards/designs";
import { cv, paintTo, storyLength, surpriseData } from "../cards/render";
import { create as createSurprise } from "../surprise/engine";
import { getMusic, ensureAudio, isMusicOn, stopMusic } from "../audio/music";
import { SaveDeclinedError, prefersShareSheet, webDownloads } from "../export/downloads";
import { buildGiftHtml } from "../export/gift";
import { buildGiftLink } from "../export/link";
import { canEncode, encodeMp4, recMime, recordFallback, teaserBlob, videoMime, type DrawFn, type VideoResult } from "../export/video";
import { toName } from "./form";
import { togglePanel } from "./sheets";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const fileBase = () => (toName() || "greeting").replace(/[^\w-]+/g, "-");

export function cardText(): string {
  const t = state.text;
  if (!t) return "";
  return [t.headline, ...t.cards, t.signoff]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join("\n\n");
}

/** Save a file; shows a toast either way. Returns whether it worked. */
async function saveFile(filename: string, data: Blob | string, okMsg: string, failMsg = "Couldn't save the file"): Promise<boolean> {
  try {
    await webDownloads.save({ filename, data });
    toast(okMsg);
    return true;
  } catch (e) {
    if (!(e instanceof SaveDeclinedError)) toast(failMsg);
    return false;
  }
}

const teaserDraw: DrawFn = (ctx, t) => createSurprise(surpriseData()).teaser(ctx, t);

export function initShare(): void {
  const isSurprise = () => state.style === "surprise";

  $("share").addEventListener("click", () => {
    const text = cardText(),
      enc = encodeURIComponent(text);
    $<HTMLAnchorElement>("lnkWa").href = "https://wa.me/?text=" + enc;
    $<HTMLAnchorElement>("lnkSms").href = "sms:?&body=" + enc;
    $<HTMLAnchorElement>("lnkMail").href = "mailto:?subject=" + encodeURIComponent(state.text ? state.text.headline : "") + "&body=" + enc;
    const sur = isSurprise();
    $("saveVid").classList.toggle("hidden", !videoMime || reduced || (sur && !canEncode));
    $$(".sur-only").forEach((el) => el.classList.toggle("hidden", !sur));
    $("saveTeaserVid").classList.toggle("hidden", !sur || !canEncode);
    $("saveTeaser").classList.toggle("wide", sur && !canEncode);
    $("saveVid").classList.toggle("featured", !sur);
    $("saveImg").classList.toggle("featured", !videoMime || reduced);
    togglePanel($("share"), $("sharePanel"));
  });

  $("saveImg").addEventListener("click", async () => {
    if (!state.cards.length) return;
    const btn = $<HTMLButtonElement>("saveImg");
    btn.disabled = true;
    // Still picture: the title card on the design background
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const x = c.getContext("2d")!;
    if (state.style === "lanterns") paintTo(x, now(), storyLength() - 0.6);
    else if (state.style === "surprise") x.drawImage(cv, 0, 0);
    else {
      const d = designById(state.design);
      d.draw(x, 0);
      drawCardAt(x, state.cards[0].face, CCX, CCY, 1, 0, 1, true);
    }
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
    if (blob) await saveFile(`${fileBase()}-card.png`, blob, "Card saved", "Couldn't save the card");
    else toast("Couldn't save the card");
    btn.disabled = false;
  });

  $("saveVid").addEventListener("click", async () => {
    if (!videoMime || !state.cards.length) return;
    const btn = $<HTMLButtonElement>("saveVid"),
      label = btn.textContent;
    btn.disabled = true;
    ensureAudio();
    stopMusic();
    const progress = (p: number) => {
      btn.textContent = `Making video… ${Math.round(p * 100)}%`;
    };
    const sur = isSurprise();
    const secs = Math.ceil(storyLength() + (sur ? 0 : 0.8));
    let drawFn: DrawFn | undefined;
    if (sur) {
      const ae = createSurprise(surpriseData());
      ae.reset(0);
      drawFn = (c, t) => {
        ae.auto(t);
        ae.render(c, t);
      };
    }
    let res: VideoResult | null = null,
      ext = "mp4";
    try {
      const audio = isMusicOn() ? await getMusic(secs) : null;
      if (canEncode) {
        try {
          res = await encodeMp4(secs, progress, audio, drawFn);
        } catch {
          res = null;
        }
        if (res && audio && !res.audio && recMime) res = null;
      }
      if (!res && recMime && !sur) {
        res = await recordFallback(secs, progress, audio);
        ext = recMime.includes("mp4") ? "mp4" : "webm";
      }
      btn.textContent = label;
      if (!res || !res.blob.size) throw new Error("empty");
      await saveFile(
        `${fileBase()}-card.${ext}`,
        res.blob,
        (res.hd ? "HD video saved" : "Video saved") + (res.audio ? " with music" : "") + (res.hd ? "" : " (standard quality on this device)"),
        "Couldn't save the video"
      );
    } catch {
      toast("Video isn't supported on this device. Save as image instead.");
    }
    btn.textContent = label;
    btn.disabled = false;
  });

  $("saveTeaser").addEventListener("click", async () => {
    if (!state.text) return;
    const btn = $<HTMLButtonElement>("saveTeaser");
    btn.disabled = true;
    const blob = await teaserBlob(teaserDraw);
    if (blob) await saveFile(`${fileBase()}-teaser.png`, blob, "Teaser photo saved");
    btn.disabled = false;
  });

  $("sendBoth").addEventListener("click", async () => {
    if (!state.text) return;
    const btn = $<HTMLButtonElement>("sendBoth"),
      label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Step 1 of 2: teaser photo…";
    const blob = await teaserBlob(teaserDraw);
    const ok = blob ? await saveFile(`${fileBase()}-teaser.png`, blob, "Teaser saved. Now the surprise file…") : false;
    if (ok) {
      btn.textContent = "Step 2 of 2: surprise file…";
      await wait(400);
      await saveFile(`${fileBase()}-surprise.html`, buildGiftHtml(), "Both saved. Send the photo first, then the file.");
    }
    btn.textContent = label;
    btn.disabled = false;
  });

  $("saveTeaserVid").addEventListener("click", async () => {
    if (!state.text || !canEncode) return;
    const btn = $<HTMLButtonElement>("saveTeaserVid"),
      label = btn.textContent;
    btn.disabled = true;
    try {
      const eng = createSurprise(surpriseData());
      const audio = isMusicOn() ? await getMusic(6) : null;
      const res = await encodeMp4(
        6,
        (p) => {
          btn.textContent = `Making… ${Math.round(p * 100)}%`;
        },
        audio,
        (c, t) => eng.teaser(c, t)
      );
      btn.textContent = label;
      await saveFile(`${fileBase()}-teaser.mp4`, res.blob, "Teaser video saved");
    } catch {
      toast("Couldn't make the teaser video on this device. Use the teaser photo instead.");
    }
    btn.textContent = label;
    btn.disabled = false;
  });

  $("saveLink").addEventListener("click", async () => {
    if (!state.text) return;
    const d = surpriseData();
    const url = await buildGiftLink({ occ: d.occ, to: d.to, number: d.number, headline: d.headline, cards: d.cards, signoff: d.signoff }, location.href);
    if (prefersShareSheet() && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `A surprise for ${d.to}`, text: `A surprise for ${d.to} 🎁 Tap to open:`, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        /* fall back to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied. Paste it into WhatsApp or a message.");
    } catch {
      toast("Couldn't copy the link on this device");
    }
  });

  $("saveGift").addEventListener("click", async () => {
    if (!state.text) return;
    const btn = $<HTMLButtonElement>("saveGift");
    btn.disabled = true;
    await saveFile(`${fileBase()}-surprise.html`, buildGiftHtml(), "Surprise file saved. Send it to them as a document.", "Couldn't save the surprise file");
    btn.disabled = false;
  });

  $("copy").addEventListener("click", async () => {
    const text = cardText();
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        /* unsupported */
      }
      ta.remove();
      toast(ok ? "Copied" : "Copy didn't work here. Use Edit words to select the text.");
    }
  });
}
