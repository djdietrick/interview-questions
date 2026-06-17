# Trade Blotter

A grid of trades — the kind of blotter a desk uses to review the day's orders.

## The task

The grid in `src/App.tsx` is supposed to meet this spec:

- Click a column header to **sort**; click the same header again to **reverse**.
- Sorting must not change the underlying data and should be stable.
- The text box **filters** rows by symbol.
- You can **edit a row's quantity inline** (click the quantity, type, Enter/blur to
  commit). The edit must update the **correct trade** no matter how the grid is
  currently sorted or filtered.
- The footer shows the **total notional** (quantity × price) of the rows currently
  shown.

There are **several bugs**. Find them, explain what's wrong, and fix what you can.
Try combining sort, filter, and editing — that's where things break.

## Focus areas

Grids & tables · sorting/filtering · inline editing · derived aggregates · immutability

## Running

```bash
npm install
npm run dev
```

Then open the dev server URL it prints.
