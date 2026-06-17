import { useEffect, useState } from "react";

/**
 * Live Price Feed.
 *
 * A streaming quote board. Rules:
 *  - Prices tick on an interval (a small random walk). The tick rate follows the
 *    speed selector; Pause/Resume stops and starts the feed.
 *  - When a price changes, its row flashes green (up) or red (down), then fades.
 *  - The header shows the time of the last update and a count of advancers /
 *    decliners (symbols above / below their opening price).
 *  - "Chg %" is the move since the opening price.
 *
 * There are several bugs. Find them, explain what's wrong, and fix what you can.
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

export default function App() {
  const [quotes, setQuotes] = useState<Quote[]>(INSTRUMENTS);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<Speed>("normal");
  const [flash, setFlash] = useState<Record<string, "up" | "down">>({});

  // Advancers / decliners shown in the header.
  const [advancers, setAdvancers] = useState(0);
  const [decliners, setDecliners] = useState(0);
  useEffect(() => {
    setAdvancers(quotes.filter((q) => q.price >= q.openPrice).length);
    setDecliners(quotes.filter((q) => q.price < q.openPrice).length);
  }, []);

  // The price feed: tick every SPEED_MS[speed] until paused.
  useEffect(() => {
    if (paused) return;
    setInterval(() => {
      setQuotes(
        quotes.map((q) => ({
          ...q,
          prevPrice: q.price,
          price: nextPrice(q.price),
        }))
      );
    }, SPEED_MS[speed]);
  }, [paused, speed]);

  // Flash a row green/red whenever its price moves.
  useEffect(() => {
    const dir: Record<string, "up" | "down"> = {};
    for (const q of quotes) {
      if (q.price > q.prevPrice) dir[q.symbol] = "up";
      else if (q.price < q.prevPrice) dir[q.symbol] = "down";
    }
    setFlash(dir);
  }, [quotes]);

  return (
    <div className="board">
      <div className="board-header">
        <div>
          <h1>Live Quotes</h1>
          <div className="status">
            <span className={paused ? "dot paused" : "dot live"} />
            {paused ? "Paused" : "Live"} · updated{" "}
            {new Date().toLocaleTimeString()}
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
