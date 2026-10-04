# Greetings

Animated greeting-card maker (birthday, anniversary, any occasion). Vite + TypeScript, installable PWA, no backend.

## Develop

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # vitest
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run build      # -> dist/
npm run preview    # serve dist/ (use this to test the PWA / service worker)
```

## Layout

| Path | What |
| --- | --- |
| `src/main.ts` | Wires the UI together |
| `src/state.ts` | Shared app state |
| `src/cards/` | Canvas renderers: `lanterns`, `flash` (+ `designs`), `render` (frame loop) |
| `src/surprise/engine.ts` | Interactive gift game; also bundled into the exported surprise file |
| `src/greeting/` | Offline templates, text helpers, optional AI proxy client |
| `src/audio/music.ts` | Generated soundtrack |
| `src/export/` | `downloads` (file saving), `video` (MP4/WebM), `gift` (standalone HTML) |
| `src/dates/` | Special-dates tab (pure logic in `logic.ts`) |
| `plugins/giftEngine.ts` | Vite plugin that bundles the engine into a string for the surprise file |
| `legacy/` | The original single-file app, for reference |

## Deploy to GitHub Pages

1. Push to `main` of a GitHub repo.
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` lints, type-checks, tests, builds and deploys.

The build uses relative URLs (`base: "./"`), so it works at `https://<user>.github.io/<repo>/` without configuration.

## Downloads

Files are saved with a normal browser download on desktop. On phones the OS share sheet is used when available
(so a card can go straight to WhatsApp), falling back to a download. Video export renders frame by frame:
keep the tab visible while "Making video…" runs, because browsers throttle background tabs.

## AI greetings (optional)

GitHub Pages is static, so there is no API key in the app and greetings come from built-in templates.
To use AI, deploy a small proxy that calls the model and returns `{"headline","cards":[...],"signoff"}`, then set the
repo variable `VITE_AI_ENDPOINT` (or export it when building locally). On any error the app falls back to templates.

## Regenerating icons

`npm run icons` rewrites `public/icons/*`.

## License

MIT, see [LICENSE](LICENSE). Bundled fonts (`@fontsource/*`) are under the SIL Open Font License.
