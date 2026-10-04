import { describe, expect, it } from "vitest";
import type { DateEvent } from "../src/core/types";
import { calLink, createDeviceStore, describe as describeEvent, nextOccurrence } from "../src/dates/logic";

const ev = (over: Partial<DateEvent> = {}): DateEvent => ({
  id: "d1",
  name: "Priya",
  relation: "friend",
  type: "birthday",
  custom: "",
  month: 3,
  day: 15,
  year: 1990,
  created: 0,
  ...over
});

describe("nextOccurrence", () => {
  const today = new Date(2026, 2, 10); // 10 Mar 2026
  it("counts days until a date later this year", () => {
    const n = nextOccurrence(3, 15, today);
    expect(n.days).toBe(5);
    expect(n.year).toBe(2026);
  });
  it("is today when the date is today", () => expect(nextOccurrence(3, 10, today).days).toBe(0));
  it("rolls into next year when the date has passed", () => {
    const n = nextOccurrence(3, 9, today);
    expect(n.year).toBe(2027);
    expect(n.days).toBe(364);
  });
  it("moves Feb 29 to Feb 28 in a non-leap year", () => {
    const n = nextOccurrence(2, 29, new Date(2027, 0, 1));
    expect(n.date.getMonth()).toBe(1);
    expect(n.date.getDate()).toBe(28);
  });
  it("keeps Feb 29 in a leap year", () => expect(nextOccurrence(2, 29, new Date(2028, 0, 1)).date.getDate()).toBe(29));
});

describe("describe", () => {
  const today = new Date(2026, 2, 10);
  it("shows the age a birthday turns", () => {
    const d = describeEvent(ev(), today);
    expect(d.extra).toBe(" · turns 36");
    expect(d.when).toBe("in 5 days");
    expect(d.number).toBe(36);
  });
  it("says Tomorrow / Today", () => {
    expect(describeEvent(ev({ day: 11 }), today).when).toBe("Tomorrow");
    expect(describeEvent(ev({ day: 10 }), today).when).toBe("Today 🎉");
  });
  it("counts years for anniversaries and uses custom labels", () => {
    expect(describeEvent(ev({ type: "anniversary", year: 2025 }), today).extra).toBe(" · 1 year");
    expect(describeEvent(ev({ type: "custom", custom: "Graduation", year: null }), today).label).toBe("Graduation");
  });
  it("has no age when the year is unknown", () => {
    const d = describeEvent(ev({ year: null }), today);
    expect(d.extra).toBe("");
    expect(d.number).toBeNull();
  });
});

describe("calLink", () => {
  it("builds a yearly recurring Google Calendar link", () => {
    const url = new URL(calLink(ev(), new Date(2026, 2, 10)));
    expect(url.hostname).toBe("calendar.google.com");
    expect(url.searchParams.get("dates")).toBe("20260315/20260316");
    expect(url.searchParams.get("recur")).toBe("RRULE:FREQ=YEARLY");
    expect(url.searchParams.get("text")).toContain("Priya's birthday");
  });
});

describe("device store", () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };
  const { id: _id, ...draft } = ev();
  void _id;

  it("adds, lists and removes dates", () => {
    const store = createDeviceStore(memory());
    expect(store.read()).toEqual([]);
    const [added] = store.add(draft);
    expect(added.id).toMatch(/^d/);
    expect(store.read()).toHaveLength(1);
    expect(store.remove(added.id)).toEqual([]);
  });
  it("survives corrupt storage", () => {
    const s = memory();
    s.setItem("greeting-special-dates", "{not json");
    expect(createDeviceStore(s).read()).toEqual([]);
  });
  it("keeps working when writing fails", () => {
    const store = createDeviceStore({
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      }
    });
    expect(() => store.add(draft)).not.toThrow();
  });
});
