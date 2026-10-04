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

export const webDownloads: FileSaver = {
  async save({ filename, data }) {
    const blob = new Blob([data], { type: mimeFor(filename, data instanceof Blob ? data.type : undefined) });
    if (prefersShareSheet() && typeof navigator.canShare === "function" && typeof navigator.share === "function") {
      try {
        const file = new File([blob], filename, { type: blob.type });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
          return { status: "saved" };
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") throw new SaveDeclinedError();
        // Any other failure (e.g. the user gesture expired while a long video was encoding): download instead.
      }
    }
    downloadViaAnchor(blob, filename);
    return { status: "saved" };
  }
};
