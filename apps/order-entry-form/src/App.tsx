import { useState } from "react";

/**
 * Order Entry Form.
 *
 * A buy/sell order ticket. Rules:
 *  - Symbol is required.
 *  - Quantity must be a positive integer.
 *  - For LIMIT orders a positive limit price is required. MARKET orders ignore it.
 *  - Estimated cost = quantity * price, where price is the limit price for LIMIT
 *    orders and the last traded price for MARKET orders.
 *  - Submit is disabled until the form is valid. Submitting shows a confirmation.
 */

type Side = "buy" | "sell";
type OrderType = "market" | "limit";

// In a real app this would come from a quote feed. Fixed here for determinism.
const LAST_PRICE = 184.32;

interface FormState {
  symbol: string;
  quantity: string;
  orderType: OrderType;
  limitPrice: string;
}

interface Errors {
  symbol?: string;
  quantity?: string;
  limitPrice?: string;
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function validate(form: FormState): Errors {
  const errors: Errors = {};

  if (!form.symbol.trim()) {
    errors.symbol = "Symbol is required.";
  }

  const qty = Number(form.quantity);
  if (!form.quantity.trim()) {
    errors.quantity = "Quantity is required.";
  } else if (!Number.isInteger(qty) || qty <= 0) {
    errors.quantity = "Quantity must be a positive whole number.";
  }

  if (form.orderType === "limit") {
    const price = Number(form.limitPrice);
    if (price < 0) {
      errors.limitPrice = "Limit price must be greater than zero.";
    }
  }

  return errors;
}

export default function App() {
  const [side, setSide] = useState<Side>("buy");
  const [form, setForm] = useState<FormState>({
    symbol: "",
    quantity: "",
    orderType: "market",
    limitPrice: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const isValid = Object.keys(errors).length === 0;

  const effectivePrice =
    form.limitPrice !== "" ? Number(form.limitPrice) : LAST_PRICE;
  const qty = parseInt(form.quantity, 10);
  const estimatedCost = qty > 0 ? qty * parseInt(String(effectivePrice), 10) : 0;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors(validate(form));
    setConfirmation(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setConfirmation(
      `${side.toUpperCase()} ${qty} ${form.symbol.toUpperCase()} @ ` +
        `${form.orderType === "limit" ? currency.format(effectivePrice) : "MKT"} ` +
        `· est. ${currency.format(estimatedCost)}`
    );
  }

  return (
    <form className="ticket" onSubmit={handleSubmit}>
      <div className="side-toggle">
        <button
          type="button"
          className={`buy ${side === "buy" ? "active" : ""}`}
          onClick={() => setSide("buy")}
        >
          Buy
        </button>
        <button
          type="button"
          className={`sell ${side === "sell" ? "active" : ""}`}
          onClick={() => setSide("sell")}
        >
          Sell
        </button>
      </div>

      <div className="field">
        <label htmlFor="symbol">Symbol</label>
        <input
          id="symbol"
          value={form.symbol}
          onChange={(e) => update("symbol", e.target.value.toUpperCase())}
          placeholder="AAPL"
        />
        {errors.symbol && <div className="error-text">{errors.symbol}</div>}
      </div>

      <div className="field">
        <label htmlFor="quantity">Quantity</label>
        <input
          id="quantity"
          inputMode="numeric"
          value={form.quantity}
          onChange={(e) => update("quantity", e.target.value)}
          placeholder="100"
        />
        {errors.quantity && (
          <div className="error-text">{errors.quantity}</div>
        )}
      </div>

      <div className="field">
        <label htmlFor="orderType">Order Type</label>
        <select
          id="orderType"
          value={form.orderType}
          onChange={(e) => update("orderType", e.target.value as OrderType)}
        >
          <option value="market">Market</option>
          <option value="limit">Limit</option>
        </select>
      </div>

      {form.orderType === "limit" && (
        <div className="field">
          <label htmlFor="limitPrice">Limit Price</label>
          <input
            id="limitPrice"
            inputMode="decimal"
            value={form.limitPrice}
            onChange={(e) => update("limitPrice", e.target.value)}
            placeholder={LAST_PRICE.toFixed(2)}
          />
          {errors.limitPrice && (
            <div className="error-text">{errors.limitPrice}</div>
          )}
        </div>
      )}

      <div className="summary">
        <span>
          Estimated {side === "buy" ? "cost" : "proceeds"}
          {form.orderType === "market" && (
            <span style={{ color: "var(--muted)" }}>
              {" "}
              @ {currency.format(LAST_PRICE)}
            </span>
          )}
        </span>
        <span className="cost">{currency.format(estimatedCost)}</span>
      </div>

      <button type="submit" className="submit-btn" disabled={!isValid}>
        Submit {side === "buy" ? "Buy" : "Sell"} Order
      </button>

      {confirmation && <div className="confirmation">✓ {confirmation}</div>}
    </form>
  );
}
