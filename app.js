'use strict';

// ── Popular coins the user can pick from ──────────────────────────────────────
const COIN_OPTIONS = [
  { id: 'bitcoin',       symbol: 'BTC',  name: 'Bitcoin' },
  { id: 'ethereum',      symbol: 'ETH',  name: 'Ethereum' },
  { id: 'solana',        symbol: 'SOL',  name: 'Solana' },
  { id: 'binancecoin',   symbol: 'BNB',  name: 'BNB' },
  { id: 'ripple',        symbol: 'XRP',  name: 'XRP' },
  { id: 'cardano',       symbol: 'ADA',  name: 'Cardano' },
  { id: 'avalanche-2',   symbol: 'AVAX', name: 'Avalanche' },
  { id: 'chainlink',     symbol: 'LINK', name: 'Chainlink' },
  { id: 'polkadot',      symbol: 'DOT',  name: 'Polkadot' },
  { id: 'matic-network', symbol: 'POL',  name: 'Polygon' },
  { id: 'uniswap',       symbol: 'UNI',  name: 'Uniswap' },
  { id: 'aave',          symbol: 'AAVE', name: 'Aave' },
  { id: 'ergo',          symbol: 'ERG',  name: 'Ergo' },
  { id: 'dogecoin',      symbol: 'DOGE', name: 'Dogecoin' },
  { id: 'near',          symbol: 'NEAR', name: 'NEAR' },
  { id: 'atom',          symbol: 'ATOM', name: 'Cosmos' },
  { id: 'litecoin',      symbol: 'LTC',  name: 'Litecoin' },
  { id: 'aptos',         symbol: 'APT',  name: 'Aptos' },
  { id: 'arbitrum',      symbol: 'ARB',  name: 'Arbitrum' },
  { id: 'optimism',      symbol: 'OP',   name: 'Optimism' },
];

const DEFAULT_PORTFOLIO = [
  { id: 'bitcoin',   pct: 50 },
  { id: 'ethereum',  pct: 30 },
  { id: 'solana',    pct: 20 },
];

// ── State ─────────────────────────────────────────────────────────────────────
let rows = [...DEFAULT_PORTFOLIO];
let frontierChart = null, currentPieChart = null, optimalPieChart = null;

// ── Build coin <select> HTML ──────────────────────────────────────────────────
function coinSelectHTML(selectedId) {
  return `<select class="coin-select">
    ${COIN_OPTIONS.map(c =>
      `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.symbol} — ${c.name}</option>`
    ).join('')}
  </select>`;
}

// ── Render asset rows ─────────────────────────────────────────────────────────
function renderRows() {
  const container = document.getElementById('assetRows');
  container.innerHTML = rows.map((r, i) => `
    <div class="asset-row" data-idx="${i}">
      ${coinSelectHTML(r.id)}
      <input type="number" class="pct-input" min="1" max="100" value="${r.pct}" placeholder="%" />
      <button class="remove-btn" data-idx="${i}" title="Remove">✕</button>
    </div>
  `).join('');

  container.querySelectorAll('.coin-select').forEach((el, i) => {
    el.addEventListener('change', () => { rows[i].id = el.value; });
  });
  container.querySelectorAll('.pct-input').forEach((el, i) => {
    el.addEventListener('input', () => { rows[i].pct = parseFloat(el.value) || 0; });
  });
  container.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      rows.splice(idx, 1);
      renderRows();
    });
  });
}

document.getElementById('addAsset').addEventListener('click', () => {
  if (rows.length >= 10) return;
  const used = new Set(rows.map(r => r.id));
  const next = COIN_OPTIONS.find(c => !used.has(c.id));
  rows.push({ id: next ? next.id : COIN_OPTIONS[0].id, pct: 10 });
  renderRows();
});

// ── Fetch price history from CoinGecko ───────────────────────────────────────
async function fetchPrices(coinId, days) {
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko error for ${coinId}: ${res.status}`);
  const data = await res.json();
  return data.prices.map(p => p[1]);
}

// ── Daily log returns ─────────────────────────────────────────────────────────
function logReturns(prices) {
  const r = [];
  for (let i = 1; i < prices.length; i++) r.push(Math.log(prices[i] / prices[i - 1]));
  return r;
}

// ── Stats helpers ─────────────────────────────────────────────────────────────
function mean(arr) { return arr.reduce((s, v) => s + v, 0) / arr.length; }
function std(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}
function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  const ma = mean(a.slice(0, n)), mb = mean(b.slice(0, n));
  let num = 0, da2 = 0, db2 = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da2 += (a[i] - ma) ** 2;
    db2 += (b[i] - mb) ** 2;
  }
  if (da2 === 0 || db2 === 0) return 0;
  return num / Math.sqrt(da2 * db2);
}
function maxDrawdown(prices) {
  let peak = prices[0], maxDD = 0;
  for (const p of prices) {
    if (p > peak) peak = p;
    const dd = (peak - p) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

// ── Portfolio stats from weights + return matrix ──────────────────────────────
function portfolioStats(weights, returns, tradingDays = 365) {
  const n = weights.length;
  const T = returns[0].length;
  const means = returns.map(mean);
  const stds = returns.map(std);

  const annRet = weights.reduce((s, w, i) => s + w * means[i] * tradingDays, 0);
  let annVar = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      annVar += weights[i] * weights[j] * pearson(returns[i], returns[j]) * stds[i] * stds[j] * tradingDays;
    }
  }
  const annVol = Math.sqrt(Math.max(0, annVar));
  const sharpe = annVol > 0 ? annRet / annVol : 0;
  return { annRet, annVol, sharpe };
}

// ── Monte Carlo: 10 000 random portfolios ─────────────────────────────────────
function runMonteCarlo(returns, n = 10000) {
  const k = returns.length;
  const portfolios = [];

  for (let s = 0; s < n; s++) {
    // Random Dirichlet-like weights
    const raw = Array.from({ length: k }, () => -Math.log(Math.random() + 1e-12));
    const sum = raw.reduce((a, b) => a + b, 0);
    const w = raw.map(v => v / sum);
    const { annRet, annVol, sharpe } = portfolioStats(w, returns);
    portfolios.push({ w, annRet, annVol, sharpe });
  }
  return portfolios;
}

// ── Color by sharpe ───────────────────────────────────────────────────────────
function sharpeColor(sharpe, minS, maxS) {
  const t = Math.max(0, Math.min(1, (sharpe - minS) / (maxS - minS + 1e-12)));
  // blue → green → yellow
  if (t < 0.5) {
    const r = Math.round(0 + t * 2 * 100);
    const g = Math.round(100 + t * 2 * 80);
    return `rgb(${r},${g},200)`;
  }
  const u = (t - 0.5) * 2;
  const r = Math.round(100 + u * 150);
  const g = Math.round(180 - u * 60);
  return `rgb(${r},${g},30)`;
}

// ── Chart helpers ─────────────────────────────────────────────────────────────
const PALETTE = ['#7c3aed','#06b6d4','#10b981','#f59e0b','#ef4444','#a78bfa','#34d399','#fbbf24','#60a5fa','#f87171'];

function destroyChart(ref) { if (ref) { try { ref.destroy(); } catch {} } }

function renderFrontierChart(portfolios, currentStats, optStats, minVolStats, labels) {
  destroyChart(frontierChart);
  const minS = Math.min(...portfolios.map(p => p.sharpe));
  const maxS = Math.max(...portfolios.map(p => p.sharpe));

  const ctx = document.getElementById('frontierChart').getContext('2d');
  frontierChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Simulated',
          data: portfolios.map(p => ({ x: p.annVol * 100, y: p.annRet * 100 })),
          pointRadius: 1.8,
          pointBackgroundColor: portfolios.map(p => sharpeColor(p.sharpe, minS, maxS)),
          pointBorderWidth: 0,
        },
        {
          label: 'Current',
          data: [{ x: currentStats.annVol * 100, y: currentStats.annRet * 100 }],
          pointRadius: 9, pointBackgroundColor: '#f59e0b', pointBorderColor: '#fff', pointBorderWidth: 2,
        },
        {
          label: 'Max Sharpe',
          data: [{ x: optStats.annVol * 100, y: optStats.annRet * 100 }],
          pointRadius: 9, pointBackgroundColor: '#10b981', pointBorderColor: '#fff', pointBorderWidth: 2,
        },
        {
          label: 'Min Vol',
          data: [{ x: minVolStats.annVol * 100, y: minVolStats.annRet * 100 }],
          pointRadius: 9, pointBackgroundColor: '#06b6d4', pointBorderColor: '#fff', pointBorderWidth: 2,
        },
      ]
    },
    options: {
      animation: false,
      plugins: { legend: { display: false }, tooltip: {
        callbacks: {
          label: ctx => `Vol: ${ctx.raw.x.toFixed(1)}%  Ret: ${ctx.raw.y.toFixed(1)}%`
        }
      }},
      scales: {
        x: { title: { display: true, text: 'Annualised Volatility (%)', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { color: '#1e2540' } },
        y: { title: { display: true, text: 'Annualised Return (%)', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { color: '#1e2540' } }
      }
    }
  });
}

function renderPie(canvasId, weights, labels, existingChart) {
  destroyChart(existingChart);
  const ctx = document.getElementById(canvasId).getContext('2d');
  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: weights.map(w => (w * 100).toFixed(1)), backgroundColor: PALETTE, borderColor: '#111520', borderWidth: 2 }]
    },
    options: {
      animation: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.raw}%` } }
      }
    }
  });
}

// ── Render correlation matrix ─────────────────────────────────────────────────
function renderCorrMatrix(returns, symbols) {
  const n = returns.length;
  let html = '<table><thead><tr><th></th>';
  symbols.forEach(s => { html += `<th>${s}</th>`; });
  html += '</tr></thead><tbody>';

  for (let i = 0; i < n; i++) {
    html += `<tr><th>${symbols[i]}</th>`;
    for (let j = 0; j < n; j++) {
      const c = pearson(returns[i], returns[j]);
      const abs = Math.abs(c);
      const r = c < 0 ? Math.round(abs * 120) : 0;
      const g = c > 0 ? Math.round(abs * 120) : 0;
      const bg = `rgba(${r},${g},120,${(abs * 0.7).toFixed(2)})`;
      html += `<td style="background:${bg};color:#e2e8f0">${c.toFixed(2)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  document.getElementById('corrMatrix').innerHTML = html;
}

// ── Render stats table ────────────────────────────────────────────────────────
function renderStatsTable(returns, prices, symbols, btcReturns) {
  const tbody = document.querySelector('#statsTable tbody');
  tbody.innerHTML = '';
  const DAYS = 365;
  returns.forEach((r, i) => {
    const ann = mean(r) * DAYS;
    const vol = std(r) * Math.sqrt(DAYS);
    const sharpe = vol > 0 ? ann / vol : 0;
    const mdd = maxDrawdown(prices[i]);
    const corrBtc = pearson(r, btcReturns);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${symbols[i]}</strong></td>
      <td class="${ann >= 0 ? 'green' : 'red'}">${(ann * 100).toFixed(1)}%</td>
      <td>${(vol * 100).toFixed(1)}%</td>
      <td class="${sharpe >= 0 ? 'green' : 'red'}">${sharpe.toFixed(2)}</td>
      <td class="red">${(mdd * 100).toFixed(1)}%</td>
      <td class="${corrBtc >= 0 ? 'yellow' : 'cyan'}">${corrBtc.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Render rebalance table ────────────────────────────────────────────────────
function renderRebalanceTable(currentWeights, optWeights, symbols) {
  const tbody = document.querySelector('#rebalanceTable tbody');
  tbody.innerHTML = '';
  symbols.forEach((s, i) => {
    const cur = currentWeights[i] * 100;
    const opt = optWeights[i] * 100;
    const delta = opt - cur;
    const action = Math.abs(delta) < 2 ? 'HOLD' : delta > 0 ? 'BUY' : 'SELL';
    const cls = action === 'BUY' ? 'action-buy' : action === 'SELL' ? 'action-sell' : 'action-hold';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${s}</strong></td>
      <td>${cur.toFixed(1)}%</td>
      <td>${opt.toFixed(1)}%</td>
      <td class="${delta >= 0 ? 'green' : 'red'}">${delta > 0 ? '+' : ''}${delta.toFixed(1)}%</td>
      <td><span class="${cls}">${action}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Render stats row ──────────────────────────────────────────────────────────
function renderStatsRow(current, optimal, minvol) {
  const sharpeImprove = optimal.sharpe - current.sharpe;
  const volReduce = current.annVol - minvol.annVol;
  document.getElementById('statsRow').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Current Ann. Return</div>
      <div class="stat-value ${current.annRet >= 0 ? 'green' : 'red'}">${(current.annRet * 100).toFixed(1)}%</div>
      <div class="stat-sub">Annualised (historical)</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Current Sharpe Ratio</div>
      <div class="stat-value ${current.sharpe >= 0 ? 'yellow' : 'red'}">${current.sharpe.toFixed(2)}</div>
      <div class="stat-sub">Risk-adjusted return</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Optimal Sharpe</div>
      <div class="stat-value green">${optimal.sharpe.toFixed(2)}</div>
      <div class="stat-sub">+${sharpeImprove.toFixed(2)} improvement</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Optimal Ann. Return</div>
      <div class="stat-value ${optimal.annRet >= 0 ? 'green' : 'red'}">${(optimal.annRet * 100).toFixed(1)}%</div>
      <div class="stat-sub">Max Sharpe portfolio</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Min-Vol Portfolio</div>
      <div class="stat-value cyan">${(minvol.annVol * 100).toFixed(1)}%</div>
      <div class="stat-sub">-${(volReduce * 100).toFixed(1)}% vs current vol</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Current Volatility</div>
      <div class="stat-value purple">${(current.annVol * 100).toFixed(1)}%</div>
      <div class="stat-sub">Annualised</div>
    </div>
  `;
}

// ── Main optimize ─────────────────────────────────────────────────────────────
document.getElementById('optimizeBtn').addEventListener('click', async () => {
  const errorEl = document.getElementById('builderError');
  const loadingEl = document.getElementById('loadingState');
  const loadingText = document.getElementById('loadingText');
  const resultsEl = document.getElementById('results');
  errorEl.classList.add('hidden');
  resultsEl.classList.add('hidden');

  // Deduplicate and normalise weights
  const seen = new Set();
  const assets = [];
  for (const r of rows) {
    if (!seen.has(r.id) && r.pct > 0) { seen.add(r.id); assets.push({ ...r }); }
  }
  if (assets.length < 2) {
    errorEl.textContent = 'Add at least 2 different assets with non-zero weights.';
    errorEl.classList.remove('hidden');
    return;
  }
  const totalPct = assets.reduce((s, a) => s + a.pct, 0);
  const currentWeights = assets.map(a => a.pct / totalPct);

  const days = parseInt(document.getElementById('historyDays').value);
  loadingEl.classList.remove('hidden');
  document.getElementById('optimizeBtn').disabled = true;

  try {
    // Fetch prices
    const allPrices = [];
    for (const a of assets) {
      loadingText.textContent = `Fetching ${a.id}…`;
      const p = await fetchPrices(a.id, days);
      allPrices.push(p);
      await new Promise(res => setTimeout(res, 200)); // rate-limit politely
    }

    // Align lengths
    const minLen = Math.min(...allPrices.map(p => p.length));
    const prices = allPrices.map(p => p.slice(p.length - minLen));

    // Returns
    const returns = prices.map(logReturns);
    const symbols = assets.map(id => COIN_OPTIONS.find(c => c.id === id.id)?.symbol || id.id.toUpperCase());

    loadingText.textContent = 'Running Monte Carlo simulation…';
    await new Promise(res => setTimeout(res, 10));
    const portfolios = runMonteCarlo(returns, 10000);

    // Find special portfolios
    const optPortfolio = portfolios.reduce((best, p) => p.sharpe > best.sharpe ? p : best);
    const minVolPortfolio = portfolios.reduce((best, p) => p.annVol < best.annVol ? p : best);
    const currentStats = portfolioStats(currentWeights, returns);
    const optStats = portfolioStats(optPortfolio.w, returns);
    const minVolStats = portfolioStats(minVolPortfolio.w, returns);

    // BTC returns for correlation
    const btcIdx = assets.findIndex(a => a.id === 'bitcoin');
    const btcReturns = btcIdx >= 0 ? returns[btcIdx] : returns[0];

    // Render everything
    renderStatsRow(currentStats, optStats, minVolStats);
    renderFrontierChart(portfolios, currentStats, optStats, minVolStats, symbols);
    currentPieChart = renderPie('currentPie', currentWeights, symbols, currentPieChart);
    optimalPieChart = renderPie('optimalPie', optPortfolio.w, symbols, optimalPieChart);
    renderCorrMatrix(returns, symbols);
    renderRebalanceTable(currentWeights, optPortfolio.w, symbols);
    renderStatsTable(returns, prices, symbols, btcReturns);

    loadingEl.classList.add('hidden');
    resultsEl.classList.remove('hidden');
  } catch (err) {
    loadingEl.classList.add('hidden');
    errorEl.textContent = `Error: ${err.message}. CoinGecko may be rate-limiting — wait 60s and retry.`;
    errorEl.classList.remove('hidden');
  } finally {
    document.getElementById('optimizeBtn').disabled = false;
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
renderRows();
