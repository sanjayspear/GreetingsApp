import { build } from "esbuild";
import { resolve } from "node:path";
import type { Plugin } from "vite";

// Bundles the surprise engine into a plain-JS IIFE string. The exported "surprise" HTML file
// embeds this string so it runs standalone when opened from WhatsApp / Files / email.
const ID = "virtual:gift-engine";
const RESOLVED = "\0" + ID;

export default function giftEngine(): Plugin {
  const entry = resolve(import.meta.dirname, "../src/surprise/gift-entry.ts");
  return {
    name: "gift-engine",
    resolveId(id) {
      return id === ID ? RESOLVED : null;
    },
    async load(id) {
      if (id !== RESOLVED) return null;
      const out = await build({
        entryPoints: [entry],
        bundle: true,
        format: "iife",
        globalName: "SurpriseEngine",
        minify: true,
        target: "es2020",
        write: false
      });
      this.addWatchFile(entry);
      return `export default ${JSON.stringify(out.outputFiles[0].text)};`;
    }
  };
}
