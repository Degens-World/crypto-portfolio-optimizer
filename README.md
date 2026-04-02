# Crypto Portfolio Optimizer

> Modern Portfolio Theory applied to crypto — find your efficient frontier in seconds.

## Features

- **Efficient Frontier** — 10,000 Monte Carlo simulated portfolios plotted by risk/return, color-coded by Sharpe ratio
- **Max Sharpe Portfolio** — automatically identifies the allocation with the best risk-adjusted return
- **Min Volatility Portfolio** — finds the lowest-risk combination of your chosen assets
- **Allocation Comparison** — side-by-side doughnut charts: current vs. optimal weights
- **Correlation Matrix** — Pearson correlation heatmap across all your assets
- **Rebalancing Plan** — per-asset BUY / SELL / HOLD recommendations with delta percentages
- **Asset Statistics** — annualised return, volatility, individual Sharpe ratio, max drawdown, BTC correlation
- **Up to 10 assets** — choose from 20 popular coins including BTC, ETH, SOL, ERG, LINK, AVAX, and more
- **History selector** — 30D / 90D / 180D / 1Y lookback windows

## How It Works

1. Pick your assets and current allocation percentages
2. Click **Optimize** — the app fetches daily OHLC data from CoinGecko
3. Daily log-returns are computed for each asset
4. 10,000 random portfolio weights are simulated (Dirichlet distribution)
5. Annualised return, volatility, and Sharpe ratio are computed for each simulated portfolio
6. The efficient frontier is plotted; Max Sharpe and Min Vol portfolios are highlighted
7. Rebalancing deltas are shown relative to your current weights

## Tech Stack

- Vanilla JS (no framework) + Chart.js 4
- CoinGecko public API (no key required)
- Modern Portfolio Theory (Markowitz)
- Fully client-side — no server, no data storage

## Live Demo

Deployed at [degens.world](https://degens.world)

---

Built by [Degens.World](https://degens.world)
