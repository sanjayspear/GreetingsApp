export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"],
    v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Split one message into 1-2 flash-card sized parts at a sentence boundary. */
export function splitCards(msg: string): string[] {
  const parts = String(msg)
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) return [parts[0], parts.slice(1).join(" ")];
  const sent = (msg.match(/[^.!?]+[.!?]+["')]*|[^.!?]+$/g) || [msg]).map((s) => s.trim()).filter(Boolean);
  if (sent.length < 2 || msg.length < 90) return [msg.trim()];
  let best = 1,
    bestDiff = Infinity;
  for (let i = 1; i < sent.length; i++) {
    const a = sent.slice(0, i).join(" ").length,
      b = sent.slice(i).join(" ").length,
      df = Math.abs(a - b);
    if (df < bestDiff) {
      bestDiff = df;
      best = i;
    }
  }
  return [sent.slice(0, best).join(" "), sent.slice(best).join(" ")];
}

/** Split text typed into the "Edit words" box into cards (blank line = new card). */
export function cardsFromEditor(text: string): string[] {
  return /\n\s*\n/.test(text)
    ? text
        .split(/\n\s*\n/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [text.trim()].filter(Boolean);
}
