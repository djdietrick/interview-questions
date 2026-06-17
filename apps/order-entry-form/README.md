# Order Entry Form

A buy/sell order ticket — the kind of form a trader uses to place an order.

## The task

The form in `src/App.tsx` is supposed to meet this spec:

- **Symbol** is required.
- **Quantity** must be a positive whole number.
- For a **Limit** order, a positive **limit price** is required.
  A **Market** order ignores the limit price.
- The **estimated cost** = quantity × price, where the price is the limit price
  for limit orders and the last traded price (`LAST_PRICE`) for market orders.
- **Submit** is disabled until the form is valid. Submitting shows a confirmation.

There are **several bugs**. Find them, explain what's wrong, and fix what you can.

## Focus areas

Forms & validation · derived state · number/currency formatting

## Running

```bash
npm install
npm run dev
```

Then open the dev server URL it prints.
