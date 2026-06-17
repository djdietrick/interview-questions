# Interview Questions

A collection of small, **fully standalone** React apps used as on-site interview
exercises for a mid-level frontend / software developer role at a fintech company
(grids & forms heavy).

Each exercise is an independent, self-contained Vite + TypeScript + React project
with its own `package.json` and config — designed to be uploaded individually to an
online code-interview service. There is **no shared root project**; you run each app
from its own folder.

## How each app is structured

```
apps/<id>/
  package.json          # standalone deps + scripts
  index.html
  vite.config.ts
  tsconfig.json
  tsconfig.node.json
  .gitignore
  README.md             # candidate-facing task description
  src/
    main.tsx
    App.tsx             # the BUGGY code — what the candidate sees and fixes
    styles.css
  _solution/            # ⚠️ interviewer-only — DO NOT UPLOAD
    App.solution.tsx        # clean reference implementation
    ANSWER_KEY.private.md   # planted bugs, fixes, repro steps, rubric
    README.md               # reminder about the upload boundary
```

The candidate sees only `src/`, `index.html`, the config files, and the app's
top-level `README.md`. Everything that reveals the answer lives in `_solution/`.

## Running an app locally

```bash
cd apps/order-entry-form    # or any app
npm install
npm run dev
```

To preview the **fixed** version, copy `_solution/App.solution.tsx` over
`src/App.tsx` (rename its export to `App`).

## Uploading to CodeInterview.io

CodeInterview's React environment is Vite + React 18 with TypeScript types
pre-installed, so these apps drop in as-is (`index.html` → `src/main.tsx` →
`src/App.tsx`). Run the packaging script to generate candidate-ready artifacts:

```bash
./tools/package-for-codeinterview.sh
```

This writes `dist-candidate/<app>/` for every app, each containing:

- **`<app>.zip`** — a clean, candidate-only project archive (no `_solution/`, no
  `node_modules`, no `dist`). Use this for CodeInterview's *import project* flow.
- **`PASTE_MANIFEST.md`** — every candidate file, in order, with its path and full
  contents. Use this to recreate the project file-by-file in CodeInterview's React
  playground (the *paste* path).

The `_solution/` folder (clean reference + answer key) is never included in either
artifact. `dist-candidate/` is git-ignored; regenerate it whenever you edit an app.

> If CodeInterview's React template turns out to be JavaScript-only, tell me and I'll
> add a `.jsx` variant per app — the bugs port over unchanged.

### Manual alternative

If you'd rather not use the script, upload the app folder **without** `_solution/`:

```bash
cp -R apps/order-entry-form /tmp/order-entry-form
rm -rf /tmp/order-entry-form/_solution /tmp/order-entry-form/node_modules /tmp/order-entry-form/dist
# then upload /tmp/order-entry-form
```

## Apps

| App | Focus | Bugs | Status |
|---|---|---|---|
| `order-entry-form` | Forms & validation, derived state, number formatting | 5 | ✅ |
| `trade-blotter` | Grids, sort/filter, inline editing, immutability | 5 | ✅ |

### Planned (from the design discussion)
- **position-pnl** — live price feed, derived aggregates, effect cleanup.
- **instrument-search** — debounce, loading/error states, race conditions.

## Adding a new app

The simplest path is to copy an existing app folder and replace `src/App.tsx`,
`src/styles.css`, `index.html` `<title>`, `package.json` `name`, the README, and the
`_solution/` contents. Then `npm install && npm run build` inside it to verify it's
self-contained.
