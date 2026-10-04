// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SaveDeclinedError, mimeFor, prefersShareSheet, webDownloads } from "../src/export/downloads";

describe("mimeFor", () => {
  it("maps known extensions", () => {
    expect(mimeFor("card.mp4")).toBe("video/mp4");
    expect(mimeFor("card.PNG")).toBe("image/png");
    expect(mimeFor("surprise.html")).toBe("text/html");
  });
  it("falls back for unknown ones", () => expect(mimeFor("x.bin")).toBe("application/octet-stream"));
});

describe("prefersShareSheet", () => {
  it("is false on a desktop Mac (no touch)", () => {
    expect(prefersShareSheet({ maxTouchPoints: 0, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130" })).toBe(false);
  });
  it("is true on an iPhone and on iPadOS (which reports as Macintosh)", () => {
    expect(prefersShareSheet({ maxTouchPoints: 5, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)" })).toBe(true);
    expect(prefersShareSheet({ maxTouchPoints: 5, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari" })).toBe(true);
  });
  it("is true on Android", () => {
    expect(prefersShareSheet({ maxTouchPoints: 5, userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile" })).toBe(true);
  });
});

describe("webDownloads.save (desktop)", () => {
  let created: Blob | null;
  let clicked: { href: string; download: string } | null;

  beforeEach(() => {
    created = null;
    clicked = null;
    vi.stubGlobal("URL", {
      createObjectURL: (b: Blob) => {
        created = b;
        return "blob:test";
      },
      revokeObjectURL: vi.fn()
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked = { href: this.href, download: this.download };
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("triggers a normal file download with the right name and type", async () => {
    const res = await webDownloads.save({ filename: "Priya-card.png", data: new Blob(["x"], { type: "image/png" }) });
    expect(res).toEqual({ status: "saved" });
    expect(clicked).toEqual({ href: "blob:test", download: "Priya-card.png" });
    expect(created?.type).toBe("image/png");
  });

  it("downloads text (the surprise file) as HTML", async () => {
    await webDownloads.save({ filename: "a-surprise.html", data: "<!DOCTYPE html>" });
    expect(created?.type).toBe("text/html");
    expect(clicked?.download).toBe("a-surprise.html");
  });

  it("does not use the share sheet on desktop even if the browser supports it", async () => {
    const share = vi.fn();
    vi.stubGlobal("navigator", { maxTouchPoints: 0, userAgent: "Macintosh Chrome", canShare: () => true, share });
    await webDownloads.save({ filename: "v.mp4", data: new Blob(["x"]) });
    expect(share).not.toHaveBeenCalled();
    expect(clicked?.download).toBe("v.mp4");
  });
});

describe("webDownloads.save (phone)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  const phone = (share: () => Promise<void>) =>
    vi.stubGlobal("navigator", { maxTouchPoints: 5, userAgent: "iPhone", canShare: () => true, share });

  it("uses the share sheet", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    phone(share);
    await webDownloads.save({ filename: "v.mp4", data: new Blob(["x"]) });
    expect(share).toHaveBeenCalledOnce();
  });
  it("reports a cancelled share sheet as declined", async () => {
    phone(() => Promise.reject(new DOMException("cancelled", "AbortError")));
    await expect(webDownloads.save({ filename: "v.mp4", data: new Blob(["x"]) })).rejects.toBeInstanceOf(SaveDeclinedError);
  });
  it("falls back to a download if sharing fails for another reason", async () => {
    phone(() => Promise.reject(new DOMException("no gesture", "NotAllowedError")));
    vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await webDownloads.save({ filename: "v.mp4", data: new Blob(["x"]) });
    expect(click).toHaveBeenCalledOnce();
  });
});
