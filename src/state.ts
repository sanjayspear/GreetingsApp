import type { BuiltCard, CardStyle, GreetingText, Occasion, Tone } from "./core/types";

export interface AppState {
  occ: Occasion;
  tone: Tone;
  variant: number;
  design: string;
  style: CardStyle;
  designChosen: boolean;
  photo: HTMLCanvasElement | null;
  text: GreetingText | null;
  cards: BuiltCard[];
  /** Clock time (seconds) the story started; the animation position is `now() - revealAt`. */
  revealAt: number;
  running: boolean;
}

export const state: AppState = {
  occ: "birthday",
  tone: "warm",
  variant: 0,
  design: "confetti",
  style: "lanterns",
  designChosen: false,
  photo: null,
  text: null,
  cards: [],
  revealAt: Infinity,
  running: false
};

export const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const clockStart = performance.now();
export const now = (): number => (performance.now() - clockStart) / 1000;

/** Per-occasion defaults. */
export const OCC: Record<Occasion, { numLabel: string | null; design: string }> = {
  birthday: { numLabel: "Turning", design: "confetti" },
  anniversary: { numLabel: "Years together", design: "floral" },
  custom: { numLabel: null, design: "watercolor" }
};
