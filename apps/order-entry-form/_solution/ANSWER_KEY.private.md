# Order Entry Form — Interviewer Answer Key (PRIVATE)

> **Do not share with candidates.** This file is excluded from what the candidate
> sees. It lists every planted bug, where it is, why it's wrong, the fix, and what
> a strong answer sounds like.

The candidate is given `src/App.tsx`. The clean reference is `App.solution.tsx`.
There are **5 planted bugs** (one has a knock-on effect worth crediting separately).

---

## The spec the form is supposed to meet
- Symbol required.
- Quantity must be a **positive integer**.
- **Limit** orders require a **positive** limit price; **Market** orders ignore it.
- Estimated cost = `quantity × price`, where price is the limit price for limit
  orders and `LAST_PRICE` for market orders. Must keep cents.
- Submit disabled until valid; submit shows a confirmation.

---

## Bug 1 — Validation stored in state and computed from a stale value
**Where:** `src/App.tsx`
- `const [errors, setErrors] = useState<Errors>({});` (~line 71)
- inside `update(...)`: `setErrors(validate(form));` (~line 83)

**Why it's wrong (two compounding problems):**
1. `validate(form)` uses the **current** `form` from the closure, which is the value
   *before* this keystroke's `setForm` is applied. So errors are always one keystroke
   behind (classic stale-state / "state updates are async" bug).
2. Because `errors` starts as `{}`, `isValid` is `true` on first render, so an
   **empty form can be submitted** before the user has touched anything.

**Fix (what the solution does):** derive errors during render instead of storing them.
```ts
const errors = useMemo(() => validate(form), [form]);
const isValid = Object.keys(errors).length === 0;
```
Remove the `errors` state and the `setErrors` call entirely.

**What good looks like:** candidate recognizes that validation is *derived data* and
shouldn't live in state; explains the stale-closure timing; notices the empty-form
submit as the user-visible symptom. Bonus: mentions that `useMemo` here is optional
(could just call `validate(form)` inline) — it's about not duplicating state, not perf.

---

## Bug 2 — `parseInt` on the price drops the cents
**Where:** `~line 79`
```ts
const estimatedCost = qty > 0 ? qty * parseInt(String(effectivePrice), 10) : 0;
```
**Why it's wrong:** `parseInt("184.32")` → `184`. Every estimate is rounded down to
whole dollars. For a 100-share order that's $32 off — unacceptable on a trading ticket.

**Fix:**
```ts
const estimatedCost = qty > 0 && effectivePrice > 0 ? qty * effectivePrice : 0;
```
**What good looks like:** spots that `parseInt` truncates to integer; knows
`Number(...)` / `parseFloat(...)` preserve decimals; ideally comments that money math
should round at *display* time via `Intl.NumberFormat` (already used), not by mangling
the underlying number. Senior signal: mentions float precision and that real money
math often uses integer cents or a decimal library.

---

## Bug 3 — Limit price validation accepts zero / missing price
**Where:** `validate()`, `~lines 53–58`
```ts
if (form.orderType === "limit") {
  const price = Number(form.limitPrice);
  if (price < 0) { errors.limitPrice = "..."; }   // only catches negatives
}
```
**Why it's wrong:** spec says limit orders need a **positive** price.
- Empty string → `Number("")` is `0`, which is not `< 0`, so **no error** → you can
  submit a limit order with no price.
- `0` is accepted as a valid price.

**Fix (solution):**
```ts
if (form.orderType === "limit") {
  const price = Number(form.limitPrice);
  if (!form.limitPrice.trim()) errors.limitPrice = "Limit price is required for limit orders.";
  else if (!(price > 0)) errors.limitPrice = "Limit price must be greater than zero.";
}
```
**What good looks like:** tests the actual case (switch to Limit, leave price blank,
notice Submit is enabled). Understands `Number("")===0` gotcha. Uses `!(price > 0)`
or `price <= 0` and also handles `NaN` (e.g. `"abc"`). Bonus: required-ness should
only apply to limit orders, which the fix preserves.

---

## Bug 4 — Stale limit price leaks into Market-order cost
**Where:** `~lines 76–77`
```ts
const effectivePrice =
  form.limitPrice !== "" ? Number(form.limitPrice) : LAST_PRICE;
```
**Why it's wrong:** effective price keys off "is limitPrice non-empty" instead of
"is this a limit order." Repro: choose Limit, type a price (say 200), switch back to
Market. The limit-price field hides but `form.limitPrice` still holds `"200"`, so the
market estimate uses 200 instead of `LAST_PRICE`.

**Fix:**
```ts
const effectivePrice =
  form.orderType === "limit" ? Number(form.limitPrice) : LAST_PRICE;
```
**What good looks like:** reproduces the cross-field contamination; fixes the
condition to branch on `orderType`. Stronger answer also notes you *could* clear
`limitPrice` when switching to market, and discusses the tradeoff (keep it for UX so
the user doesn't lose their input vs. clear it to avoid confusion) — the chosen fix
keeps the value but ignores it, which is the better UX.

---

## Bug 5 — Errors don't update on the field the user just changed
**Where:** consequence of Bug 1's `setErrors(validate(form))` using stale `form`.
Even after you "fix" by recomputing, doing it imperatively in `update()` means errors
for one field can lag, and side/orderType changes via other handlers (`setSide`,
the select) won't re-validate at all in some refactors.

> Note: if the candidate fixes Bug 1 by switching to derived `errors = validate(form)`
> during render, Bug 5 disappears for free. Credit them for recognizing that the
> imperative approach is the root cause rather than patching each call site. If they
> instead try to sprinkle `setErrors` calls everywhere, point out how brittle that is
> and that deriving solves the whole class.

---

## Suggested interview flow (~30–45 min)
1. **2 min** — orient them: "Here's an order ticket. The spec is in the comment at the
   top. Some things are broken — find them, tell me what's wrong, and fix what you can."
2. **Code-review pass (talk first):** ask them to read and call out smells *before*
   running it. High-signal candidates flag Bug 1 (errors in state) and Bug 2
   (`parseInt`) from reading alone.
3. **Debugging pass (run it):** let them interact. The empty-form-submits and the
   wrong-dollar-estimate are obvious on interaction; the market/limit price leak and
   the missing-price-on-limit require deliberate testing — watch whether they test
   edge cases unprompted.
4. **Discussion:** "How would you prevent this class of bug?" Looking for: derive don't
   duplicate state, validate in one place, money/number formatting discipline, writing
   a test.

## Scoring rubric (rough)
| Signal | Junior | Mid | Senior |
|---|---|---|---|
| Bugs found | 1–2, mostly by running | 3–4, some by reading | all 5, mostly by reading |
| Root cause vs. patch | patches symptoms | fixes most properly | identifies derived-state root cause |
| Edge-case testing | waits to be told | tests some unprompted | systematically probes inputs |
| Communication | quiet, fixes silently | explains as they go | teaches; discusses prevention |

## Quick repro cheatsheet
- **Bug 1:** load page → Submit is clickable with everything empty.
- **Bug 2:** qty 100, market → estimate shows $18,400.00 (should be $18,432.00).
- **Bug 3:** Order Type = Limit, leave price blank → Submit enabled.
- **Bug 4:** Limit, price 200, switch to Market → estimate uses 200, not 184.32.
- **Bug 5:** type in a field → the error message reflects the *previous* keystroke.
