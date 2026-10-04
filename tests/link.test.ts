import { describe, expect, it } from "vitest";
import { buildGiftLink, decodeLink, parseLinkData, type LinkData } from "../src/export/link";

const data: LinkData = { occ: "birthday", to: "Priya <b>", number: "30", headline: "Happy birthday!", cards: ["Line one 🎉", "Line two"], signoff: "Love,\nArjun" };

describe("surprise link", () => {
  it("round-trips the greeting", async () => {
    const url = await buildGiftLink(data, "https://x.github.io/app/?a=1#old");
    expect(url.startsWith("https://x.github.io/app/?a=1#s=")).toBe(true);
    expect(await decodeLink(url.slice(url.indexOf("#")))).toEqual(data);
  });
  it("rejects garbage and wrong shapes", async () => {
    expect(await decodeLink("#s=zzzz")).toBeNull();
    expect(await decodeLink("#other")).toBeNull();
    expect(parseLinkData({ occ: "evil", to: "a", cards: [] })).toBeNull();
    expect(parseLinkData({ occ: "custom", to: "a", cards: [1] })).toBeNull();
    expect(parseLinkData({ occ: "custom", to: "a".repeat(5000), cards: [] })).toBeNull();
  });
});
