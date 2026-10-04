import type { Details, Tone } from "../core/types";
import { ordinal, titleCase } from "./text";

export interface TemplateGreeting {
  headline: string;
  message: string;
  signoff: string;
}

/** Offline greeting writer: picks from hand-written lines by occasion, tone and variant. */
export function templateGreeting(d: Details, v: number): TemplateGreeting {
  const n = parseInt(d.number, 10);
  const to = d.to,
    ev = titleCase(d.event);
  const sign = d.from ? (d.tone === "formal" ? "Best regards,\n" : "With love,\n") + d.from : "";
  const personal = d.extra ? ` I keep thinking about ${d.extra.replace(/[.!]+$/, "")}, and it makes me smile every time.` : "";
  let head: string;
  let lines: Record<Tone, string[]>;
  if (d.occ === "birthday") {
    head = n ? `Happy ${ordinal(n)}, ${to}!` : `Happy birthday, ${to}!`;
    lines = {
      warm: [
        `Wishing you a day as bright and kind as you are. May this year bring you good health, big laughs and everything you've been hoping for.`,
        `Another trip around the sun, and you just keep getting better. I hope today is full of the people and things you love most.`
      ],
      funny: [
        `${n ? `${n}? ` : ""}Don't worry, you don't look a day over fabulous. Eat the cake, ignore the candles, and let's pretend nobody's counting.`,
        `They say age is just a number. In your case it's a pretty big one, but you wear it well! Have an amazing day.`
      ],
      heartfelt: [
        `Life is so much better with you in it. Thank you for being exactly who you are. I hope this year gives back even a little of the joy you give everyone around you.`,
        `Today I'm celebrating you and every moment that makes you so special. You deserve all the happiness in the world, today and always.`
      ],
      formal: [
        `Wishing you a very happy birthday and a year ahead filled with success, good health and happiness.`,
        `On your birthday, please accept my warmest wishes for a wonderful year ahead.`
      ],
      short: [`Have the best day ever. You deserve it!`, `Cake, smiles and all the good things. Happy birthday!`]
    };
  } else if (d.occ === "anniversary") {
    head = n ? `Happy ${ordinal(n)} anniversary${d.relation === "partner" ? ", my love" : `, ${to}`}!` : `Happy anniversary, ${to}!`;
    lines = {
      warm: [
        `${n ? `${n} years` : "Every year"} of laughter, love and growing together. Here's to many more adventures side by side.`,
        `Watching your love story is a joy. Wishing you a beautiful anniversary and many happy years ahead.`
      ],
      funny: [
        `${n ? `${n} years` : "All these years"} and still choosing each other every day. That's either true love or very good patience. Happy anniversary!`,
        `Congratulations on putting up with each other for ${n ? `${n} whole years` : "this long"}! Truly inspiring stuff.`
      ],
      heartfelt: [
        `Every day with you feels like home. Thank you for ${n ? `${n} years` : "every year"} of love, patience and quiet little moments I'll treasure forever.`,
        `Your love is a reminder of what really matters. May it keep growing deeper with every passing year.`
      ],
      formal: [
        `Warmest congratulations on your ${n ? ordinal(n) + " " : ""}wedding anniversary. Wishing you continued happiness together.`,
        `Please accept my heartfelt congratulations on this special milestone.`
      ],
      short: [`Here's to love, laughter and forever. Happy anniversary!`, `Still the best team I know. Cheers to you!`]
    };
  } else {
    head = `Happy ${ev}, ${to}!`;
    lines = {
      warm: [
        `Sending you warm wishes on your ${d.event}. This is a moment worth celebrating, and I'm so happy for you.`,
        `What a wonderful occasion! Wishing you joy today and good things in everything that comes next.`
      ],
      funny: [
        `Your ${d.event}! Clearly a big deal, so I'm officially declaring today all about you. Celebrate like you mean it.`,
        `Congrats on the ${d.event}! Please remember the little people (me) when you're famous.`
      ],
      heartfelt: [
        `I'm so proud of you and so grateful to share in moments like this. Your ${d.event} is a reminder of how far you've come.`,
        `Moments like your ${d.event} remind me how lucky I am to know you. Wishing you every happiness.`
      ],
      formal: [
        `Warm congratulations on your ${d.event}. Wishing you continued success and happiness.`,
        `Please accept my best wishes on the occasion of your ${d.event}.`
      ],
      short: [`Congratulations! So happy for you.`, `Big cheers on your ${d.event}!`]
    };
  }
  const pool = lines[d.tone];
  const msg = pool[v % pool.length] + (d.tone === "short" || d.tone === "formal" ? "" : personal);
  return { headline: head, message: msg, signoff: sign };
}
