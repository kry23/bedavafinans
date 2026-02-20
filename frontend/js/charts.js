/* BedavaFinans Chart Management - TradingView Lightweight Charts v5 */

let mainChart = null;
let mainSeries = null; // primary data series (candle, line, or area)
let volumeSeries = null;
let bbUpperSeries = null;
let bbLowerSeries = null;
let emaShortSeries = null;
let emaLongSeries = null;

let _chartType = 'candlestick'; // 'candlestick' | 'line' | 'area'
let _chartOhlcCache = null; // cached OHLC data for re-rendering on type switch
let _chartIndicators = { ema: true, bb: true, vol: true };
let _chartResizeObserver = null;

const CHART_THEMES = {
    dark: {
        layout: { background: { type: 'solid', color: '#16161e' }, textColor: '#8888a0' },
        grid: { vertLines: { color: 'rgba(42, 42, 58, 0.5)' }, horzLines: { color: 'rgba(42, 42, 58, 0.5)' } },
        rightPriceScale: { borderColor: 'rgba(42, 42, 58, 0.5)' },
        timeScale: { borderColor: 'rgba(42, 42, 58, 0.5)' },
    },
    light: {
        layout: { background: { type: 'solid', color: '#ffffff' }, textColor: '#6b7280' },
        grid: { vertLines: { color: 'rgba(0, 0, 0, 0.06)' }, horzLines: { color: 'rgba(0, 0, 0, 0.06)' } },
        rightPriceScale: { borderColor: 'rgba(0, 0, 0, 0.1)' },
        timeScale: { borderColor: 'rgba(0, 0, 0, 0.1)' },
    },
};

function initChart(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Cleanup previous
    if (_chartResizeObserver) _chartResizeObserver.disconnect();
    if (mainChart) { try { mainChart.remove(); } catch(e) {} }
    container.innerHTML = '';

    mainSeries = null;
    volumeSeries = null;
    bbUpperSeries = null;
    bbLowerSeries = null;
    emaShortSeries = null;
    emaLongSeries = null;

    const isDark = document.documentElement.classList.contains('dark');
    const theme = isDark ? CHART_THEMES.dark : CHART_THEMES.light;

    mainChart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight || 350,
        layout: {
            ...theme.layout,
            fontFamily: 'Inter, system-ui, sans-serif',
        },
        grid: theme.grid,
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
            vertLine: { color: 'rgba(59, 130, 246, 0.3)', width: 1 },
            horzLine: { color: 'rgba(59, 130, 246, 0.3)', width: 1 },
        },
        rightPriceScale: theme.rightPriceScale,
        timeScale: {
            ...theme.timeScale,
            timeVisible: true,
            secondsVisible: false,
        },
    });

    _createSeries();

    // Responsive resize
    _chartResizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
            if (mainChart) {
                const w = entry.contentRect.width;
                const h = entry.contentRect.height || 350;
                mainChart.applyOptions({ width: w, height: h });
            }
        }
    });
    _chartResizeObserver.observe(container);
}

function _createSeries() {
    if (!mainChart) return;

    const useV5 = typeof mainChart.addSeries === 'function';

    // Primary data series
    if (_chartType === 'candlestick') {
        const opts = {
            upColor: '#10b981',
            downColor: '#ef4444',
            borderUpColor: '#10b981',
            borderDownColor: '#ef4444',
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
        };
        mainSeries = useV5
            ? mainChart.addSeries(LightweightCharts.CandlestickSeries, opts)
            : mainChart.addCandlestickSeries(opts);
    } else if (_chartType === 'line') {
        const opts = {
            color: '#3b82f6',
            lineWidth: 2,
            priceLineVisible: true,
            lastValueVisible: true,
        };
        mainSeries = useV5
            ? mainChart.addSeries(LightweightCharts.LineSeries, opts)
            : mainChart.addLineSeries(opts);
    } else {
        // area
        const opts = {
            topColor: 'rgba(59, 130, 246, 0.4)',
            bottomColor: 'rgba(59, 130, 246, 0.02)',
            lineColor: '#3b82f6',
            lineWidth: 2,
            priceLineVisible: true,
            lastValueVisible: true,
        };
        mainSeries = useV5
            ? mainChart.addSeries(LightweightCharts.AreaSeries, opts)
            : mainChart.addAreaSeries(opts);
    }

    // Volume
    if (_chartIndicators.vol) {
        const volOpts = { priceFormat: { type: 'volume' }, priceScaleId: 'volume' };
        volumeSeries = useV5
            ? mainChart.addSeries(LightweightCharts.HistogramSeries, volOpts)
            : mainChart.addHistogramSeries(volOpts);
        mainChart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    } else {
        volumeSeries = null;
    }

    // Bollinger Bands
    if (_chartIndicators.bb) {
        const bbOpts = { color: 'rgba(59, 130, 246, 0.3)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false };
        bbUpperSeries = useV5
            ? mainChart.addSeries(LightweightCharts.LineSeries, bbOpts)
            : mainChart.addLineSeries(bbOpts);
        bbLowerSeries = useV5
            ? mainChart.addSeries(LightweightCharts.LineSeries, bbOpts)
            : mainChart.addLineSeries(bbOpts);
    } else {
        bbUpperSeries = null;
        bbLowerSeries = null;
    }

    // EMA
    if (_chartIndicators.ema) {
        const ema9Opts = { color: '#f97316', lineWidth: 1, priceLineVisible: false, lastValueVisible: false };
        const ema21Opts = { color: '#8b5cf6', lineWidth: 1, priceLineVisible: false, lastValueVisible: false };
        emaShortSeries = useV5
            ? mainChart.addSeries(LightweightCharts.LineSeries, ema9Opts)
            : mainChart.addLineSeries(ema9Opts);
        emaLongSeries = useV5
            ? mainChart.addSeries(LightweightCharts.LineSeries, ema21Opts)
            : mainChart.addLineSeries(ema21Opts);
    } else {
        emaShortSeries = null;
        emaLongSeries = null;
    }
}

function switchChartType(type) {
    if (type === _chartType) return;
    _chartType = type;

    // Update toolbar buttons
    document.querySelectorAll('[data-chart-type]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.chartType === type);
    });

    // Re-init and re-render with cached data
    initChart('chart-container');
    if (_chartOhlcCache) updateChartData(_chartOhlcCache);
}

function toggleChartIndicator(indicator) {
    _chartIndicators[indicator] = !_chartIndicators[indicator];

    // Update toolbar button
    const btn = document.querySelector(`[data-indicator="${indicator}"]`);
    if (btn) btn.classList.toggle('active', _chartIndicators[indicator]);

    // Re-init and re-render
    initChart('chart-container');
    if (_chartOhlcCache) updateChartData(_chartOhlcCache);
}

function updateChartData(ohlcData) {
    if (!mainSeries || !ohlcData || ohlcData.length === 0) return;

    _chartOhlcCache = ohlcData;

    if (_chartType === 'candlestick') {
        mainSeries.setData(ohlcData.map(d => ({
            time: d.time, open: d.open, high: d.high, low: d.low, close: d.close,
        })));
    } else {
        // line and area use {time, value}
        mainSeries.setData(ohlcData.map(d => ({ time: d.time, value: d.close })));
    }

    // Volume
    if (volumeSeries && ohlcData[0].volume !== undefined) {
        volumeSeries.setData(ohlcData.map(d => ({
            time: d.time,
            value: d.volume,
            color: d.close >= d.open ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
        })));
    }

    const closes = ohlcData.map(d => d.close);
    const times = ohlcData.map(d => d.time);

    // EMA
    if (emaShortSeries) {
        const ema9 = calcEMA(closes, 9);
        emaShortSeries.setData(
            ema9.map((v, i) => ({ time: times[i], value: v })).filter(d => d.value !== null)
        );
    }
    if (emaLongSeries) {
        const ema21 = calcEMA(closes, 21);
        emaLongSeries.setData(
            ema21.map((v, i) => ({ time: times[i], value: v })).filter(d => d.value !== null)
        );
    }

    // Bollinger Bands
    if (bbUpperSeries && bbLowerSeries) {
        const bb = calcBollingerBands(closes, 20, 2);
        bbUpperSeries.setData(
            bb.upper.map((v, i) => ({ time: times[i], value: v })).filter(d => d.value !== null)
        );
        bbLowerSeries.setData(
            bb.lower.map((v, i) => ({ time: times[i], value: v })).filter(d => d.value !== null)
        );
    }

    if (mainChart) mainChart.timeScale().fitContent();
}

function calcEMA(data, period) {
    const k = 2 / (period + 1);
    const result = new Array(data.length).fill(null);
    if (data.length < period) return result;

    let sum = 0;
    for (let i = 0; i < period; i++) sum += data[i];
    result[period - 1] = sum / period;

    for (let i = period; i < data.length; i++) {
        result[i] = data[i] * k + result[i - 1] * (1 - k);
    }
    return result;
}

function calcBollingerBands(data, period, stdDev) {
    const upper = new Array(data.length).fill(null);
    const lower = new Array(data.length).fill(null);

    for (let i = period - 1; i < data.length; i++) {
        const slice = data.slice(i - period + 1, i + 1);
        const mean = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
        const std = Math.sqrt(variance);
        upper[i] = mean + std * stdDev;
        lower[i] = mean - std * stdDev;
    }

    return { upper, lower };
}

function updateChartTheme(theme) {
    if (!mainChart) return;
    const t = CHART_THEMES[theme] || CHART_THEMES.dark;
    mainChart.applyOptions(t);
}
