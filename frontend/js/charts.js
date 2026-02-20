/* BedavaFinans Chart Management - TradingView Lightweight Charts v5 */

let mainChart = null;
let candleSeries = null;
let volumeSeries = null;
let bbUpperSeries = null;
let bbLowerSeries = null;
let emaShortSeries = null;
let emaLongSeries = null;

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

    container.innerHTML = '';

    const isDark = document.documentElement.classList.contains('dark');
    const theme = isDark ? CHART_THEMES.dark : CHART_THEMES.light;

    mainChart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: 400,
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

    // Lightweight Charts v5 uses addSeries() with type parameter
    // v4 used addCandlestickSeries(), addLineSeries(), etc.
    const useV5 = typeof mainChart.addSeries === 'function';

    if (useV5) {
        candleSeries = mainChart.addSeries(LightweightCharts.CandlestickSeries, {
            upColor: '#10b981',
            downColor: '#ef4444',
            borderUpColor: '#10b981',
            borderDownColor: '#ef4444',
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
        });

        volumeSeries = mainChart.addSeries(LightweightCharts.HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });

        bbUpperSeries = mainChart.addSeries(LightweightCharts.LineSeries, {
            color: 'rgba(59, 130, 246, 0.3)',
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
        });
        bbLowerSeries = mainChart.addSeries(LightweightCharts.LineSeries, {
            color: 'rgba(59, 130, 246, 0.3)',
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
        });

        emaShortSeries = mainChart.addSeries(LightweightCharts.LineSeries, {
            color: '#f97316',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
        });
        emaLongSeries = mainChart.addSeries(LightweightCharts.LineSeries, {
            color: '#8b5cf6',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
        });
    } else {
        // Fallback for v4
        candleSeries = mainChart.addCandlestickSeries({
            upColor: '#10b981',
            downColor: '#ef4444',
            borderUpColor: '#10b981',
            borderDownColor: '#ef4444',
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
        });

        volumeSeries = mainChart.addHistogramSeries({
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });

        bbUpperSeries = mainChart.addLineSeries({
            color: 'rgba(59, 130, 246, 0.3)',
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
        });
        bbLowerSeries = mainChart.addLineSeries({
            color: 'rgba(59, 130, 246, 0.3)',
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
        });

        emaShortSeries = mainChart.addLineSeries({
            color: '#f97316',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
        });
        emaLongSeries = mainChart.addLineSeries({
            color: '#8b5cf6',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
        });
    }

    mainChart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
    });

    // Responsive
    const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
            if (mainChart) mainChart.applyOptions({ width: entry.contentRect.width });
        }
    });
    resizeObserver.observe(container);
}

function updateChartData(ohlcData) {
    if (!candleSeries || !ohlcData || ohlcData.length === 0) return;

    const candles = ohlcData.map(d => ({
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
    }));

    candleSeries.setData(candles);

    // Volume
    if (ohlcData[0].volume !== undefined && volumeSeries) {
        const volumes = ohlcData.map(d => ({
            time: d.time,
            value: d.volume,
            color: d.close >= d.open ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
        }));
        volumeSeries.setData(volumes);
    }

    // Simple BB and EMA from raw data
    const closes = ohlcData.map(d => d.close);
    const times = ohlcData.map(d => d.time);

    // EMA calculations
    const emaShort = calcEMA(closes, 9);
    const emaLong = calcEMA(closes, 21);

    if (emaShortSeries) {
        emaShortSeries.setData(
            emaShort.map((v, i) => ({ time: times[i], value: v })).filter(d => d.value !== null)
        );
    }
    if (emaLongSeries) {
        emaLongSeries.setData(
            emaLong.map((v, i) => ({ time: times[i], value: v })).filter(d => d.value !== null)
        );
    }

    // Bollinger Bands
    const bb = calcBollingerBands(closes, 20, 2);
    if (bbUpperSeries) {
        bbUpperSeries.setData(
            bb.upper.map((v, i) => ({ time: times[i], value: v })).filter(d => d.value !== null)
        );
    }
    if (bbLowerSeries) {
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
