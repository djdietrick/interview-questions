import { useMemo, useState } from "react";

/**
 * Trade Blotter.
 *
 * A grid of trades with:
 *  - Click a column header to sort; click again to reverse. Sorting must not
 *    mutate the source data and must be stable.
 *  - A text filter that matches on symbol.
 *  - Inline editing of a row's quantity. The edit must land on the correct trade
 *    regardless of current sort/filter (edit by trade id, never by row index).
 *  - A footer that sums notional (qty * price) over the *currently visible* rows.
 */

interface Trade {
  id: number;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  status: "filled" | "working" | "cancelled";
}

const INITIAL_TRADES: Trade[] = [
  { id: 1, symbol: "AAPL", side: "buy", quantity: 100, price: 184.32, status: "filled" },
  { id: 2, symbol: "MSFT", side: "sell", quantity: 50, price: 412.19, status: "working" },
  { id: 3, symbol: "AAPL", side: "sell", quantity: 75, price: 185.01, status: "filled" },
  { id: 4, symbol: "TSLA", side: "buy", quantity: 200, price: 178.46, status: "cancelled" },
  { id: 5, symbol: "NVDA", side: "buy", quantity: 30, price: 121.88, status: "working" },
  { id: 6, symbol: "MSFT", side: "buy", quantity: 120, price: 410.05, status: "filled" },
  { id: 7, symbol: "GOOG", side: "sell", quantity: 60, price: 176.22, status: "filled" },
];

type SortKey = "symbol" | "side" | "quantity" | "price" | "status";
type SortDir = "asc" | "desc";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function compare(a: Trade, b: Trade, key: SortKey): number {
  const av = a[key];
  const bv = b[key];
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  return String(av).localeCompare(String(bv));
}

export default function App() {
  const [trades, setTrades] = useState<Trade[]>(INITIAL_TRADES);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftQty, setDraftQty] = useState("");

  const visible = useMemo(() => {
    const needle = filter.trim().toUpperCase();
    let rows = trades.filter((t) =>
      needle ? t.symbol.toUpperCase().includes(needle) : true
    );

    if (sort) {
      rows = rows.sort((a, b) => {
        const c = compare(a, b, sort.key);
        return sort.dir === "asc" ? c : -c;
      });
    }

    return rows;
  }, [trades, filter, sort]);

  const totalNotional = useMemo(
    () => trades.reduce((sum, t) => sum + t.quantity * t.price, 0),
    [trades]
  );

  function toggleSort(key: SortKey) {
    setSort({ key, dir: "asc" });
  }

  function startEdit(t: Trade) {
    setEditingId(t.id);
    setDraftQty(String(t.quantity));
  }

  function commitEdit(index: number) {
    const next = Number(draftQty);
    if (Number.isInteger(next) && next > 0) {
      setTrades((prev) =>
        prev.map((t, i) => (i === index ? { ...t, quantity: next } : t))
      );
    }
    setEditingId(null);
    setDraftQty("");
  }

  function sortIndicator(key: SortKey) {
    if (sort?.key !== key) return "";
    return sort.dir === "asc" ? " ▲" : " ▼";
  }

  return (
    <div className="blotter">
      <div className="blotter-controls">
        <input
          className="blotter-filter"
          placeholder="Filter by symbol…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="blotter-count">{visible.length} trades</span>
      </div>

      <table className="grid">
        <thead>
          <tr>
            <th onClick={() => toggleSort("symbol")}>Symbol{sortIndicator("symbol")}</th>
            <th onClick={() => toggleSort("side")}>Side{sortIndicator("side")}</th>
            <th className="num" onClick={() => toggleSort("quantity")}>
              Qty{sortIndicator("quantity")}
            </th>
            <th className="num" onClick={() => toggleSort("price")}>
              Price{sortIndicator("price")}
            </th>
            <th className="num">Notional</th>
            <th onClick={() => toggleSort("status")}>Status{sortIndicator("status")}</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((t, index) => (
            <tr key={index}>
              <td>{t.symbol}</td>
              <td className={t.side}>{t.side}</td>
              <td className="num">
                {editingId === t.id ? (
                  <input
                    className="qty-edit"
                    autoFocus
                    inputMode="numeric"
                    value={draftQty}
                    onChange={(e) => setDraftQty(e.target.value)}
                    onBlur={() => commitEdit(index)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit(index);
                      if (e.key === "Escape") {
                        setEditingId(null);
                        setDraftQty("");
                      }
                    }}
                  />
                ) : (
                  <span className="qty-cell" onClick={() => startEdit(t)}>
                    {t.quantity}
                  </span>
                )}
              </td>
              <td className="num">{currency.format(t.price)}</td>
              <td className="num">{currency.format(t.quantity * t.price)}</td>
              <td>
                <span className={`status status-${t.status}`}>{t.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="num footer-label">
              Total notional ({visible.length} shown)
            </td>
            <td className="num footer-total">{currency.format(totalNotional)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
