# SCMP Copy Sandbox

Live, editable, pixel-faithful replicas of SCMP subscriber surfaces so the B2C
team can trial **new prices and copy** for an offer without a Figma seat — and
export a clean screenshot straight into an approval deck.

Built from the Figma source `Copy-test-prototype-source`
(file `phRi68xyO6QtunSOsv0QTs`).

## What it does

- **Edit any text in the browser** — click a headline, price, tag, CTA or fine
  print and type. No login, no Figma.
- **Live character counts** — a badge shows the length of the focused field and
  turns red when it exceeds its budget.
- **Fit warnings** — with the toggle on, any copy that no longer fits its box
  gets a red outline, and the toolbar shows how many fields are over.
- **True responsive reflow** — device presets (Mobile 375 · Tablet 768 ·
  Desktop 1280 · Fit) plus a drag handle on the right edge. The layout uses the
  real breakpoints, so copy flows exactly as it will in production.
- **Download PNG** — a 2× (retina-crisp) screenshot of the current width,
  named `scmp-<surface>-<width>px.png`, ready to drop in a deck.
- **Autosave + Reset** — edits persist in the browser; *Reset copy* restores the
  shipped defaults.

## Surfaces

| Surface | File | Status |
|---|---|---|
| Subscription page | `subscription.html` | ✅ Live |
| Paywall | _tbd_ | ⏳ Add the Figma frame |

## Run it locally

No build step, no dependencies.

```bash
node copy-sandbox/server.js
```

Then open <http://localhost:4599>. (Any static server works — e.g.
`npx serve copy-sandbox`.)

## Host it for the team (GitHub Pages)

The folder is fully static, so you can publish it as-is:

1. Push this repo to GitHub.
2. Settings → Pages → deploy from branch, pointing at `/copy-sandbox`
   (or move these files to the repo root / `/docs`).
3. Share the URL. The team just opens it, edits, and downloads PNGs.

> The PNG export must run from a **hosted or served** page (http/https), not a
> `file://` double-click — browsers block downloads and image reads from
> `file://`. Locally, use the `node server.js` command above.

## Project structure

```
copy-sandbox/
├── index.html          Landing hub linking to each surface
├── subscription.html   Subscription page (mock + copy fields)
├── css/sandbox-ui.css  Toolbar / stage / counter / warning chrome
├── js/sandbox.js       The editor engine (surface-agnostic)
├── assets/marks.css    Payment + tick marks, inlined as data-URIs
├── vendor/html2canvas.min.js
└── server.js           Zero-dependency static server
```

## Adding a new surface (e.g. the paywall)

Every surface is a plain HTML page that reuses the same engine. You need:

1. `<body data-surface="paywall">`
2. One `[data-canvas]` element (the thing that gets screenshotted), wrapped in
   `[data-canvas-wrap]` inside `[data-stage]`.
3. The toolbar markup (copy it from `subscription.html`) with its `data-*` hooks.
4. Your mock markup, with `class="editable"` on every editable text node.
   Optional per-field attributes:
   - `data-label="…"` — name shown in the counter.
   - `data-maxlen="60"` — soft character budget (counter + red past it).
   - `data-maxlines="1"` — flag if it wraps beyond N lines.
   - `data-single` — Enter commits instead of inserting a line break.
5. Include `vendor/html2canvas.min.js` then `js/sandbox.js`.

Responsiveness uses **container queries** on `.scmp` (the canvas), so the
preview reflows to *its own width*, independent of the browser window.
