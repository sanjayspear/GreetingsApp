import type { DateEvent } from "../core/types";

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const EVENT_LABEL: Record<string, string> = { birthday: "Birthday", anniversary: "Anniversary" };

export interface Occurrence {
  date: Date;
  days: number;
  year: number;
}

export function todayMid(today: Date = new Date()): Date {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

/** Next time month/day comes around (Feb 29 falls back to Feb 28 in non-leap years). */
export function nextOccurrence(m: number, d: number, today: Date = new Date()): Occurrence {
  const t = todayMid(today);
  let y = t.getFullYear();
  const mk = (yy: number) => {
    const leap = (yy % 4 === 0 && yy % 100 !== 0) || yy % 400 === 0;
    return new Date(yy, m - 1, m === 2 && d === 29 && !leap ? 28 : d);
  };
  let dt = mk(y);
  if (dt < t) dt = mk(++y);
  return { date: dt, days: Math.round((dt.getTime() - t.getTime()) / 86400000), year: y };
}

export const labelFor = (ev: Pick<DateEvent, "type" | "custom">): string => (ev.type === "custom" ? ev.custom || "Special day" : EVENT_LABEL[ev.type]);

export interface DateInfo extends Occurrence {
  label: string;
  extra: string;
  when: string;
  number: number | null;
}

export function describe(ev: DateEvent, today: Date = new Date()): DateInfo {
  const n = nextOccurrence(ev.month, ev.day, today),
    label = labelFor(ev);
  let extra = "";
  if (ev.year) {
    const k = n.year - ev.year;
    if (k > 0) extra = ev.type === "birthday" ? ` · turns ${k}` : ` · ${k} ${k === 1 ? "year" : "years"}`;
  }
  const when = n.days === 0 ? "Today 🎉" : n.days === 1 ? "Tomorrow" : `in ${n.days} days`;
  return { ...n, label, extra, when, number: ev.year ? n.year - ev.year : null };
}

export function calLink(ev: DateEvent, today: Date = new Date()): string {
  const n = nextOccurrence(ev.month, ev.day, today),
    d = n.date,
    nd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  const f = (x: Date) => `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, "0")}${String(x.getDate()).padStart(2, "0")}`;
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `${ev.name}'s ${labelFor(ev).toLowerCase()} 🎉`,
    dates: `${f(d)}/${f(nd)}`,
    details: "Make them a greeting card!",
    recur: "RRULE:FREQ=YEARLY"
  });
  return "https://calendar.google.com/calendar/render?" + q.toString();
}

/* ---------- Storage (this device only) ---------- */
const KEY = "greeting-special-dates";

export interface DateStore {
  read(): DateEvent[];
  add(ev: Omit<DateEvent, "id">): DateEvent[];
  remove(id: string): DateEvent[];
}

export function createDeviceStore(storage: Pick<Storage, "getItem" | "setItem"> = localStorage): DateStore {
  const read = (): DateEvent[] => {
    try {
      const v = JSON.parse(storage.getItem(KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };
  const write = (arr: DateEvent[]) => {
    try {
      storage.setItem(KEY, JSON.stringify(arr));
    } catch {
      /* storage full or blocked: keep working in memory */
    }
  };
  return {
    read,
    add(ev) {
      const arr = read();
      arr.push({ ...ev, id: "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) });
      write(arr);
      return arr;
    },
    remove(id) {
      const arr = read().filter((x) => x.id !== id);
      write(arr);
      return arr;
    }
  };
}
