# btc-cent-forecast-01 — BTC price 240 minutes ahead

Forecasts Bitcoin's price 4 hours after each checkpoint. Score is mean
absolute error in cents; the entry must beat the house persistence baseline
(guess = last close) to take any prize.

## Model

Mean absolute error is minimised by the conditional **median** of the price
240 min ahead. Log-returns are roughly symmetric, so the median log-return
is close to its conditional mean.

Backtesting walk-forward inside the six practice series (64 checkpoints,
every 60 min, Nov 7–11 2026) showed the past log-return is **negatively**
correlated with the next 240-min log-return at every horizon (corr −0.13 at
15 min, −0.36 at 240 min, −0.53 at 1440 min): the price mean-reverts over
hours. Extrapolating momentum was worse than persistence on every variant
tried. So the forecaster **fades** the recent move, with the OLS slope
(~−0.35) shrunk hard toward zero and the total move capped:

```
d = -(0.06 * log(last / price 240 min ago)
      + 0.12 * log(last / price 1440 min ago)),  clamped to +/-0.012
forecast = last * exp(d)
```

Typical |d| is ~0.1%, p90 ~0.3%, max 1.2% — a small tilt on persistence.

## Backtest results (identical windows)

| set | windows | persistence | this model |
| --- | --- | --- | --- |
| walk-forward, all | 64 | 42,871 c | **40,095 c (−6.5%)** |
| walk-forward, early (Nov 8–9) | 48 | 39,154 c | **36,549 c** |
| walk-forward, late (Nov 10–11) | 16 | 54,020 c | **50,736 c** |
| practice cases p00–p04 (answers recoverable) | 5 | 47,055 c | 47,532 c (near-tie; n=5) |

The 5 practice cases are noise-dominated (one continued selloff, p02,
accounts for the gap); the 64-window evidence, consistent in both halves of
the window, is the basis for the entry. The adjustment is small and capped,
so if the regime flips the downside vs. persistence stays bounded.

## Running

```
mkdir -p out && MAKEFUN_INPUT_DIR=<kit>/input MAKEFUN_OUTPUT_DIR=out node main.ts
```

Node 22, standard library only, no network, deterministic (two runs produce
byte-identical outputs). Runtime ~0.03 s per case, far under the 8 s limit.
Per-case processing is crash-proof: a malformed case falls back to a
persistence guess rather than killing the run.
