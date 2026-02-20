/* BedavaFinans API Client */

const API_BASE = '/api';

async function fetchJSON(path) {
    try {
        const res = await fetch(`${API_BASE}${path}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error(`[API] ${path} failed:`, err);
        return null;
    }
}

async function getMarketOverview() {
    return await fetchJSON('/market/overview');
}

async function getCoins() {
    return await fetchJSON('/market/coins');
}

async function getMovers() {
    return await fetchJSON('/market/movers');
}

async function getSignals() {
    return await fetchJSON('/signals');
}

async function getCoinSignal(coinId) {
    return await fetchJSON(`/signals/${coinId}`);
}

async function getOHLC(coinId) {
    return await fetchJSON(`/ohlc/${coinId}`);
}

async function getVolumeAnomalies() {
    return await fetchJSON('/volume/anomalies');
}

async function getDerivatives() {
    return await fetchJSON('/derivatives/overview');
}

async function getWhales() {
    return await fetchJSON('/whales/recent');
}

async function getSentiment() {
    return await fetchJSON('/sentiment');
}

async function getCoinDetail(coinId) {
    return await fetchJSON(`/coin/${coinId}`);
}
