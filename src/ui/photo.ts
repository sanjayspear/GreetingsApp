import { $ } from "../core/dom";
import { state } from "../state";
import { render, showCard } from "../cards/render";

function setPhotoUI(src: string | null) {
  $("photoThumb").classList.toggle("hidden", !src);
  if (src) $<HTMLImageElement>("photoThumb").src = src;
  $("photoRemove").classList.toggle("hidden", !src);
  $("photoBtnText").textContent = src ? "Change photo" : "Upload from device";
}

function useImage(img: CanvasImageSource & { width: number; height: number; naturalWidth?: number; naturalHeight?: number }) {
  const iw = img.naturalWidth || img.width,
    ih = img.naturalHeight || img.height;
  const sc = Math.min(1, 1000 / Math.max(iw, ih)),
    c = document.createElement("canvas");
  c.width = Math.round(iw * sc);
  c.height = Math.round(ih * sc);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  state.photo = c;
  setPhotoUI(c.toDataURL("image/jpeg", 0.85));
  $("photoNote").textContent = "";
  if (state.text) {
    render();
    showCard(0);
  }
}

function loadFrom(src: string, onFail: () => void) {
  const img = new Image();
  img.onload = () => {
    try {
      useImage(img);
    } catch {
      onFail();
    }
  };
  img.onerror = onFail;
  img.src = src;
}

const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

async function handleFile(f: File) {
  if (f.type && !f.type.startsWith("image/")) {
    $("photoNote").textContent = "That file isn't a photo. Choose a JPG or PNG.";
    return;
  }
  if (f.size > MAX_PHOTO_BYTES) {
    $("photoNote").textContent = "That photo is too large (25 MB max).";
    return;
  }
  $("photoNote").textContent = "Loading photo…";
  const fail = () => {
    $("photoNote").textContent = `"${f.name || "This photo"}" couldn't be opened. Try a JPG or PNG photo.`;
  };
  if (typeof createImageBitmap === "function") {
    try {
      useImage(await createImageBitmap(f));
      return;
    } catch {
      /* fall back to <img> decoding */
    }
  }
  const viaReader = () => {
    const r = new FileReader();
    r.onload = () => loadFrom(String(r.result), fail);
    r.onerror = fail;
    r.readAsDataURL(f);
  };
  let url: string | null = null;
  try {
    url = URL.createObjectURL(f);
  } catch {
    /* no object URLs: use the reader */
  }
  if (url) {
    const u = url;
    loadFrom(u, () => {
      URL.revokeObjectURL(u);
      viaReader();
    });
  } else viaReader();
}

export function initPhoto(): void {
  $("photo").addEventListener("change", (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) void handleFile(f);
  });
  $("photoRemove").addEventListener("click", () => {
    state.photo = null;
    setPhotoUI(null);
    $("photoNote").textContent = "";
    $<HTMLInputElement>("photo").value = "";
    if (state.text) {
      render();
      showCard(0);
    }
  });
}
