/* BedavaFinans Utility Functions */

function formatCurrency(value) {
    if (value == null) return '—';
    if (value >= 1e12) return '$' + (value / 1e12).toFixed(2) + 'T';
    if (value >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
    if (value >= 1e6) return '$' + (value / 1e6).toFixed(2) + 'M';
    if (value >= 1e3) return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    if (value >= 1) return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (value >= 0.01) return '$' + value.toFixed(4);
    return '$' + value.toFixed(6);
}

function formatLargeNumber(value) {
    if (value == null) return '—';
    if (value >= 1e12) return (value / 1e12).toFixed(2) + 'T';
    if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
    if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
    if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
    return value.toFixed(0);
}

function formatPercentage(value) {
    if (value == null) return '—';
    const sign = value >= 0 ? '+' : '';
    const cls = value > 0 ? 'text-up' : value < 0 ? 'text-down' : 'text-neutral';
    return `<span class="${cls}">${sign}${value.toFixed(2)}%</span>`;
}

function formatPercentagePlain(value) {
    if (value == null) return '—';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
}

function timeAgo(isoString) {
    if (!isoString) return '';
    const now = Date.now();
    const then = new Date(isoString).getTime();
    const diff = Math.floor((now - then) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function getSignalBadgeClass(signal) {
    const map = {
        'STRONG BUY': 'strong-buy',
        'BUY': 'buy',
        'NEUTRAL': 'neutral',
        'SELL': 'sell',
        'STRONG SELL': 'strong-sell',
        'NO DATA': 'neutral',
    };
    return map[signal] || 'neutral';
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function renderSparklineSVG(prices, isUp) {
    if (!prices || prices.length < 2) return '';
    // Downsample to ~30 points for performance
    const step = Math.max(1, Math.floor(prices.length / 30));
    const pts = prices.filter((_, i) => i % step === 0 || i === prices.length - 1);
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const range = max - min || 1;
    const w = 70, h = 24;
    const points = pts.map((v, i) => {
        const x = (i / (pts.length - 1)) * w;
        const y = h - ((v - min) / range) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const color = isUp ? '#10b981' : '#ef4444';
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
