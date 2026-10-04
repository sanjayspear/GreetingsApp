import { $ } from "../core/dom";

/* Bottom sheets */
export function closeSheets(): void {
  ["editPanel", "sharePanel", "dateForm"].forEach((id) => $(id).classList.add("hidden"));
  ["editBtn", "share", "addDateBtn"].forEach((id) => $(id).setAttribute("aria-expanded", "false"));
  $("backdrop").classList.add("hidden");
}

export function togglePanel(btn: HTMLElement, panel: HTMLElement): void {
  const open = panel.classList.contains("hidden");
  closeSheets();
  if (open) {
    panel.classList.remove("hidden");
    btn.setAttribute("aria-expanded", "true");
    $("backdrop").classList.remove("hidden");
  }
}

export function initSheets(): void {
  $("backdrop").addEventListener("click", closeSheets);
  document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeSheets));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSheets();
  });
}
