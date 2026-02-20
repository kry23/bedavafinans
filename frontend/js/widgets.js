/* BedavaFinans Widgets - Fear & Greed Gauge, Whale Ticker, News Sentiment */

function renderFearGreedGauge(containerId, value, classification) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Map 0-100 to -90deg to 90deg
    const angle = ((value / 100) * 180) - 90;

    let color;
    if (value <= 25) color = '#ef4444';
    else if (value <= 40) color = '#f97316';
    else if (value <= 60) color = '#eab308';
    else if (value <= 75) color = '#22c55e';
    else color = '#10b981';

    container.innerHTML = `
        <div class="gauge-container">
            <div class="gauge-bg">
                <div class="gauge-needle" style="transform: rotate(${angle}deg)"></div>
            </div>
            <div class="gauge-value" style="color:${color}">${value}</div>
        </div>
        <div style="text-align:center;margin-top:28px;font-size:12px;color:${color};font-weight:600">
            ${escapeHtml(classification || '')}
        </div>
    `;
}

function renderFearGreedHistory(containerId, history) {
    const container = document.getElementById(containerId);
    if (!container || !history || history.length === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = container.clientWidth;
    canvas.height = 50;
    container.innerHTML = '';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const values = history.map(h => h.value).reverse();
    const max = 100;
    const min = 0;
    const w = canvas.width;
    const h = canvas.height;
    const step = w / (values.length - 1);

    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;

    values.forEach((v, i) => {
        const x = i * step;
        const y = h - ((v - min) / (max - min)) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill gradient
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();
}

function renderWhaleTicker(containerId, whaleData) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!whaleData || whaleData.length === 0 || whaleData[0].note) {
        container.innerHTML = `
            <div class="whale-ticker">
                <div style="padding:0 16px;color:var(--text-secondary);font-size:12px">
                    ${t('whale-loading')}
                </div>
            </div>
        `;
        return;
    }

    const items = whaleData.map(tx => {
        const btc = tx.value_btc?.toLocaleString() || '?';
        const usd = tx.value_usd ? formatCurrency(tx.value_usd) : '';
        return `<span style="margin:0 24px;font-size:12px">
            <span style="color:#f7931a">&#8383;</span>
            <strong>${btc} BTC</strong>
            ${usd ? `<span style="color:var(--text-secondary)">(${usd})</span>` : ''}
        </span>`;
    }).join('');

    container.innerHTML = `
        <div class="whale-ticker">
            <div class="whale-ticker-inner">${items}${items}</div>
        </div>
    `;
}

function renderNewsSentiment(containerId, sentimentData) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!sentimentData || !sentimentData.overall) {
        container.innerHTML = `<div style="color:var(--text-secondary);font-size:12px">${t('loading')}</div>`;
        return;
    }

    const { overall, recent_news } = sentimentData;
    const scoreColor = overall.score > 0.05 ? '#10b981' : overall.score < -0.05 ? '#ef4444' : '#6b7280';

    let html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <span style="font-size:14px;font-weight:600;color:${scoreColor}">${escapeHtml(translateSentiment(overall.label))}</span>
            <span style="font-size:11px;color:var(--text-secondary)">
                ${overall.positive} ${t('pos')} / ${overall.negative} ${t('neg')} / ${overall.neutral} ${t('neutral-sent')}
            </span>
        </div>
    `;

    if (recent_news && recent_news.length > 0) {
        html += '<div style="display:flex;flex-direction:column;gap:8px;max-height:200px;overflow-y:auto">';
        for (const article of recent_news.slice(0, 5)) {
            const sentColor = article.sentiment > 0.1 ? '#10b981' : article.sentiment < -0.1 ? '#ef4444' : '#6b7280';
            html += `
                <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener"
                   style="display:block;padding:6px 8px;border-radius:6px;background:var(--overlay-white);text-decoration:none;border-left:3px solid ${sentColor}">
                    <div style="font-size:12px;color:var(--text-primary);line-height:1.3">${escapeHtml(article.title)}</div>
                    <div style="font-size:10px;color:var(--text-secondary);margin-top:2px">${escapeHtml(article.source)}</div>
                </a>
            `;
        }
        html += '</div>';
    }

    container.innerHTML = html;
}

function renderMarketScoreRing(containerId, score, label) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let color;
    if (score >= 75) color = '#10b981';
    else if (score >= 60) color = '#34d399';
    else if (score >= 40) color = '#eab308';
    else if (score >= 25) color = '#f97316';
    else color = '#ef4444';

    const circumference = 2 * Math.PI * 28;
    const offset = circumference - (score / 100) * circumference;

    container.innerHTML = `
        <div style="position:relative;width:72px;height:72px;margin:0 auto">
            <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="5"/>
                <circle cx="36" cy="36" r="28" fill="none" stroke="${color}" stroke-width="5"
                    stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                    stroke-linecap="round" transform="rotate(-90 36 36)"
                    style="transition: stroke-dashoffset 0.8s ease"/>
            </svg>
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column">
                <span style="font-size:18px;font-weight:700;color:${color}">${Math.round(score)}</span>
            </div>
        </div>
        <div style="text-align:center;margin-top:4px;font-size:11px;color:${color};font-weight:600">${escapeHtml(label || '')}</div>
    `;
}


function renderSocialBuzz(containerId, buzzData) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!buzzData || buzzData.length === 0) {
        container.innerHTML = `<div style="color:var(--text-secondary);font-size:12px;padding:8px">${t('loading')}</div>`;
        return;
    }

    container.innerHTML = buzzData.slice(0, 15).map((item, idx) => {
        const buzzScore = item.buzz_score || 0;
        const direction = item.direction || 'up';
        const dirColor = direction === 'up' ? '#10b981' : '#ef4444';
        const dirArrow = direction === 'up' ? '\u25B2' : '\u25BC';
        const volRatio = item.volume_ratio || 0;
        const pct24h = item.price_change_24h || 0;
        const pct1h = item.price_change_1h || 0;

        // Buzz bar width (max 100%)
        const maxBuzz = buzzData[0]?.buzz_score || 1;
        const barPct = Math.min((buzzScore / maxBuzz) * 100, 100);

        // Color intensity based on buzz
        const buzzColor = buzzScore > 50 ? '#10b981' : buzzScore > 20 ? '#3b82f6' : buzzScore > 10 ? '#eab308' : '#6b7280';

        return `
            <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="selectCoin('${item.coin_id}')">
                <span style="font-size:10px;color:var(--text-secondary);width:18px;text-align:center">${idx + 1}</span>
                <div style="display:flex;align-items:center;gap:6px;width:75px;flex-shrink:0">
                    ${item.image ? `<img src="${item.image}" width="18" height="18" style="border-radius:50%" alt="" loading="lazy">` : ''}
                    <span style="font-size:12px;font-weight:600">${item.symbol}</span>
                </div>
                <div style="flex:1;position:relative;height:20px;border-radius:4px;overflow:hidden;background:var(--border)">
                    <div style="width:${barPct}%;height:100%;background:${buzzColor};opacity:0.3;border-radius:4px"></div>
                    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;padding:0 6px;font-size:10px">
                        <span style="color:${dirColor};font-weight:600">${dirArrow} ${formatPercentagePlain(pct24h)}</span>
                        <span style="color:var(--text-secondary)">${volRatio}% vol</span>
                    </div>
                </div>
                <div style="text-align:right;width:40px;flex-shrink:0">
                    <span style="font-size:12px;font-weight:700;color:${buzzColor}">${buzzScore.toFixed(0)}</span>
                </div>
            </div>
        `;
    }).join('');
}


function renderTrendingSocial(containerId, trending) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!trending || trending.length === 0) {
        container.innerHTML = `<div style="color:var(--text-secondary);font-size:12px;padding:8px">${t('no-lunarcrush')}</div>`;
        return;
    }

    container.innerHTML = trending.slice(0, 15).map((item, idx) => {
        const sentiment = item.sentiment || 0;
        const sentColor = sentiment > 60 ? '#10b981' : sentiment > 40 ? '#eab308' : '#ef4444';
        const pctChange = item.price_change_24h;
        const pctColor = pctChange > 0 ? '#10b981' : pctChange < 0 ? '#ef4444' : '#6b7280';
        const thumb = item.thumb || item.large_image || '';
        const symbol = item.symbol || '';
        const rank = item.rank;

        return `
            <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="selectCoin('${item.topic}')">
                <span style="font-size:11px;color:var(--text-secondary);width:20px;text-align:center">${idx + 1}</span>
                ${thumb ? `<img src="${thumb}" width="20" height="20" style="border-radius:50%" alt="" loading="lazy">` : ''}
                <div style="flex:1">
                    <div style="display:flex;align-items:center;gap:4px">
                        <span style="font-size:12px;font-weight:600">${escapeHtml(item.title || item.topic)}</span>
                        ${symbol ? `<span style="font-size:10px;color:var(--text-secondary)">${symbol}</span>` : ''}
                    </div>
                    <div style="display:flex;gap:10px;font-size:10px;color:var(--text-secondary);margin-top:2px">
                        ${rank ? `<span>#${rank}</span>` : ''}
                        ${pctChange != null ? `<span style="color:${pctColor}">${pctChange > 0 ? '+' : ''}${pctChange.toFixed(1)}%</span>` : ''}
                        ${item.market_cap ? `<span>MCap: ${item.market_cap}</span>` : ''}
                    </div>
                </div>
                <div style="text-align:right;flex-shrink:0">
                    <div style="font-size:9px;color:${sentColor}">${sentiment > 60 ? t('sentiment-positive') : sentiment > 40 ? t('neutral-sent') : t('sentiment-negative')}</div>
                </div>
            </div>
        `;
    }).join('');
}
