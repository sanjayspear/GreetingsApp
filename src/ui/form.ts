import type { Details, Occasion, Tone } from "../core/types";
import { $ } from "../core/dom";
import { OCC, state } from "../state";

export const toName = (): string => $<HTMLInputElement>("toName").value.trim();

export function details(): Details {
  const val = (id: string) => $<HTMLInputElement>(id).value.trim();
  return {
    occ: state.occ as Occasion,
    event: state.occ === "custom" ? val("customEvent") : state.occ,
    to: val("toName"),
    from: val("fromName"),
    relation: $<HTMLSelectElement>("relation").value,
    number: OCC[state.occ].numLabel ? val("number") : "",
    tone: state.tone as Tone,
    extra: val("extra")
  };
}

export function validate(d: Details): string {
  if (!d.to) return "Add the name of the person you're greeting.";
  if (d.occ === "custom" && !d.event) return "Name the event you're celebrating.";
  return "";
}
