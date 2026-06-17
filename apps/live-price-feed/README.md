# Live Price Feed

A streaming quote board — the kind of widget that watches a handful of symbols and
updates their prices in real time.

## The task

The board in `src/App.tsx` is supposed to meet this spec:

- Prices **tick on an interval** (a small random walk). The tick rate follows the
  **Speed** selector, and **Pause/Resume** stops and restarts the feed.
- When a price changes, its row **flashes** green (up) or red (down), then **fades**
  back.
- The header shows the **time of the last update** and a live count of **advancers /
  decliners** (symbols above / below their opening price).
- **Chg %** is the move since the opening price.

There are **several bugs**. Find them, explain what's wrong, and fix what you can.
Try pausing, changing the speed, and watching a row over time — that's where things
break.

## Focus areas

Hooks & effects · `setInterval` cleanup · stale closures · derived vs. stored state

## Running

```bash
npm install
npm run dev
```

Then open the dev server URL it prints.
