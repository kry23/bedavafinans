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
