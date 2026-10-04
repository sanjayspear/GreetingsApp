import { describe, expect, it } from "vitest";
import { clamp01, easeBack, easeIn, easeInOut, easeOut, mod, pick, rng, seeds, shade } from "../src/core/math";

describe("rng", () => {
  it("is deterministic for a seed", () => {
    const a = rng(7),
      b = rng(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("stays in [0, 1)", () => {
    const r = rng(123);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it("seeds() produces the same particles every time", () => {
    expect(seeds(5, 3, (r) => r())).toEqual(seeds(5, 3, (r) => r()));
  });
  it("pick() chooses from the array", () => {
    expect(["a", "b", "c"]).toContain(pick(rng(1), ["a", "b", "c"]));
  });
});

describe("easing", () => {
  it("clamps to 0..1", () => {
    expect(clamp01(-4)).toBe(0);
    expect(clamp01(9)).toBe(1);
    expect(clamp01(0.4)).toBe(0.4);
  });
  it.each([easeOut, easeIn, easeInOut, easeBack])("starts at 0 and ends at 1", (fn) => {
    expect(fn(0)).toBeCloseTo(0, 5);
    expect(fn(1)).toBeCloseTo(1, 5);
  });
  it("easeBack overshoots", () => {
    expect(Math.max(...[0.6, 0.7, 0.8, 0.9].map(easeBack))).toBeGreaterThan(1);
  });
});

describe("mod", () => {
  it("never returns a negative number", () => {
    expect(mod(-1, 5)).toBe(4);
    expect(mod(11, 5)).toBe(1);
  });
});

describe("shade", () => {
  it("darkens and lightens", () => {
    expect(shade("#808080", 0.5)).toBe("rgb(64,64,64)");
    expect(shade("#000000", 2)).toBe("rgb(255,255,255)");
  });
});
