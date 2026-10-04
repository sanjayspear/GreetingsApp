import { describe, expect, it } from "vitest";
import { cardsFromEditor, ordinal, splitCards, titleCase } from "../src/greeting/text";

describe("ordinal", () => {
  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [22, "22nd"],
    [101, "101st"],
    [111, "111th"]
  ])("%i -> %s", (n, out) => expect(ordinal(n)).toBe(out));
});

describe("titleCase", () => {
  it("capitalises each word", () => expect(titleCase("work anniversary")).toBe("Work Anniversary"));
});

describe("splitCards", () => {
  it("keeps short text as one card", () => expect(splitCards("Happy birthday!")).toEqual(["Happy birthday!"]));
  it("splits on a blank line", () => expect(splitCards("One.\n\nTwo.\n\nThree.")).toEqual(["One.", "Two. Three."]));
  it("splits long text at the sentence boundary closest to the middle", () => {
    const msg = "I hope today is wonderful and full of cake. You deserve every bit of it and more. Thank you for always being there for me.";
    const [a, b] = splitCards(msg);
    expect(a.length).toBeGreaterThan(20);
    expect(`${a} ${b}`).toBe(msg);
  });
});

describe("cardsFromEditor", () => {
  it("treats blank lines as card breaks", () => expect(cardsFromEditor("a\n\nb")).toEqual(["a", "b"]));
  it("returns one card without blank lines", () => expect(cardsFromEditor("  just one  ")).toEqual(["just one"]));
  it("returns nothing for empty text", () => expect(cardsFromEditor("   ")).toEqual([]));
});
