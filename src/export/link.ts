import type { Occasion, SurpriseData } from "../core/types";

// Surprise link: the greeting is packed into the URL fragment (`#s=...`). Browsers never send the
// fragment to a server, so the link works from GitHub Pages without any backend. iPhone WhatsApp /
// Files only preview .html files without running scripts, but a link always opens in Safari.

export type LinkData = Omit<SurpriseData, "photo">;
export const LINK_PREFIX = "#s=";

const MAX_TEXT = 4000;
const OCCASIONS: readonly Occasion[] = ["birthday", "anniversary", "custom"];

const b64 = (bytes: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64 = (s: string): Uint8Array => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** "z" = deflate-raw compressed, "r" = plain UTF-8 (browsers without CompressionStream). */
export async function encodeLink(data: LinkData): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(data));
  if (typeof CompressionStream === "function") {
    try {
      return "z" + b64(await pipe(raw, new CompressionStream("deflate-raw")));
    } catch {
      /* fall through to uncompressed */
    }
  }
  return "r" + b64(raw);
}

const str = (v: unknown, max = MAX_TEXT): string | null => (typeof v === "string" && v.length <= max ? v : null);

/** Validate untrusted decoded JSON; returns null unless it has the exact shape we expect. */
export function parseLinkData(v: unknown): LinkData | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const to = str(o.to, 200),
    number = str(o.number ?? "", 10),
    signoff = str(o.signoff ?? ""),
    headline = o.headline == null ? undefined : str(o.headline);
  if (to === null || number === null || signoff === null || headline === null) return null;
  if (!OCCASIONS.includes(o.occ as Occasion)) return null;
  if (!Array.isArray(o.cards) || o.cards.length > 20) return null;
  const cards = o.cards.map((c) => str(c));
  if (cards.some((c) => c === null)) return null;
  return { occ: o.occ as Occasion, to, number, headline, cards: cards as string[], signoff };
}

export async function decodeLink(hash: string): Promise<LinkData | null> {
  if (!hash.startsWith(LINK_PREFIX) || hash.length < LINK_PREFIX.length + 2) return null;
  try {
    const body = hash.slice(LINK_PREFIX.length);
    let bytes = unb64(body.slice(1));
    if (body[0] === "z") bytes = await pipe(bytes, new DecompressionStream("deflate-raw"));
    else if (body[0] !== "r") return null;
    return parseLinkData(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

export async function buildGiftLink(data: LinkData, base: string): Promise<string> {
  return base.split("#")[0] + LINK_PREFIX + (await encodeLink(data));
}
