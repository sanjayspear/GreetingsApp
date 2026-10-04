export const W = 1080;
export const H = 1350;
export const TAU = Math.PI * 2;

/** Small deterministic PRNG so particles look the same on every frame and every export. */
export function rng(seed: number): () => number {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}
export const pick = <T>(r: () => number, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];
export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
export const easeOut = (v: number): number => 1 - Math.pow(1 - clamp01(v), 3);
export const easeIn = (v: number): number => Math.pow(clamp01(v), 3);
export const easeInOut = (v: number): number => {
  v = clamp01(v);
  return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
};
export const easeBack = (v: number): number => {
  v = clamp01(v);
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(v - 1, 3) + c * Math.pow(v - 1, 2);
};
/** Always-positive modulo. */
export const mod = (a: number, n: number): number => ((a % n) + n) % n;

/** Lighten (f > 1) or darken (f < 1) a #rrggbb colour. */
export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16),
    r = n >> 16,
    g = (n >> 8) & 255,
    b = n & 255;
  const m = (v: number) => Math.max(0, Math.min(255, Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1))));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

export function seeds<T>(n: number, seed: number, f: (r: () => number, i: number) => T): T[] {
  const r = rng(seed),
    out: T[] = [];
  for (let i = 0; i < n; i++) out.push(f(r, i));
  return out;
}
