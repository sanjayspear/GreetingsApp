import type { FileSaver } from "../core/types";

/** Thrown when the person closes the share sheet / cancels the save on purpose. */
export class SaveDeclinedError extends Error {
  constructor() {
    super("declined");
    this.name = "SaveDeclinedError";
  }
}

const MIME: Record<string, string> = { png: "image/png", mp4: "video/mp4", webm: "video/webm", html: "text/html" };

export function mimeFor(filename: string, fallback = "application/octet-stream"): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] || fallback;
}

/**
 * The OS share sheet is great on a phone (it can drop the file straight into WhatsApp), but on a
 * laptop it hides the download, so desktop browsers always get a normal file download.
 */
export function prefersShareSheet(nav: Pick<Navigator, "maxTouchPoints" | "userAgent"> = navigator): boolean {
  return nav.maxTouchPoints > 1 && /iPhone|iPad|Android|Macintosh/.test(nav.userAgent);
}

function downloadViaAnchor(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // Give the browser time to start the download before the blob URL goes away.
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

export type ShareResult = "shared" | "declined" | "blocked" | "unavailable";

/**
 * Open the OS share sheet with a file (touch devices only).
 * "blocked" means the browser refused because the tap was too long ago (e.g. after a long video
 * encode): the caller should ask for a fresh tap and try again.
 */
export async function shareFile(filename: string, blob: Blob): Promise<ShareResult> {
  if (!prefersShareSheet() || typeof navigator.canShare !== "function" || typeof navigator.share !== "function") return "unavailable";
  try {
    const file = new File([blob], filename, { type: blob.type });
    if (!navigator.canShare({ files: [file] })) return "unavailable";
    await navigator.share({ files: [file], title: filename });
    return "shared";
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "declined";
    if (e instanceof DOMException && e.name === "NotAllowedError") return "blocked";
    return "unavailable";
  }
}

export const webDownloads: FileSaver = {
  async save({ filename, data }) {
    const blob = new Blob([data], { type: mimeFor(filename, data instanceof Blob ? data.type : undefined) });
    const r = await shareFile(filename, blob);
    if (r === "shared") return { status: "saved" };
    if (r === "declined") throw new SaveDeclinedError();
    // Desktop, or the share sheet isn't available / the tap expired: fall back to a normal download.
    downloadViaAnchor(blob, filename);
    return { status: "saved" };
  }
};
