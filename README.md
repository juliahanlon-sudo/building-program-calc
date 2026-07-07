# Salesforce Space Planning Calculator

A React + Vite web app for building program / space planning. Runs entirely in
the browser with no backend — saved scenarios are stored in the browser's
localStorage.

## Running locally

Requires Node.js 18+ (tested on Node 24).

```bash
npm install      # install dependencies (first time only)
npm run dev      # start the dev server → http://localhost:5173
```

Then open **http://localhost:5173** in your browser.

## Other commands

```bash
npm run build             # production build → dist/
npm run preview           # serve the production build locally
npm run build:singlefile  # single self-contained HTML file (see below)
```

## Standalone HTML file (no server needed)

```bash
npm run build:singlefile
```

This produces **`dist-singlefile/Space-Planning-Calculator.html`** — the entire
app (JS inlined) in one file. Share it or double-click it to open directly in a
browser; no Node, no server, no install required. Saved scenarios still work via
the browser's localStorage.

## Project structure

```
index.html            App entry HTML
vite.config.js        Vite + React config
src/
  main.jsx            React entry
  App.jsx             Main calculator UI (the bulk of the app)
  ScenarioManager.jsx Save / load / delete scenarios
  scenarioStore.js    localStorage-backed scenario persistence
```

## Notes

- **No login or backend.** Firebase (auth, Firestore, admin panel, invite links,
  scenario sharing) was removed. The app opens straight to the calculator.
- **Scenarios are local to this browser.** Saved scenarios live in
  `localStorage`, so they persist across reloads but do not sync between
  machines or browsers, and clearing site data will remove them.
