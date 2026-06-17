# Live Price Feed — Interviewer Answer Key (PRIVATE)

> **Do not share with candidates.** This file is excluded from what the candidate
> sees. It lists every planted bug, where it is, why it's wrong, the fix, and what
> a strong answer sounds like.

The candidate is given `src/App.tsx`. The clean reference is `App.solution.tsx`.
There are **5 planted bugs**. They cluster around `useEffect` — its lifecycle,
its dependencies, and what belongs in state vs. what should be derived. This is a
**hooks / effects** exercise, the natural step up from the form and grid apps.

---

## The spec the board is supposed to meet
- Prices tick on an interval (small random walk). Tick rate follows the **speed**
  selector; **Pause/Resume** stops and restarts the feed.
- A price move **flashes** the row green (up) / red (down), then it **fades back**.
- Header shows the **time of the last update** and a live **advancers / decliners**
  count (symbols above / below their opening price).
- "Chg %" is the move since the opening price.

> Note on React StrictMode: `src/main.tsx` renders under `<React.StrictMode>`, so
> in dev every effect mounts, unmounts, and re-mounts once. That's intentional —
> it makes the missing-cleanup bug (Bug 2) twice as obvious and is worth a
> conversation if the candidate notices the feed running at double speed.

---

## Bug 1 — State is mutated in place; board never updates
**Where:** the price-feed effect's interval callback.
```ts
setInterval(() => {
  quotes.forEach((q) => {
    q.prevPrice = q.price;   // mutates the existing Quote objects
    q.price = nextPrice(q.price);
  });
  setQuotes(quotes);         // same array reference → React bails out
}, SPEED_MS[speed]);
```
**Why it's wrong:** `quotes.forEach` mutates the objects *inside* the existing
array; `setQuotes(quotes)` then hands React the same array reference it already
holds. `Object.is(prev, next)` is `true`, so React sees no change and skips
re-rendering. The board appears completely frozen from the moment it loads.

The mutation also corrupts the data silently: `prevPrice` is written to the same
object that the rest of the render is still reading, so the flash-direction logic
(`q.price > q.prevPrice`) will always see `false` even once the bug is fixed — you
have to fix immutability *and* the flash effect to see the board work correctly.

**Fix:** produce a new array of new objects, and use the functional updater so each
tick builds on the latest state rather than a stale closure value:
```ts
setQuotes((prev) =>
  prev.map((q) => ({ ...q, prevPrice: q.price, price: nextPrice(q.price) }))
);
```
**What good looks like:** immediately identifies the mutation as the problem
(checking whether `setQuotes` receives a new reference is the first thing to reach
for); knows that `Object.is` is how React decides whether to re-render; understands
why a new-array + spread is the idiomatic fix. Stronger answer also catches the
stale closure risk — if you spread but don't use the functional updater, the
interval closes over the initial `quotes` and prices stop trending after a
pause/speed change — and explains that the updater addresses both problems at once.

**Repro:** load the page → prices never move.

---

## Bug 2 — `setInterval` is never cleared (no effect cleanup)
**Where:** same effect — there is no `return () => clearInterval(id)`.
**Why it's wrong:** the effect returns nothing, so the interval is never torn down.
Two visible consequences:
1. **Pause doesn't stop the feed.** Toggling `paused` re-runs the effect, but the
   already-running interval from before is never cleared, so prices keep ticking.
2. **Changing speed stacks intervals.** Each speed change starts another interval on
   top of the old one; the feed gets faster and more erratic, and leaks timers.
   (StrictMode already starts two at mount — see the note above.)

**Fix:**
```ts
const id = setInterval(() => { ... }, SPEED_MS[speed]);
return () => clearInterval(id);
```
**What good looks like:** knows that any subscription/timer set up in an effect must
be cleaned up in the returned function; predicts the pause + speed symptoms before
running; connects it to StrictMode's double-invoke. This is the headline bug of the
exercise — every candidate should get it.

**Repro:** click **Pause** → prices keep updating. Or switch Speed a few times →
updates visibly pile up.

---

## Bug 3 — The flash is set but never cleared
**Where:** the flash effect.
```ts
useEffect(() => {
  const dir: Record<string, "up" | "down"> = {};
  for (const q of quotes) {
    if (q.price > q.prevPrice) dir[q.symbol] = "up";
    else if (q.price < q.prevPrice) dir[q.symbol] = "down";
  }
  setFlash(dir);          // set, but nothing ever resets it
}, [quotes]);
```
**Why it's wrong:** spec says a row flashes **then fades**. Here `flash` is written on
every tick and never cleared, so rows stay tinted permanently (they just flip between
green/red). The fade relies on the class being removed, which never happens.

**Fix:** clear it on a short timer, cancelling a pending clear if a new tick arrives:
```ts
if (Object.keys(dir).length === 0) return;
setFlash(dir);
const t = setTimeout(() => setFlash({}), 400);
return () => clearTimeout(t);
```
**What good looks like:** spots that the flash has a set but no reset; uses a
`setTimeout` and returns a cleanup to cancel it (same cleanup discipline as Bug 2).
Notes the early-return so an idle/paused board settles to no flash. Bonus: mentions
this could instead be a pure CSS animation keyed off the price, removing the timer.

**Repro:** watch the board — rows light up and stay lit; nothing ever fades.

---

## Bug 4 — Advancers / decliners stored in state and computed once
**Where:**
```ts
const [advancers, setAdvancers] = useState(0);
const [decliners, setDecliners] = useState(0);
useEffect(() => {
  setAdvancers(quotes.filter((q) => q.price >= q.openPrice).length);
  setDecliners(quotes.filter((q) => q.price < q.openPrice).length);
}, []);   // runs once → frozen at the mount-time values
```
**Why it's wrong:** these counts are **derived data**. Mirroring them into state and
computing them in a `[]`-deps effect freezes them at their initial values (6 / 0),
so the header never matches what the prices are actually doing.

**Fix:** derive during render; delete the state and the effect.
```ts
const advancers = quotes.filter((q) => q.price >= q.openPrice).length;
const decliners = quotes.length - advancers;
```
**What good looks like:** "derive, don't duplicate" — recognizes this is the same
class of mistake as storing validation/derived totals in state. Stronger answer
notes that even fixing the deps to `[quotes]` would work but is still worse than
deriving (an extra render and a chance to drift). Same lesson as the order-form's
errors-in-state bug, in a new costume.

**Repro:** prices clearly move (after Bug 1/2 are fixed) but the ▲/▼ counts in the
header never change.

---

## Bug 5 — "Last updated" reads `new Date()` during render
**Where:** the header status line.
```tsx
{paused ? "Paused" : "Live"} · updated {new Date().toLocaleTimeString()}
```
**Why it's wrong:** the timestamp is read at **render time**, not when the data
actually ticked. It changes on *any* re-render (pausing, a flash clearing, etc.) and,
conversely, doesn't represent the feed's last update. While **Paused** it still jumps
whenever something unrelated causes a render — it's not measuring what it claims to.

**Fix:** record the time from the tick and render that.
```ts
const [lastUpdated, setLastUpdated] = useState<number | null>(null);
// inside the interval callback:
setLastUpdated(Date.now());
// render:
{lastUpdated !== null && <> · updated {new Date(lastUpdated).toLocaleTimeString()}</>}
```
**What good looks like:** understands "render is not a clock" — values shown to the
user should come from a real event, not from calling `Date.now()` mid-render (which
also makes render impure). Spots that the displayed time and the actual data updates
are decoupled. Subtlest of the five; reward candidates who reason about *when* the
expression evaluates rather than just reading it as correct.

**Repro:** **Pause**, then interact (toggle speed, hover) → the "updated" time changes
even though no price did.

---

## Suggested interview flow (~30–45 min)
1. **2 min** — orient: "This is a live quote board. The spec is in the comment at the
   top. Some things are broken — find them, say what's wrong, and fix what you can."
2. **Code-review pass (talk first):** ask them to read and call out smells before
   running. High-signal candidates flag Bug 1 (mutation + same reference) and Bug 2
   (no `clearInterval`) from reading alone.
3. **Debugging pass (run it):** Bug 1 (board frozen) is obvious immediately; Bug 2
   (pause does nothing) and Bug 3 (rows never fade) show on interaction; Bug 4
   (frozen counts) shows once prices move; Bug 5 (timestamp) rewards careful watching.
4. **Discussion:** "What's the common thread?" Looking for: effects own a lifecycle
   (set up *and* tear down), functional updates for state that builds on itself,
   derive don't duplicate, and keep render pure.

## Scoring rubric (rough)
| Signal | Junior | Mid | Senior |
|---|---|---|---|
| Bugs found | 1–2, by running | 3–4, some by reading | all 5, mostly by reading |
| Cleanup discipline | misses it | clears the interval | clears interval *and* the flash timer, cites StrictMode |
| State vs. derived | stores everything | derives the counts | articulates derive-don't-duplicate as a rule |
| Closures/effects | unsure why pause fails | fixes with functional update | explains deps vs. updater trade-off, render purity |
| Communication | quiet, patches | explains as they go | teaches; ties the five back to one theme |

## Quick repro cheatsheet
- **Bug 1:** load the page → prices never move.
- **Bug 2:** click **Pause** → feed keeps ticking; switching Speed piles updates up.
- **Bug 3:** rows light up and never fade.
- **Bug 4:** prices move but the header ▲/▼ counts stay 6 / 0.
- **Bug 5:** while Paused, the "updated" time still changes when you interact.
