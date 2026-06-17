# Trade Blotter — Interviewer Answer Key (PRIVATE)

> **Do not share with candidates.** Lists every planted bug, location, why it's
> wrong, the fix, and what a strong answer sounds like.

The candidate is given `src/App.tsx`. Clean reference is `App.solution.tsx`.
There are **5 planted bugs**.

---

## The spec the grid is supposed to meet
- Click a column header to **sort**; click the same header again to **reverse**.
- Sorting must **not mutate** the source data and should be stable.
- Text **filter** matches on symbol.
- **Inline edit** of quantity must update the **correct trade** regardless of the
  current sort/filter — i.e. edit by trade `id`, never by row position.
- Footer sums notional (`qty * price`) over the **currently visible** rows.

---

## Bug 1 — Sort mutates the source array in place
**Where:** `visible` useMemo (~line 66)
```ts
rows = rows.sort((a, b) => { ... });   // no copy
```
**Why it's wrong:** `Array.prototype.sort` mutates in place. When there's no active
filter, `trades.filter(() => true)` still returns a **new** array, so this particular
call doesn't corrupt `trades` directly — but the candidate should still flag it as a
latent bug: relying on `filter` always returning a fresh array is fragile, and any
refactor that sorts `trades` directly (or memoizes the filtered list) will start
mutating state. Mutating state derived inside a `useMemo` is a React anti-pattern.

**Fix:** copy before sorting.
```ts
rows = [...rows].sort((a, b) => { ... });
```
**What good looks like:** knows `sort` mutates; copies with spread / `slice()` /
`toSorted()`; can articulate *why* mutating state (even indirectly) breaks React's
assumptions and causes subtle bugs after refactors. Senior signal: mentions
`Array.prototype.sort` is stable in modern engines so no tiebreaker is needed here.

---

## Bug 2 — Inline edit targets the wrong trade (edit by index)
**Where:** `commitEdit(index)` (~lines 89–96) and call sites pass the **row index**
into the visible (filtered/sorted) list, then `setTrades` maps over the **source**
array by that same index.
```ts
function commitEdit(index: number) { ...
  prev.map((t, i) => (i === index ? { ...t, quantity: next } : t))
}
// called as commitEdit(index) where index is the position in `visible`
```
**Why it's wrong:** the index into the *visible* (sorted/filtered) array is not the
index into the *source* array. Repro: filter to `MSFT` (rows 2 and 6), edit the first
one — it writes to source index 0 (AAPL). Or sort by price and edit any row — wrong
trade changes.

**Fix:** edit by id (the solution doesn't pass an index at all):
```ts
function commitEdit() {
  if (editingId == null) return;
  ...
  prev.map((t) => (t.id === editingId ? { ...t, quantity: next } : t));
}
```
**What good looks like:** reproduces by filtering/sorting then editing. Understands
the core grid lesson: **identity must be stable and explicit (id), not positional.**
This is the highest-signal bug for a grid-heavy role.

---

## Bug 3 — Footer total ignores the filter
**Where:** `totalNotional` useMemo (~lines 73–76)
```ts
() => trades.reduce(...)   // sums ALL trades
```
**Why it's wrong:** spec says the total covers the **visible** rows. Repro: filter to
`AAPL` — the count says "2 trades" but the total still reflects all 7. The footer also
literally says "(N shown)" next to a total that isn't of the shown rows.

**Fix:**
```ts
() => visible.reduce((sum, t) => sum + t.quantity * t.price, 0)
```
with `[visible]` as the dependency.
**What good looks like:** notices the count/total mismatch; fixes the source array and
the dependency array together. Bonus: points out the stale-`useMemo`-dependency risk
in general.

---

## Bug 4 — `key={index}` on rows
**Where:** `visible.map((t, index) => <tr key={index}>` (~line 134)
**Why it's wrong:** using the array index as the React key means when the list
reorders (sort) or shrinks (filter), React reconciles by position, not identity. The
inline-edit `<input>` (and its focus/draft state) can attach to the wrong row, and
DOM state gets reused incorrectly. Repro: start editing a row, then sort — the editor
jumps to whatever row now occupies that position.

**Fix:** `key={t.id}`.
**What good looks like:** knows the "don't use index as key" rule *and can explain the
concrete symptom here* (not just recite the rule). Connects it to Bug 2 — both are the
same underlying mistake of using position instead of identity.

---

## Bug 5 — Re-clicking a header can't reverse the sort
**Where:** `toggleSort` (~lines 79–81)
```ts
function toggleSort(key: SortKey) {
  setSort({ key, dir: "asc" });   // always asc
}
```
**Why it's wrong:** spec says clicking the same header again reverses direction.
This always resets to ascending, so descending sort is unreachable. The `▲/▼`
indicator helper exists but `▼` never shows.

**Fix:**
```ts
setSort((prev) =>
  prev?.key === key
    ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
    : { key, dir: "asc" }
);
```
**What good looks like:** uses the functional updater to read previous direction;
resets to `asc` when switching to a different column (a nice detail to call out).

---

## Suggested interview flow (~30–45 min)
1. **2 min** — "Here's a trade blotter. Spec is in the top comment. Sorting, filtering,
   and inline qty editing are all a bit broken. Find the bugs, explain them, fix what
   you can."
2. **Code-review pass first:** strong candidates flag Bug 1 (`sort` mutates), Bug 4
   (`key={index}`), and possibly Bug 2/5 from reading.
3. **Debugging pass:** the high-signal moves are *testing combinations* — filter then
   edit, sort then edit, sort twice. Watch whether they do this unprompted.
4. **Discussion:** "What's the common thread?" → identity vs. position (Bugs 2 & 4).
   "How would you make this robust?" → derive don't mutate, key by id, test sorting +
   editing together.

## Scoring rubric (rough)
| Signal | Junior | Mid | Senior |
|---|---|---|---|
| Bugs found | 1–2 (footer/sort dir obvious) | 3–4 | all 5 |
| Identity vs. index insight | misses it | fixes Bug 2 or 4 | connects 2 & 4 as one idea |
| Edge-case testing | waits | tests some combos | systematic: filter×sort×edit |
| Immutability | unaware | copies on sort | explains why + stable sort |

## Quick repro cheatsheet
- **Bug 1:** sort, then note any state weirdness; mainly a read-the-code finding.
- **Bug 2:** filter to `MSFT`, edit a row → wrong trade's qty changes.
- **Bug 3:** filter to `AAPL` → count says 2 but total still covers all 7.
- **Bug 4:** start editing a row, then click a header to sort → editor jumps rows.
- **Bug 5:** click `Price` twice → stays ascending, never `▼`.
