import { describe, expect, it } from "vitest";
import type { Details, Occasion, Tone } from "../src/core/types";
import { templateGreeting } from "../src/greeting/templates";
import { normalizeAiReply } from "../src/greeting/ai";

const base: Details = { occ: "birthday", event: "birthday", to: "Priya", from: "Arjun", relation: "friend", number: "", tone: "warm", extra: "" };
const TONES: Tone[] = ["warm", "funny", "heartfelt", "formal", "short"];
const OCCS: Occasion[] = ["birthday", "anniversary", "custom"];

describe("templateGreeting", () => {
  it.each(OCCS.flatMap((occ) => TONES.map((tone) => [occ, tone] as const)))("%s / %s writes a headline, message and sign-off", (occ, tone) => {
    const out = templateGreeting({ ...base, occ, tone, event: occ === "custom" ? "graduation" : occ }, 0);
    expect(out.headline).toContain("Priya");
    expect(out.message.length).toBeGreaterThan(10);
    expect(out.signoff).toContain("Arjun");
  });

  it("uses the ordinal for birthdays with an age", () => {
    expect(templateGreeting({ ...base, number: "30" }, 0).headline).toBe("Happy 30th, Priya!");
  });
  it("cycles through variants and wraps around", () => {
    const a = templateGreeting(base, 0).message,
      b = templateGreeting(base, 1).message;
    expect(a).not.toBe(b);
    expect(templateGreeting(base, 2).message).toBe(a);
  });
  it("weaves in the personal detail except for short/formal tones", () => {
    const extra = "our road trip to Goa.";
    expect(templateGreeting({ ...base, extra }, 0).message).toContain("our road trip to Goa");
    expect(templateGreeting({ ...base, extra, tone: "formal" }, 0).message).not.toContain("Goa");
  });
  it("omits the sign-off with no sender, and formal tone signs off formally", () => {
    expect(templateGreeting({ ...base, from: "" }, 0).signoff).toBe("");
    expect(templateGreeting({ ...base, tone: "formal" }, 0).signoff).toMatch(/^Best regards,/);
  });
  it("adds 'my love' for partner anniversaries", () => {
    expect(templateGreeting({ ...base, occ: "anniversary", relation: "partner", number: "10" }, 0).headline).toContain("my love");
  });
});

describe("normalizeAiReply", () => {
  it("accepts the expected shape and caps at two cards", () => {
    expect(normalizeAiReply({ headline: "Hi Priya", cards: ["a", "b", "c"], signoff: "Love,\nA" })).toEqual({ headline: "Hi Priya", cards: ["a", "b"], signoff: "Love,\nA" });
  });
  it("falls back to splitting a single message", () => {
    expect(normalizeAiReply({ headline: "x", message: "One.\n\nTwo." })?.cards).toEqual(["One.", "Two."]);
  });
  it.each([null, undefined, "text", {}, { cards: [] }, { cards: ["  "] }])("rejects %j", (bad) => {
    expect(normalizeAiReply(bad)).toBeNull();
  });
});
