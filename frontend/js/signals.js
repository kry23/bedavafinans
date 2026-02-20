/* BedavaFinans Signal Rendering */

function renderSignalBadge(signal, displayText) {
    const cls = getSignalBadgeClass(signal);
    const text = displayText || signal;
    return `<span class="signal-badge ${cls}">${escapeHtml(text)}</span>`;
}

function renderConfidenceDot(confidence, displayText) {
    const colors = {
        'High': '#10b981',
        'Medium': '#eab308',
        'Low': '#6b7280',
    };
    const color = colors[confidence] || colors['Low'];
    const label = displayText || confidence;
    return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}" title="${label}"></span>`;
}

function renderScoreBar(score) {
    // score is -1 to 1, map to 0-100
    const pct = ((score + 1) / 2) * 100;
    let color;
    if (score >= 0.3) color = '#10b981';
    else if (score >= 0.1) color = '#34d399';
    else if (score <= -0.3) color = '#ef4444';
    else if (score <= -0.1) color = '#f97316';
    else color = '#6b7280';

    return `
        <div class="score-bar" style="width:60px;">
            <div class="score-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
    `;
}

function renderLayerBreakdown(layers) {
    if (!layers) return '';
    const items = [
        { label: 'Tech', value: layers.technical, weight: '40%' },
        { label: 'Vol', value: layers.volume, weight: '25%' },
        { label: 'Sent', value: layers.sentiment, weight: '20%' },
        { label: 'Deriv', value: layers.derivatives, weight: '15%' },
    ];
    return items.map(item => {
        const val = item.value != null ? item.value.toFixed(2) : '—';
        const color = item.value > 0.1 ? '#10b981' : item.value < -0.1 ? '#ef4444' : '#6b7280';
        return `<span style="color:${color};font-size:11px;" title="${item.label} (${item.weight})">${item.label}:${val}</span>`;
    }).join(' ');
}

function renderIndicatorPill(name, value, signal) {
    if (value == null) return '';
    const colors = {
        'oversold': '#10b981',
        'overbought': '#ef4444',
        'bullish': '#10b981',
        'bearish': '#ef4444',
        'neutral': '#6b7280',
        'slightly_bullish': '#34d399',
        'slightly_bearish': '#f97316',
    };
    const color = colors[signal] || '#6b7280';
    return `<span style="font-size:11px;padding:2px 6px;border-radius:4px;background:${color}20;color:${color}">${name} ${typeof value === 'number' ? value.toFixed(1) : value}</span>`;
}
