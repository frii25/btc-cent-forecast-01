// btc-cent-forecast-01 — BTC price 240 minutes ahead.
//
// Model (designed from first principles, backtested walk-forward inside the
// six practice series; see README.md):
//
//   Score is mean absolute error, so the optimal forecast is the conditional
//   MEDIAN of the price 240 min ahead. Log-returns are roughly symmetric, so
//   the median log-return is close to its conditional mean.
//
//   What predicts the next 4 h? On the practice window (Nov 7-11 2026, 64
//   walk-forward checkpoints, every 60 min) the past log-return is NEGATIVELY
//   correlated with the next 240-min log-return at every horizon
//   (corr -0.13 at 15 min, -0.36 at 240 min, -0.53 at 1440 min): the price
//   mean-reverts over hours — sharp moves fade, rallies retrace. Extrapolating
//   momentum (positive drift) was WORSE than persistence on every variant
//   tried. So this forecaster FADES the recent move, with the OLS slope
//   (~-0.35) shrunk hard toward zero and the total move capped, so that if
//   the regime flips the damage vs. persistence stays small:
//
//     d = -(0.06 * log(last / price 240 min ago)
//           + 0.12 * log(last / price 1440 min ago)),  clamped to +/-0.012
//     forecast = last * exp(d)
//
//   Typical |d| is ~0.1%, p90 ~0.3%, max 1.2% — a small tilt on persistence,
//   not a bet. Backtest (identical windows, 64 checkpoints): persistence
//   42,871 cents MAE vs this blend 40,095 cents (-6.5%); the blend beat
//   persistence in both halves of the window (early 36,549 vs 39,154;
//   late 50,736 vs 54,020). On the 5 practice cases whose answers are
//   recoverable (p00-p04) it is a near-tie with persistence (47,532 vs
//   47,055 cents) — n=5 is noise-dominated, one continued selloff (p02)
//   accounts for the gap.
//
// Deterministic: pure arithmetic on the input prices, no randomness, no
// clock, no network. Node 22, standard library only.

import fs from "node:fs";
import path from "node:path";

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR || "/input";
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR || "/output";

// Fading weights on the log-return over each lookback (minutes), and the cap
// on the total log-adjustment. Kept small on purpose: the backtest signal is
// real but one 4-day regime, so we shrink hard and cap the bet.
const WEIGHTS = [
  [240, 0.06],
  [1440, 0.12],
];
const CAP = 0.012; // max |log adjustment| = 1.2%

function forecast(prices) {
  const n = prices.length;
  const last = prices[n - 1];
  if (!Number.isFinite(last) || last <= 0) return NaN;
  if (n < 2) return last;

  let d = 0;
  for (const [horizon, weight] of WEIGHTS) {
    // Use the longest lookback that fits; skip horizons longer than history.
    if (n - 1 < horizon) continue;
    const past = prices[n - 1 - horizon];
    if (!Number.isFinite(past) || past <= 0) continue;
    d -= weight * Math.log(last / past);
  }
  if (d > CAP) d = CAP;
  if (d < -CAP) d = -CAP;

  let price = last * Math.exp(d);
  // Grid is 5 decimals; round for cleanliness (does not affect determinism).
  price = Math.round(price * 1e5) / 1e5;
  if (!Number.isFinite(price) || price <= 0 || price >= 10000000) {
    // Fallback: never emit an invalid price — persistence is always valid.
    price = Math.round(last * 1e5) / 1e5;
  }
  return price;
}

// One case, crash-proof: an invalid case ranks below every all-valid entry
// and takes no prize, so a malformed case must never kill the run. If the
// case cannot be parsed at all we still write a file (with the case id from
// the filename) carrying a persistence guess when any usable price exists,
// else the smallest valid price; the grader then scores it as persistence.
function processCase(file) {
  const id = path.basename(file, ".in");
  let prices = null;
  try {
    const data = JSON.parse(fs.readFileSync(path.join(INPUT_DIR, file), "utf8"));
    const market = Array.isArray(data.markets) ? data.markets[0] : null;
    if (market && Array.isArray(market.prices) && market.prices.length > 0) {
      prices = market.prices;
    }
    if (prices) {
      const price = forecast(prices);
      if (Number.isFinite(price)) {
        return { forecasts: [{ case: data.case || id, price }] };
      }
    }
  } catch (_) {
    // fall through to the fallback below
  }
  const last = prices ? prices[prices.length - 1] : NaN;
  const price =
    Number.isFinite(last) && last > 0 && last < 10000000
      ? Math.round(last * 1e5) / 1e5
      : 1;
  return { forecasts: [{ case: id, price }] };
}

function main() {
  const files = fs
    .readdirSync(INPUT_DIR)
    .filter((f) => f.endsWith(".in"))
    .sort();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const file of files) {
    const out = processCase(file);
    const outName = path.basename(file, ".in") + ".out";
    fs.writeFileSync(path.join(OUTPUT_DIR, outName), JSON.stringify(out));
  }
}

main();
