/* BedavaFinans Main Application */

const REFRESH_INTERVAL = 120000; // 2 minutes
let refreshTimer = null;
let autoRefreshEnabled = true;
let selectedCoin = 'bitcoin';
let allCoins = [];
let currentSignals = [];
let sortColumn = 'market_cap_rank';
let sortAsc = true;
let searchQuery = '';

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
            else stopAutoRefresh();
        });
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
    refreshTimer = setInterval(async () => {
        if (!autoRefreshEnabled) return;
        await Promise.allSettled([
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
    }, REFRESH_INTERVAL);
}

function stopAutoRefresh() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
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
}

function renderCoinTable(coins) {
    const tbody = document.getElementById('coins-tbody');
    if (!tbody) return;

    let filtered = coins;
    if (searchQuery) {
        filtered = coins.filter(c =>
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

        return `
            <tr onclick="selectCoin('${coin.id}')" style="cursor:pointer" class="${coin.id === selectedCoin ? 'selected' : ''}">
                <td style="color:var(--text-secondary)">${coin.market_cap_rank || '—'}</td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px">
                        <img src="${coin.image}" width="20" height="20" style="border-radius:50%" alt="" loading="lazy">
                        <span style="font-weight:600">${escapeHtml(coin.name)}</span>
                        <span style="color:var(--text-secondary);font-size:11px">${coin.symbol.toUpperCase()}</span>
                    </div>
                </td>
                <td style="font-weight:500">${formatCurrency(coin.current_price)}</td>
                <td>${formatPercentage(pct1h)}</td>
                <td>${formatPercentage(pct24h)}</td>
                <td>${formatPercentage(pct7d)}</td>
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

// ─── Helpers ───
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}
