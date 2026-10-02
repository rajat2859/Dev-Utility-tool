# Utility Tool Manager

A workspace of developer and web-QA utilities. It is a React/Vite front end served by an Express server, and it can also run as a Windows desktop app (Electron shell).

## Tools

| Tool | What it does |
| --- | --- |
| SEO & Schema | Checks a page's meta title and description lengths, Google SERP snippet preview, Open Graph tags and Schema.org structured data. |
| Content Audit | Compares a live web page against a reference copy. See [Content Auditor](#content-auditor). |
| Responsive Preview | Shows a site at mobile, tablet, laptop, desktop and custom viewport sizes side by side, with horizontal overflow inspection. |
| Schema Generator | Generates Schema.org JSON-LD. Currently FAQPage, built from your own questions and answers. |
| HTML Cleaner & Sanitizer | Strips inline styles, tracking scripts, Word bloat and broken tags; also converts to Markdown. |
| Bulk Image Converter | Batch-converts local images to WebP, AVIF, PNG, JPEG or SVG tracings. AVIF falls back to WebP when the browser cannot encode it. |
| Gradient Studio | Builds CSS linear, radial and conic gradients and palettes, with copyable Tailwind classes. |
| Cryptographic Key Generator | Generates random passwords and passphrases. |

The tool list lives in `src/components/DashboardGrid.tsx`; routing between tools is in `src/App.tsx`.

## Requirements

- Node.js 22 (the release workflow uses 22).
- Microsoft Edge or Google Chrome installed, for the features that drive a headless browser (see [Content Auditor](#content-auditor)) and for `npm run desktop`.

## Run it

```bash
npm install
npm run dev        # dev server (Express + Vite middleware) on http://127.0.0.1:2000
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start `server.ts` with `tsx watch`. Listens on `PORT`, default 2000. |
| `npm run desktop` | Start the dev server if none is running and open the app in a standalone Edge/Chrome window (`scripts/launch-desktop-window.mjs`). Fails if neither browser is found. |
| `npm run build` | Build the front end into `dist/` and bundle the server into `dist/server.cjs`. |
| `npm start` | Run the built server (`node dist/server.cjs`). Run `npm run build` first. |
| `npm run lint` | Type-check with `tsc --noEmit`. |
| `npm test` | Run the unit tests (`src/lib/utils.test.ts`, the Content Auditor tests and the SSRF-protection tests in `server/content-auditor/__tests__/pageSecurity.test.ts`) with `tsx --test`. |

## Configuration

Copy `.env.example` to `.env`. All variables are optional.

| Variable | Meaning |
| --- | --- |
| `GOOGLE_API_KEY` | Used by the Content Auditor to read Google Docs through the Google Docs API. Without it, the auditor falls back to Google's public export, which only works for docs shared as "Anyone with the link can view". |
| `PORT` | Server port. Defaults to 2000. |
| `HOST` | Bind address. Defaults to 127.0.0.1 (local only); set `0.0.0.0` to expose the server on your network or in a container. |

## Content Auditor

The Content Audit tool (`server/content-auditor/`, mounted at `/api/content-checker`) checks that a published page matches its approved copy.

- Page side: fetches the page over HTTP, and falls back to rendering it in a headless browser when the HTML looks like an empty client-rendered (SPA) shell. The browser fallback uses `playwright-core` with an installed Edge or Chrome (`server/content-auditor/webpage/PageRenderer.ts` looks in the standard Windows paths and `/usr/bin/google-chrome`, `chromium-browser`, `chromium`). No browser is downloaded; if none is found, the fallback reports an error.
- Reference side: a public Google Doc (see `GOOGLE_API_KEY` above), an Awesome Screenshot share link or screenshot image (read with OCR), or pasted reference text.
- Comparison: deterministic matchers (`comparison/`) for title and meta, headings, paragraphs, lists, tables, images and FAQs. The checks can be switched on and off per run.
- OCR uses `tesseract.js` with the English model `eng.traineddata`, which is committed at the repo root and loaded from the working directory. Do not remove it; the desktop build also bundles it.

## Desktop app (Windows)

The `electron/` folder is a separate package (own `package.json` and lockfile) that wraps the built web app and server in an Electron window with auto-update through GitHub Releases.

```bash
npm install                    # repo root first: the desktop build uses its Vite and esbuild
cd electron
npm install
npm start                      # builds the web app and server bundle (prepare-content), then launches Electron
npm run pack                   # unpacked build in electron/release/
npm run dist                   # NSIS installer for Windows x64
```

On first launch the app copies `.env.example` to a `.env` in its user-data folder; put `GOOGLE_API_KEY` there.

### Releasing

`.github/workflows/release-desktop.yml` runs on any pushed tag matching `v*`. It fails unless the tag equals `v` plus the `version` in `electron/package.json` (for example `v0.1.3`), then builds the installer on `windows-latest` and publishes it to GitHub Releases. Bump the version in `electron/package.json` before tagging.

## Continuous integration

`.github/workflows/ci.yml` runs `npm ci`, `npm run lint`, `npm test` and `npm run build` on Node 22 for every pull request and every push to `main`.

## Project layout

```
src/                      React app (App.tsx, components/, components/tools/, lib/)
server.ts                 Express server: SEO checker, responsive preview proxy, health check, static/Vite serving
server/content-auditor/   Content Auditor backend (webpage, reference, google, comparison, report, routes, tests)
electron/                 Windows desktop shell and installer config
scripts/                  launch-desktop-window.mjs
public/                   Static files (favicons, fonts, robots.txt, sitemap)
eng.traineddata           Tesseract English model used for OCR
graphify-out/             Generated code knowledge graph (may be stale)
```

## Contributing

Commits follow Conventional Commits, as set out in `.agents/rules/git.md`:

```
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `refactor`, `style`, `docs`, `chore`, `perf`, `test`, `build`. Keep commits small and focused, and never commit `.env` files or secrets.
