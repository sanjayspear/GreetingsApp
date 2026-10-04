import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";
import giftEngine from "./plugins/giftEngine.ts";

// GitHub Pages cannot send headers, so the policy ships as a <meta> tag (production only; dev needs inline HMR scripts).
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self' https:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'"
].join("; ");

export default defineConfig({
  // Relative asset URLs so the same build works at https://user.github.io/<repo>/ and on any other host.
  base: "./",
  plugins: [
    giftEngine(),
    {
      name: "csp-meta",
      apply: "build",
      transformIndexHtml: () => [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: csp }, injectTo: "head-prepend" }]
    },
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Greetings",
        short_name: "Greetings",
        description: "Make animated greeting cards for the people you love.",
        theme_color: "#D1245E",
        background_color: "#F6F4F9",
        display: "standalone",
        orientation: "portrait",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "index.html"
      }
    })
  ],
  build: { target: "es2022", sourcemap: false },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node"
  }
});
