import type { DateEvent, Occasion } from "../core/types";
import { $, toast } from "../core/dom";
import { reduced } from "../state";
import { closeSheets } from "../ui/sheets";
import { EVENT_LABEL, MONTHS, calLink, createDeviceStore, describe, type DateInfo } from "./logic";

const store = createDeviceStore();
let dates: DateEvent[] = [];

export function showTab(tab: "create" | "dates"): void {
  document.querySelectorAll<HTMLElement>(".tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
  $("tabCreate").classList.toggle("hidden", tab !== "create");
  $("ctaBar").classList.toggle("hidden", tab !== "create");
  $("tabDates").classList.toggle("hidden", tab !== "dates");
  window.scrollTo({ top: 0 });
}

function prefill(ev: DateEvent, info: DateInfo) {
  showTab("create");
  document.querySelector<HTMLElement>(`.occ[data-occ="${ev.type}"]`)?.click();
  if (ev.type === "custom") $<HTMLInputElement>("customEvent").value = ev.custom || "";
  $<HTMLInputElement>("toName").value = ev.name;
  if (ev.relation) $<HTMLSelectElement>("relation").value = ev.relation;
  $<HTMLInputElement>("number").value = info.number && info.number > 0 && ev.type !== "custom" ? String(info.number) : "";
  $("det-h").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  toast(`Filled in ${ev.name}'s details`);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function renderDates() {
  const list = $("dateList");
  list.innerHTML = "";
  const items = dates.map((ev) => ({ ev, info: describe(ev) })).sort((a, b) => a.info.days - b.info.days);
  $("dateEmpty").classList.toggle("hidden", items.length > 0);
  const soon = items.filter((x) => x.info.days <= 7);
  $("datesBadge").textContent = String(soon.length);
  $("datesBadge").classList.toggle("hidden", soon.length === 0);
  // "coming up soon" banner
  $("soonBox").innerHTML = "";
  if (soon.length) {
    const first = soon[0],
      box = el("div", "soon");
    const big = el("span", "big", first.ev.type === "anniversary" ? "💍" : first.ev.type === "birthday" ? "🎂" : "✨");
    const p = el("p");
    const strong = el(
      "strong",
      "",
      `${first.ev.name}'s ${first.info.label.toLowerCase()} is ${first.info.days === 0 ? "today!" : first.info.days === 1 ? "tomorrow!" : first.info.when + "."}`
    );
    p.append(strong, document.createTextNode(soon.length > 1 ? ` Plus ${soon.length - 1} more this week.` : " Make them a card now."));
    const b = el("button", "btn btn-primary", "Make card");
    b.type = "button";
    b.style.cssText = "width:auto;margin:0 0 0 auto;padding:10px 14px";
    b.addEventListener("click", () => prefill(first.ev, first.info));
    box.append(big, p, b);
    $("soonBox").appendChild(box);
  }
  items.forEach(({ ev, info }) => {
    const li = el("li", "date-row");
    const tile = el("div", "tile");
    tile.append(el("span", "m", MONTHS[ev.month - 1].toUpperCase()), el("span", "d", String(ev.day)));
    const who = el("div", "who");
    who.append(el("strong", "", ev.name), el("span", "", info.label + info.extra));
    const cnt = el("span", "count" + (info.days <= 7 ? " near" : ""), info.when);
    const acts = el("div", "row-actions");
    const mk = el("button", "btn btn-ghost", "Make card");
    mk.type = "button";
    mk.addEventListener("click", () => prefill(ev, info));
    const cal = el("a", "btn btn-ghost", "📅 Remind me");
    cal.href = calLink(ev);
    cal.target = "_blank";
    cal.rel = "noopener noreferrer";
    const del = el("button", "btn link-btn del", "Remove");
    del.type = "button";
    del.addEventListener("click", () => {
      if (del.dataset.confirm !== "1") {
        del.dataset.confirm = "1";
        del.textContent = "Tap again to remove";
        setTimeout(() => {
          del.dataset.confirm = "";
          del.textContent = "Remove";
        }, 3000);
        return;
      }
      dates = store.remove(ev.id);
      renderDates();
    });
    acts.append(mk, cal, del);
    li.append(tile, who, cnt, acts);
    list.appendChild(li);
  });
}

function openDateForm(open: boolean) {
  closeSheets();
  if (!open) return;
  $("dateForm").classList.remove("hidden");
  $("backdrop").classList.remove("hidden");
  $("addDateBtn").setAttribute("aria-expanded", "true");
  $("dErr").textContent = "";
  setTimeout(() => $("dName").focus(), 250);
}

export function initDates(): void {
  $("dRel").innerHTML = $("relation").innerHTML;
  $("dType").addEventListener("change", () => {
    $("dCustomWrap").style.display = $<HTMLSelectElement>("dType").value === "custom" ? "" : "none";
  });
  $("addDateBtn").addEventListener("click", () => openDateForm(true));
  $("cancelDate").addEventListener("click", () => openDateForm(false));
  $("saveDate").addEventListener("click", () => {
    const val = (id: string) => $<HTMLInputElement>(id).value.trim();
    const name = val("dName"),
      type = $<HTMLSelectElement>("dType").value as Occasion,
      custom = val("dCustom"),
      v = $<HTMLInputElement>("dDate").value;
    if (!name) return void ($("dErr").textContent = "Add their name.");
    if (!v) return void ($("dErr").textContent = "Pick the date.");
    if (type === "custom" && !custom) return void ($("dErr").textContent = "Name the event.");
    const [y, m, d] = v.split("-").map(Number);
    dates = store.add({
      name,
      relation: $<HTMLSelectElement>("dRel").value,
      type,
      custom: type === "custom" ? custom : "",
      month: m,
      day: d,
      year: $<HTMLInputElement>("dYearKnown").checked ? y : null,
      created: Date.now()
    });
    renderDates();
    $<HTMLInputElement>("dName").value = "";
    $<HTMLInputElement>("dCustom").value = "";
    $<HTMLInputElement>("dDate").value = "";
    openDateForm(false);
    toast(`Saved ${name}'s ${type === "custom" ? custom : EVENT_LABEL[type].toLowerCase()}`);
  });
  $("storeNote").textContent = "Saved on this device only.";
  dates = store.read();
  renderDates();
  document.querySelectorAll<HTMLElement>(".tab").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab as "create" | "dates")));
}
