import { useEffect, useState } from "react";

/**
 * Live Price Feed — reference solution.
 *
 * A streaming quote board:
 *  - Prices tick on an interval (a small random walk). The tick rate follows the
 *    speed selector; Pause/Resume stops and starts the feed.
 *  - When a price changes, its row flashes green (up) or red (down), then fades.
 *  - The header shows the time of the last update and a count of advancers /
 *    decliners (symbols above / below their opening price).
 *  - "Chg %" is the move since the opening price.
 */

interface Quote {
  symbol: string;
  name: string;
  openPrice: number; // day's open — fixed baseline for "Chg %"
  prevPrice: number; // price at the previous tick — drives the up/down flash
  price: number; // latest price
}

type Speed = "slow" | "normal" | "fast";

const SPEED_MS: Record<Speed, number> = {
  slow: 2000,
  normal: 1000,
  fast: 500,
};

const INSTRUMENTS: Quote[] = [
  { symbol: "AAPL", name: "Apple Inc.", openPrice: 184.32, prevPrice: 184.32, price: 184.32 },
  { symbol: "MSFT", name: "Microsoft Corp.", openPrice: 421.55, prevPrice: 421.55, price: 421.55 },
  { symbol: "NVDA", name: "NVIDIA Corp.", openPrice: 121.4, prevPrice: 121.4, price: 121.4 },
  { symbol: "AMZN", name: "Amazon.com Inc.", openPrice: 186.9, prevPrice: 186.9, price: 186.9 },
  { symbol: "TSLA", name: "Tesla Inc.", openPrice: 248.5, prevPrice: 248.5, price: 248.5 },
  { symbol: "JPM", name: "JPMorgan Chase", openPrice: 199.75, prevPrice: 199.75, price: 199.75 },
];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

// Random-walk a price by up to +/- 0.5% per tick.
function nextPrice(price: number): number {
  const drift = price * (Math.random() - 0.5) * 0.01;
  return Math.max(0.01, Number((price + drift).toFixed(2)));
}

export default function LivePriceFeed() {
  const [quotes, setQuotes] = useState<Quote[]>(INSTRUMENTS);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<Speed>("normal");
  const [flash, setFlash] = useState<Record<string, "up" | "down">>({});
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Fix (bug 4): advancers / decliners are derived from the current quotes — no
  // need to mirror them into state, where they'd go stale.
  const advancers = quotes.filter((q) => q.price >= q.openPrice).length;
  const decliners = quotes.length - advancers;

  // The price feed.
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      // Fix (bug 1): functional update so each tick builds on the *latest*
      // prices, not the ones captured when this effect last ran.
      setQuotes((prev) =>
        prev.map((q) => ({
          ...q,
          prevPrice: q.price,
          price: nextPrice(q.price),
        }))
      );
      // Fix (bug 5): capture the update time from the tick itself.
      setLastUpdated(Date.now());
    }, SPEED_MS[speed]);
    // Fix (bug 2): tear the interval down when the effect re-runs or unmounts.
    return () => clearInterval(id);
  }, [paused, speed]);

  // Flash a row green/red when its price moves, then clear it shortly after.
  useEffect(() => {
    const dir: Record<string, "up" | "down"> = {};
    for (const q of quotes) {
      if (q.price > q.prevPrice) dir[q.symbol] = "up";
      else if (q.price < q.prevPrice) dir[q.symbol] = "down";
    }
    if (Object.keys(dir).length === 0) return;
    setFlash(dir);
    // Fix (bug 3): clear the flash so the row fades back. Cancel a pending clear
    // if another tick arrives first.
    const t = setTimeout(() => setFlash({}), 400);
    return () => clearTimeout(t);
  }, [quotes]);

  return (
    <div className="board">
      <div className="board-header">
        <div>
          <h1>Live Quotes</h1>
          <div className="status">
            <span className={paused ? "dot paused" : "dot live"} />
            {paused ? "Paused" : "Live"}
            {lastUpdated !== null && (
              <> · updated {new Date(lastUpdated).toLocaleTimeString()}</>
            )}
          </div>
        </div>
        <div className="breadth">
          <span className="up">▲ {advancers}</span>
          <span className="down">▼ {decliners}</span>
        </div>
      </div>

      <div className="controls">
        <button className="pause-btn" onClick={() => setPaused((p) => !p)}>
          {paused ? "Resume" : "Pause"}
        </button>
        <label className="speed">
          Speed
          <select
            value={speed}
            onChange={(e) => setSpeed(e.target.value as Speed)}
          >
            <option value="slow">Slow</option>
            <option value="normal">Normal</option>
            <option value="fast">Fast</option>
          </select>
        </label>
      </div>

      <table className="quotes">
        <thead>
          <tr>
            <th>Symbol</th>
            <th className="num">Last</th>
            <th className="num">Tick</th>
            <th className="num">Chg %</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => {
            const pct = ((q.price - q.openPrice) / q.openPrice) * 100;
            const f = flash[q.symbol];
            return (
              <tr key={q.symbol} className={f ? `row ${f}` : "row"}>
                <td>
                  <span className="sym">{q.symbol}</span>
                  <span className="name">{q.name}</span>
                </td>
                <td className="num last">{currency.format(q.price)}</td>
                <td className="num">
                  {q.price > q.prevPrice
                    ? "▲"
                    : q.price < q.prevPrice
                    ? "▼"
                    : "·"}
                </td>
                <td className={`num ${pct >= 0 ? "up" : "down"}`}>
                  {pct >= 0 ? "+" : ""}
                  {pct.toFixed(2)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
