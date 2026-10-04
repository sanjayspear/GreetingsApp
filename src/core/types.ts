export type Ctx = CanvasRenderingContext2D;
export type Occasion = "birthday" | "anniversary" | "custom";
export type Tone = "warm" | "funny" | "heartfelt" | "formal" | "short";
export type CardStyle = "lanterns" | "surprise" | "flash";

/** What the user typed into the form. */
export interface Details {
  occ: Occasion;
  event: string;
  to: string;
  from: string;
  relation: string;
  number: string;
  tone: Tone;
  extra: string;
}

/** The words on the card. */
export interface GreetingText {
  headline: string;
  cards: string[];
  signoff: string;
}

export interface FlashCard {
  type: "title" | "msg" | "sign";
  text: string;
}

export interface BuiltCard extends FlashCard {
  face: HTMLCanvasElement;
}

/** Shape of the event data handed to the surprise engine (and serialised into the gift file). */
export interface SurpriseData {
  occ: Occasion;
  to: string;
  number: string;
  headline?: string;
  cards: string[];
  signoff: string;
  photo: CanvasImageSource | string | null;
}

export interface DateEvent {
  id: string;
  name: string;
  relation: string;
  type: Occasion;
  custom: string;
  month: number;
  day: number;
  year: number | null;
  created: number;
}

export interface FileSaver {
  save(file: { filename: string; data: Blob | string }): Promise<{ status: "saved" }>;
}
