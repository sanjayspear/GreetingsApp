import { $ } from "../core/dom";

// "Install app" button. Chrome/Edge/Android fire `beforeinstallprompt`; iOS Safari has no install
// API, so there we show how to use Share > Add to Home Screen.
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const isStandalone = (): boolean => matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = (): boolean => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

export function initInstall(): void {
  const btn = $("installBtn"),
    help = $("installHelp");
  if (isStandalone()) return;
  let deferred: InstallPromptEvent | null = null;
  const hide = () => {
    btn.classList.add("hidden");
    help.classList.add("hidden");
  };

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    btn.classList.remove("hidden");
  });
  window.addEventListener("appinstalled", hide);

  if (isIos()) btn.classList.remove("hidden");

  btn.addEventListener("click", async () => {
    if (deferred) {
      const p = deferred;
      deferred = null;
      await p.prompt();
      const { outcome } = await p.userChoice;
      if (outcome === "accepted") hide();
      else btn.classList.add("hidden");
    } else help.classList.toggle("hidden");
  });
  $("installHelpClose").addEventListener("click", () => help.classList.add("hidden"));
}
