# Greetings — project guide

Animated greeting-card maker (birthday / anniversary / custom). Static site: Vite + TypeScript, installable PWA, no backend, deployed to GitHub Pages.

## Commands
- `npm run dev` — dev server (http://localhost:5173)
- `npm run lint` / `npm run typecheck` / `npm test` — all must pass before finishing a change
- `npm run build` — typecheck + production build to `dist/`
- `npm run preview` — serve `dist/`; use this to test the service worker, CSP and downloads
- `npm run icons` — regenerate `public/icons/*`

If `npm install` fails with EACCES on `~/.npm`, pass `--cache <temp dir>` (the cache has root-owned files).

## Layout
- `src/main.ts` wires UI; `src/state.ts` holds shared state (`state`, `now()`, `reduced`, `OCC`).
- `src/cards/` canvas renderers: `lanterns.ts`, `flash.ts` + `designs.ts`, `render.ts` (frame loop, `paintTo`, `render`, `showCard`).
- `src/surprise/engine.ts` interactive gift game. It is ALSO bundled alone into the exported surprise HTML by `plugins/giftEngine.ts` (`virtual:gift-engine`), so it must not import app state or look up DOM ids.
- `src/greeting/` templates, text helpers, optional AI proxy client (`VITE_AI_ENDPOINT`).
- `src/export/` `downloads.ts` (file saving), `video.ts` (WebCodecs MP4 + MediaRecorder fallback), `gift.ts` (standalone HTML).
- `src/dates/` special dates; pure logic in `logic.ts` (tested), DOM in `ui.ts`.
- `tests/` Vitest. `legacy/` original single-file app, reference only.

## Conventions and gotchas
- Canvas is 1080×1350 (`W`, `H` in `core/math.ts`). Particle positions are pure functions of time using the seeded `rng`, so frames and exports are reproducible. Never use `Math.random()` in renderers.
- Keep pure logic (dates, text, templates, download helpers) free of DOM at import time so it stays unit-testable; modules that call `$()` at import (`cards/render.ts`) are not imported by tests.
- Downloads: desktop browsers must use the anchor download; the share sheet is for touch devices only (`prefersShareSheet`). Don't reintroduce `navigator.share` on desktop — it hid downloads on Mac Chrome.
- Video export draws every frame; background tabs are throttled, so the tab must stay visible.
- Vite `base` is `"./"` so the build works under `user.github.io/<repo>/`. Use relative asset URLs.
- No API keys in the client. AI greetings go through a user-hosted proxy and always fall back to templates.

## Security rules
- User text must only reach the DOM via `textContent`, form `.value`, or canvas `fillText`. Existing `innerHTML` uses are static strings only; keep it that way.
- Production CSP is injected as a `<meta>` by `vite.config.ts` (script-src 'self', no inline scripts). Adding an external script/style/font origin requires updating it deliberately.
- The exported surprise file embeds user data: JSON is escaped (`<` → `<`) and the title strips `<>&"`. Preserve this when editing `export/gift.ts`.
- The surprise file has its own CSP (`default-src 'none'`, fonts embedded as data: URIs in `export/giftFonts.ts`). It must never load anything over the network; don't add remote fonts/scripts to it.
- External links keep `rel="noopener noreferrer"`. Photos are type- and size-checked in `ui/photo.ts`.
- `SECURITY.md` documents the privacy promises; update it if data handling changes.
- Special dates and photos stay on the device (localStorage / in memory); don't add network calls that send them anywhere.
