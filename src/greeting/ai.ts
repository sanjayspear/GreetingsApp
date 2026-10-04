import type { Details, GreetingText } from "../core/types";
import { splitCards } from "./text";
import { templateGreeting } from "./templates";

/**
 * Optional AI greetings. GitHub Pages is static hosting, so the app never holds an API key.
 * To enable AI, deploy a small proxy (Cloudflare Worker, Vercel function, ...) that calls the
 * model and returns {"headline": "...", "cards": ["..."], "signoff": "..."}, then build with
 *   VITE_AI_ENDPOINT=https://your-proxy.example.com/greeting
 * If it is not set, or the request fails, the built-in templates are used, so the app always works.
 */
const ENDPOINT: string | undefined = import.meta.env.VITE_AI_ENDPOINT;
const TIMEOUT_MS = 8000;

export const aiEnabled = Boolean(ENDPOINT);

export function normalizeAiReply(out: unknown): GreetingText | null {
  if (!out || typeof out !== "object") return null;
  const o = out as Record<string, unknown>;
  let cards = Array.isArray(o.cards) ? o.cards.map(String).filter((s) => s.trim()) : [];
  if (!cards.length && o.message) cards = splitCards(String(o.message));
  if (!cards.length) return null;
  return { headline: String(o.headline || ""), cards: cards.slice(0, 2), signoff: String(o.signoff || "") };
}

async function fetchAiGreeting(d: Details, variant: number): Promise<GreetingText | null> {
  if (!ENDPOINT) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...d, variant }),
      signal: ctl.signal
    });
    if (!res.ok) return null;
    return normalizeAiReply(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** AI when configured and reachable, otherwise offline templates. Never throws. */
export async function getGreeting(d: Details, variant: number): Promise<GreetingText> {
  const ai = await fetchAiGreeting(d, variant);
  if (ai) return ai;
  const t = templateGreeting(d, variant);
  return { headline: t.headline, cards: splitCards(t.message), signoff: t.signoff };
}
