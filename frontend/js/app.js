/* BedavaFinans Main Application */

const REFRESH_INTERVAL = 120000; // 2 minutes
let refreshTimer = null;
let countdownTimer = null;
let countdownSeconds = 120;
let autoRefreshEnabled = true;
let selectedCoin = 'bitcoin';
let allCoins = [];
let currentSignals = [];
let sortColumn = 'market_cap_rank';
let sortAsc = true;
let searchQuery = '';
let watchlist = JSON.parse(localStorage.getItem('bedavafinans-watchlist') || '[]');
let showWatchlistOnly = false;
let priceAlerts = JSON.parse(localStorage.getItem('bedavafinans-alerts') || '[]');

// ─── Theme ───
let currentTheme = localStorage.getItem('bedavafinans-theme') || 'dark';

function applyTheme(theme) {
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(theme);
    currentTheme = theme;
    localStorage.setItem('bedavafinans-theme', theme);
    updateThemeIcon();
    // Update chart colors if chart exists
    if (typeof updateChartTheme === 'function') {
        updateChartTheme(theme);
    }
}

function toggleTheme() {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

function updateThemeIcon() {
    const moon = document.getElementById('theme-icon-moon');
    const sun = document.getElementById('theme-icon-sun');
    if (moon && sun) {
        moon.style.display = currentTheme === 'dark' ? 'block' : 'none';
        sun.style.display = currentTheme === 'light' ? 'block' : 'none';
    }
}

// ─── Mobile Menu ───
function toggleMobileMenu() {
    const controls = document.getElementById('header-controls');
    if (controls) controls.classList.toggle('open');
}

// Close mobile menu on outside click
document.addEventListener('click', (e) => {
    const controls = document.getElementById('header-controls');
    const menuBtn = document.getElementById('mobile-menu-btn');
    if (controls && menuBtn && !controls.contains(e.target) && !menuBtn.contains(e.target)) {
        controls.classList.remove('open');
    }
});

// ─── Initialize ───
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(currentTheme);
    try { initChart('chart-container'); } catch (e) { console.warn('Chart init error:', e); }
    applyTranslations();
    updateLangButton();
    loadAll();
    startAutoRefresh();

    // Search input
    const searchInput = document.getElementById('coin-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase();
            renderCoinTable(allCoins);
        });
    }

    // Auto-refresh toggle
    const refreshToggle = document.getElementById('refresh-toggle');
    if (refreshToggle) {
        refreshToggle.addEventListener('click', () => {
            autoRefreshEnabled = !autoRefreshEnabled;
            refreshToggle.textContent = autoRefreshEnabled ? t('auto') : t('paused');
            refreshToggle.style.color = autoRefreshEnabled ? '#10b981' : '#ef4444';
            if (autoRefreshEnabled) startAutoRefresh();
            else { stopAutoRefresh(); updateCountdownDisplay(); }
        });
    }
});

// ─── Keyboard Shortcuts ───
document.addEventListener('keydown', (e) => {
    // Skip if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
            e.target.blur();
            e.target.value = '';
            searchQuery = '';
            renderCoinTable(allCoins);
        }
        return;
    }
    switch (e.key.toLowerCase()) {
        case 'r': loadAll(); showToast(t('data-refreshed'), 'success'); break;
        case 't': toggleTheme(); break;
        case 'l': toggleLang(); break;
        case '/': e.preventDefault(); document.getElementById('coin-search')?.focus(); break;
        case 'w': toggleWatchlistFilter(); break;
    }
});

// Called by i18n toggleLang() to re-render dynamic content
function renderDynamicContent() {
    if (allCoins.length) renderCoinTable(allCoins);
    if (currentSignals.length) renderSignalTable(currentSignals);
    if (window._moversData) renderMovers(window._moversData);
    if (window._anomaliesData) renderVolumeAnomalies(window._anomaliesData);
    if (window._derivativesData) renderDerivatives(window._derivativesData);
    if (window._sentimentData) renderNewsSentiment('news-sentiment', window._sentimentData);
    if (window._overviewData) renderOverviewWidgets(window._overviewData);
}

async function loadAll() {
    updateTimestamp();
    showLoading(true);

    await Promise.allSettled([
        loadMarketOverview(),
        loadCoins(),
        loadSignals(),
        loadMovers(),
        loadVolumeAnomalies(),
        loadDerivatives(),
        loadWhales(),
        loadSentiment(),
        loadChart(selectedCoin),
    ]);

    showLoading(false);
}

function startAutoRefresh() {
    stopAutoRefresh();
    countdownSeconds = REFRESH_INTERVAL / 1000;
    updateCountdownDisplay();

    refreshTimer = setInterval(async () => {
        if (!autoRefreshEnabled) return;
        const results = await Promise.allSettled([
            loadMarketOverview(),
            loadCoins(),
            loadSignals(),
            loadMovers(),
            loadVolumeAnomalies(),
            loadDerivatives(),
            loadWhales(),
            loadSentiment(),
        ]);
        updateTimestamp();
        countdownSeconds = REFRESH_INTERVAL / 1000;
        const hasError = results.some(r => r.status === 'rejected');
        if (hasError) showToast(t('refresh-error'), 'error');
    }, REFRESH_INTERVAL);

    countdownTimer = setInterval(() => {
        if (!autoRefreshEnabled) return;
        countdownSeconds = Math.max(0, countdownSeconds - 1);
        updateCountdownDisplay();
    }, 1000);
}

function stopAutoRefresh() {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
}

function updateCountdownDisplay() {
    const fill = document.getElementById('countdown-fill');
    const text = document.getElementById('countdown-text');
    const bar = document.getElementById('countdown-bar');
    const total = REFRESH_INTERVAL / 1000;
    const pct = (countdownSeconds / total) * 100;
    const min = Math.floor(countdownSeconds / 60);
    const sec = countdownSeconds % 60;
    if (fill) fill.style.width = pct + '%';
    if (text) text.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
    if (bar) bar.style.display = autoRefreshEnabled ? 'inline-block' : 'none';
    if (text) text.style.display = autoRefreshEnabled ? 'inline' : 'none';
}

function updateTimestamp() {
    const el = document.getElementById('last-updated');
    const locale = currentLang === 'tr' ? 'tr-TR' : 'en-US';
    if (el) el.textContent = new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function showLoading(show) {
    const el = document.getElementById('loading-indicator');
    if (el) el.style.display = show ? 'inline-block' : 'none';
}

// ─── Market Overview ───
async function loadMarketOverview() {
    const data = await getMarketOverview();
    if (!data) return;
    window._overviewData = data;
    renderOverviewWidgets(data);
}

function renderOverviewWidgets(data) {
    setText('total-mcap', formatCurrency(data.total_market_cap_usd));
    setText('total-volume', formatCurrency(data.total_volume_usd));
    setText('btc-dominance', data.btc_dominance ? data.btc_dominance.toFixed(1) + '%' : '—');

    const mcChange = data.market_cap_change_24h;
    const mcEl = document.getElementById('mcap-change');
    if (mcEl && mcChange != null) {
        mcEl.innerHTML = formatPercentage(mcChange);
    }

    if (data.fear_greed) {
        const fgClass = translateFearGreed(data.fear_greed.classification);
        renderFearGreedGauge('fear-greed-gauge', data.fear_greed.value, fgClass);
        if (data.fear_greed.history) {
            renderFearGreedHistory('fear-greed-history', data.fear_greed.history);
        }
    }

    if (data.market_score) {
        const msLabel = translateMarketScore(data.market_score.label);
        renderMarketScoreRing('market-score-ring', data.market_score.score, msLabel);
    }
}

// ─── Coins Table ───
async function loadCoins() {
    const coins = await getCoins();
    if (!coins) return;
    allCoins = coins;
    renderCoinTable(coins);
    checkPriceAlerts();
}

function renderCoinTable(coins) {
    const tbody = document.getElementById('coins-tbody');
    if (!tbody) return;

    let filtered = coins;
    if (showWatchlistOnly) {
        filtered = filtered.filter(c => watchlist.includes(c.id));
    }
    if (searchQuery) {
        filtered = filtered.filter(c =>
            c.name.toLowerCase().includes(searchQuery) ||
            c.symbol.toLowerCase().includes(searchQuery)
        );
    }

    filtered.sort((a, b) => {
        let va = a[sortColumn] ?? 0;
        let vb = b[sortColumn] ?? 0;
        return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

    tbody.innerHTML = filtered.map(coin => {
        const pct1h = coin.price_change_percentage_1h_in_currency;
        const pct24h = coin.price_change_percentage_24h_in_currency || coin.price_change_percentage_24h;
        const pct7d = coin.price_change_percentage_7d_in_currency;
        const isFav = watchlist.includes(coin.id);
        const starColor = isFav ? '#eab308' : 'var(--text-secondary)';
        const starFill = isFav ? '#eab308' : 'none';

        return `
            <tr onclick="selectCoin('${coin.id}')" style="cursor:pointer" class="${coin.id === selectedCoin ? 'selected' : ''}">
                <td style="color:var(--text-secondary)">
                    <div style="display:flex;align-items:center;gap:4px">
                        <svg onclick="toggleWatchlist('${coin.id}',event)" width="14" height="14" viewBox="0 0 24 24" fill="${starFill}" stroke="${starColor}" stroke-width="2" style="cursor:pointer;flex-shrink:0;transition:all 0.2s"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        <span>${coin.market_cap_rank || '—'}</span>
                    </div>
                </td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px">
                        <img src="${coin.image}" width="20" height="20" style="border-radius:50%" alt="" loading="lazy">
                        <span style="font-weight:600">${escapeHtml(coin.name)}</span>
                        <span style="color:var(--text-secondary);font-size:11px">${coin.symbol.toUpperCase()}</span>
                        <svg onclick="openCoinModal('${coin.id}',event)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2" style="cursor:pointer;opacity:0.5;flex-shrink:0" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        <svg onclick="promptPriceAlert('${coin.id}',event)" width="14" height="14" viewBox="0 0 24 24" fill="${priceAlerts.some(a => a.coinId === coin.id && !a.triggered) ? 'var(--accent-blue)' : 'none'}" stroke="var(--text-secondary)" stroke-width="2" style="cursor:pointer;opacity:0.5;flex-shrink:0" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                    </div>
                </td>
                <td style="font-weight:500">${formatCurrency(coin.current_price)}</td>
                <td>${formatPercentage(pct1h)}</td>
                <td>${formatPercentage(pct24h)}</td>
                <td>${formatPercentage(pct7d)}</td>
                <td>${renderSparklineSVG(coin.sparkline_in_7d?.price, (pct7d || 0) >= 0)}</td>
                <td style="color:var(--text-secondary)">${formatLargeNumber(coin.total_volume)}</td>
                <td style="color:var(--text-secondary)">${formatCurrency(coin.market_cap)}</td>
            </tr>
        `;
    }).join('');
}

function sortTable(column) {
    if (sortColumn === column) {
        sortAsc = !sortAsc;
    } else {
        sortColumn = column;
        sortAsc = column === 'market_cap_rank';
    }
    renderCoinTable(allCoins);
    updateSortIndicators();
}

function updateSortIndicators() {
    document.querySelectorAll('.data-table th[onclick*="sortTable"]').forEach(th => {
        const match = th.getAttribute('onclick')?.match(/sortTable\('([^']+)'\)/);
        if (!match) return;
        const col = match[1];
        const existing = th.querySelector('.sort-arrow');
        if (existing) existing.remove();
        if (col === sortColumn) {
            const arrow = document.createElement('span');
            arrow.className = 'sort-arrow';
            arrow.style.cssText = 'margin-left:4px;font-size:10px;opacity:0.7';
            arrow.textContent = sortAsc ? '\u25B2' : '\u25BC';
            th.appendChild(arrow);
        }
    });
}

function selectCoin(coinId) {
    selectedCoin = coinId;
    loadChart(coinId);
    renderCoinTable(allCoins);

    const titleEl = document.getElementById('chart-title');
    const coin = allCoins.find(c => c.id === coinId);
    if (titleEl && coin) {
        titleEl.textContent = `${coin.name} (${coin.symbol.toUpperCase()})`;
    }
}

// ─── Watchlist ───
function toggleWatchlist(coinId, event) {
    if (event) event.stopPropagation();
    const idx = watchlist.indexOf(coinId);
    if (idx === -1) watchlist.push(coinId);
    else watchlist.splice(idx, 1);
    localStorage.setItem('bedavafinans-watchlist', JSON.stringify(watchlist));
    renderCoinTable(allCoins);
}

function toggleWatchlistFilter() {
    showWatchlistOnly = !showWatchlistOnly;
    const btn = document.getElementById('watchlist-filter');
    if (btn) {
        btn.classList.toggle('active', showWatchlistOnly);
        btn.style.color = showWatchlistOnly ? 'var(--accent-blue)' : 'var(--text-secondary)';
    }
    renderCoinTable(allCoins);
}

// ─── Signals ───
async function loadSignals() {
    const signals = await getSignals();
    if (!signals) return;
    currentSignals = signals;
    renderSignalTable(signals);
}

function renderSignalTable(signals) {
    const tbody = document.getElementById('signals-tbody');
    if (!tbody) return;

    tbody.innerHTML = signals.map(s => {
        const rsiVal = s.indicators?.rsi?.value;
        const rsiSig = s.indicators?.rsi?.signal;
        const translatedSignal = translateSignal(s.signal);

        return `
            <tr onclick="selectCoin('${s.coin_id}')" style="cursor:pointer">
                <td>
                    <div style="display:flex;align-items:center;gap:6px">
                        ${s.image ? `<img src="${s.image}" width="18" height="18" style="border-radius:50%" alt="" loading="lazy">` : ''}
                        <span style="font-weight:600">${escapeHtml(s.symbol)}</span>
                    </div>
                </td>
                <td>${formatCurrency(s.current_price)}</td>
                <td>${formatPercentage(s.price_change_24h)}</td>
                <td>${renderSignalBadge(s.signal, translatedSignal)}</td>
                <td>${renderConfidenceDot(s.confidence, translateConfidence(s.confidence))} <span style="font-size:11px;color:var(--text-secondary)">${s.score?.toFixed(2) || '—'}</span></td>
                <td>${rsiVal != null ? renderIndicatorPill('RSI', rsiVal, rsiSig) : '—'}</td>
                <td style="font-size:11px">${renderLayerBreakdown(s.layers)}</td>
            </tr>
        `;
    }).join('');
}

// ─── Chart ───
async function loadChart(coinId) {
    const ohlc = await getOHLC(coinId);
    if (ohlc && ohlc.length > 0) {
        updateChartData(ohlc);
    }
}

// ─── Top Movers ───
let moversTab = 'gainers';

async function loadMovers() {
    const data = await getMovers();
    if (!data) return;
    window._moversData = data;
    renderMovers(data);
}

function renderMovers(data) {
    const container = document.getElementById('movers-list');
    if (!container) return;

    const items = moversTab === 'gainers' ? data.gainers : data.losers;
    container.innerHTML = (items || []).map(coin => {
        const pct = coin.price_change_percentage_24h_in_currency || coin.price_change_percentage_24h || 0;
        const isUp = pct >= 0;
        const barWidth = Math.min(Math.abs(pct) * 3, 100);
        const barColor = isUp ? '#10b981' : '#ef4444';

        return `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer" onclick="selectCoin('${coin.id}')">
                <img src="${coin.image}" width="16" height="16" style="border-radius:50%" alt="" loading="lazy">
                <span style="font-size:12px;font-weight:500;width:50px">${coin.symbol.toUpperCase()}</span>
                <div style="flex:1;height:4px;border-radius:2px;background:var(--border);overflow:hidden">
                    <div style="width:${barWidth}%;height:100%;background:${barColor};border-radius:2px;${!isUp ? 'margin-left:auto' : ''}"></div>
                </div>
                <span style="font-size:12px;font-weight:600;width:60px;text-align:right;color:${barColor}">${formatPercentagePlain(pct)}</span>
            </div>
        `;
    }).join('');
}

function switchMoversTab(tab) {
    moversTab = tab;
    document.querySelectorAll('.movers-tab').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === tab);
    });
    if (window._moversData) renderMovers(window._moversData);
}

// ─── Volume Anomalies ───
async function loadVolumeAnomalies() {
    const anomalies = await getVolumeAnomalies();
    window._anomaliesData = anomalies || [];
    renderVolumeAnomalies(window._anomaliesData);
}

function renderVolumeAnomalies(anomalies) {
    const container = document.getElementById('anomalies-list');
    if (!container) return;

    if (anomalies.length === 0) {
        container.innerHTML = `<div style="color:var(--text-secondary);font-size:12px;padding:8px">${t('no-anomalies')}</div>`;
        return;
    }

    container.innerHTML = anomalies.slice(0, 8).map(a => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:12px;font-weight:600">${escapeHtml(a.symbol || '')}</span>
            <div style="display:flex;align-items:center;gap:8px">
                <span style="font-size:11px;color:#f97316">${a.deviation_multiple?.toFixed(1) || '?'}x</span>
                <span style="font-size:11px;color:var(--text-secondary)">${formatLargeNumber(a.current_volume)}</span>
            </div>
        </div>
    `).join('');
}

// ─── Derivatives ───
async function loadDerivatives() {
    const data = await getDerivatives();
    window._derivativesData = data || [];
    renderDerivatives(window._derivativesData);
}

function renderDerivatives(data) {
    const container = document.getElementById('derivatives-list');
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = `<div style="color:var(--text-secondary);font-size:12px;padding:8px">${t('loading')}</div>`;
        return;
    }

    container.innerHTML = data.slice(0, 10).map(d => {
        const fr = d.funding_rate;
        const frVal = fr?.value != null ? fr.value.toFixed(4) + '%' : '—';
        const frColor = fr?.signal === 'bearish' || fr?.signal === 'slightly_bearish' ? '#ef4444' :
                        fr?.signal === 'bullish' || fr?.signal === 'slightly_bullish' ? '#10b981' : '#6b7280';

        const ls = d.long_short_ratio;
        const lsVal = ls?.value != null ? ls.value.toFixed(2) : '—';

        return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)">
                <span style="font-size:12px;font-weight:600;width:45px">${escapeHtml(d.symbol || '')}</span>
                <span style="font-size:11px;color:${frColor}" title="Funding Rate">${frVal}</span>
                <span style="font-size:11px;color:var(--text-secondary)" title="L/S Ratio">${lsVal}</span>
                <span style="font-size:11px;color:var(--text-secondary)" title="Open Interest">${d.open_interest ? formatLargeNumber(d.open_interest) : '—'}</span>
            </div>
        `;
    }).join('');
}

// ─── Whales ───
async function loadWhales() {
    const data = await getWhales();
    renderWhaleTicker('whale-ticker', data || []);
}

// ─── Sentiment ───
async function loadSentiment() {
    const data = await getSentiment();
    window._sentimentData = data;
    renderNewsSentiment('news-sentiment', data);
}

// ─── Modal ───
async function openCoinModal(coinId, event) {
    if (event) event.stopPropagation();
    const modal = document.getElementById('coin-modal');
    const body = document.getElementById('modal-body');
    if (!modal || !body) return;

    modal.style.display = 'flex';
    body.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-secondary)">${t('loading')}</div>`;

    const [detail, signal] = await Promise.all([
        getCoinDetail(coinId),
        getCoinSignal(coinId),
    ]);

    if (!detail || !detail.id) {
        body.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-secondary)">No data</div>`;
        return;
    }

    const md = detail.market_data || {};
    const translatedSignal = signal ? translateSignal(signal.signal) : '—';

    body.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
            ${detail.image ? `<img src="${detail.image}" width="48" height="48" style="border-radius:50%">` : ''}
            <div>
                <h2 style="font-size:18px;font-weight:700;margin:0">${escapeHtml(detail.name)}</h2>
                <span style="color:var(--text-secondary);font-size:13px">${detail.symbol} &middot; #${detail.market_cap_rank || '—'}</span>
            </div>
            ${signal ? `<div style="margin-left:auto">${renderSignalBadge(signal.signal, translatedSignal)}</div>` : ''}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
            <div class="card" style="padding:10px">
                <div style="font-size:10px;color:var(--text-secondary);text-transform:uppercase">${t('th-price')}</div>
                <div style="font-size:16px;font-weight:700">${formatCurrency(md.current_price)}</div>
            </div>
            <div class="card" style="padding:10px">
                <div style="font-size:10px;color:var(--text-secondary);text-transform:uppercase">${t('th-market-cap')}</div>
                <div style="font-size:16px;font-weight:700">${formatCurrency(md.market_cap)}</div>
            </div>
            <div class="card" style="padding:10px">
                <div style="font-size:10px;color:var(--text-secondary);text-transform:uppercase">24h High / Low</div>
                <div style="font-size:13px"><span class="text-up">${formatCurrency(md.high_24h)}</span> / <span class="text-down">${formatCurrency(md.low_24h)}</span></div>
            </div>
            <div class="card" style="padding:10px">
                <div style="font-size:10px;color:var(--text-secondary);text-transform:uppercase">ATH</div>
                <div style="font-size:13px">${formatCurrency(md.ath)} <span style="font-size:11px;color:var(--accent-red)">${md.ath_change_percentage != null ? md.ath_change_percentage.toFixed(1) + '%' : ''}</span></div>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;font-size:12px">
            <div><span style="color:var(--text-secondary)">Circulating:</span> ${md.circulating_supply ? formatLargeNumber(md.circulating_supply) : '—'}</div>
            <div><span style="color:var(--text-secondary)">Total:</span> ${md.total_supply ? formatLargeNumber(md.total_supply) : '—'}</div>
            <div><span style="color:var(--text-secondary)">Max:</span> ${md.max_supply ? formatLargeNumber(md.max_supply) : '—'}</div>
        </div>

        ${signal && signal.layers ? `
        <div style="margin-bottom:16px">
            <div style="font-size:12px;font-weight:600;margin-bottom:8px">${t('th-layers')}</div>
            <div style="font-size:12px">${renderLayerBreakdown(signal.layers)}</div>
            ${signal.score != null ? `<div style="margin-top:6px;font-size:12px;color:var(--text-secondary)">${t('th-score')}: ${signal.score.toFixed(3)} &middot; ${translateConfidence(signal.confidence)}</div>` : ''}
        </div>` : ''}

        ${detail.description ? `
        <div style="font-size:12px;color:var(--text-secondary);line-height:1.5;border-top:1px solid var(--border);padding-top:12px">
            ${detail.description.replace(/<[^>]*>/g, '').slice(0, 300)}${detail.description.length > 300 ? '...' : ''}
        </div>` : ''}

        ${detail.links?.homepage || detail.links?.blockchain_site ? `
        <div style="margin-top:12px;display:flex;gap:8px;font-size:11px">
            ${detail.links.homepage ? `<a href="${escapeHtml(detail.links.homepage)}" target="_blank" rel="noopener" style="color:var(--accent-blue);text-decoration:none">Website</a>` : ''}
            ${detail.links.blockchain_site ? `<a href="${escapeHtml(detail.links.blockchain_site)}" target="_blank" rel="noopener" style="color:var(--accent-blue);text-decoration:none">Explorer</a>` : ''}
        </div>` : ''}
    `;
}

function closeModal() {
    const modal = document.getElementById('coin-modal');
    if (modal) modal.style.display = 'none';
}

// Close modal on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// ─── Export ───
function exportCoins(format) {
    if (!allCoins.length) return;
    const data = allCoins.map(c => ({
        rank: c.market_cap_rank,
        name: c.name,
        symbol: c.symbol.toUpperCase(),
        price: c.current_price,
        change_1h: c.price_change_percentage_1h_in_currency,
        change_24h: c.price_change_percentage_24h_in_currency || c.price_change_percentage_24h,
        change_7d: c.price_change_percentage_7d_in_currency,
        volume: c.total_volume,
        market_cap: c.market_cap,
    }));

    let blob, filename;
    if (format === 'csv') {
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(r => Object.values(r).join(','));
        blob = new Blob([headers + '\n' + rows.join('\n')], { type: 'text/csv' });
        filename = `bedavafinans_coins_${new Date().toISOString().slice(0,10)}.csv`;
    } else {
        blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        filename = `bedavafinans_coins_${new Date().toISOString().slice(0,10)}.json`;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    showToast(`${format.toUpperCase()} exported`, 'success');
}

// ─── Price Alerts ───
function savePriceAlerts() {
    localStorage.setItem('bedavafinans-alerts', JSON.stringify(priceAlerts));
}

function addPriceAlert(coinId, coinName, symbol, targetPrice, direction) {
    priceAlerts.push({ coinId, coinName, symbol, targetPrice, direction, triggered: false });
    savePriceAlerts();
    showToast(`${symbol} ${direction === 'above' ? '>' : '<'} ${formatCurrency(targetPrice)}`, 'info');
}

function removePriceAlert(index) {
    priceAlerts.splice(index, 1);
    savePriceAlerts();
}

function checkPriceAlerts() {
    if (!allCoins.length || !priceAlerts.length) return;
    let changed = false;
    priceAlerts.forEach((alert) => {
        if (alert.triggered) return;
        const coin = allCoins.find(c => c.id === alert.coinId);
        if (!coin) return;
        const price = coin.current_price;
        const hit = (alert.direction === 'above' && price >= alert.targetPrice) ||
                    (alert.direction === 'below' && price <= alert.targetPrice);
        if (hit) {
            alert.triggered = true;
            changed = true;
            const msg = `${alert.symbol.toUpperCase()} ${formatCurrency(price)} - ${alert.direction === 'above' ? '>' : '<'} ${formatCurrency(alert.targetPrice)}`;
            showToast(msg, 'success');
            if (Notification.permission === 'granted') {
                new Notification('BedavaFinans', { body: msg, icon: '/static/icons/icon-192.svg' });
            }
        }
    });
    if (changed) savePriceAlerts();
}

function promptPriceAlert(coinId, event) {
    if (event) event.stopPropagation();
    const coin = allCoins.find(c => c.id === coinId);
    if (!coin) return;

    const price = prompt(`${coin.name} (${formatCurrency(coin.current_price)})\n${t('alert-prompt')}`, coin.current_price.toFixed(2));
    if (!price || isNaN(parseFloat(price))) return;

    const target = parseFloat(price);
    const direction = target > coin.current_price ? 'above' : 'below';
    addPriceAlert(coinId, coin.name, coin.symbol, target, direction);

    // Request notification permission
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// ─── Helpers ───
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}
