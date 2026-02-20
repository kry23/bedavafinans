"""Technical indicator calculations using the ta library."""

import pandas as pd
import ta


def ohlc_to_dataframe(ohlc_data: list[list]) -> pd.DataFrame:
    """Convert OHLC array [[timestamp, O, H, L, C], ...] to DataFrame."""
    df = pd.DataFrame(ohlc_data, columns=["timestamp", "open", "high", "low", "close"])
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
    return df


def klines_to_dataframe(klines: list[dict]) -> pd.DataFrame:
    """Convert Binance klines [{time, open, high, low, close, volume}, ...] to DataFrame."""
    df = pd.DataFrame(klines)
    df["timestamp"] = pd.to_datetime(df["time"], unit="s")
    return df


def compute_rsi(df: pd.DataFrame, period: int = 14) -> dict:
    """Compute RSI indicator."""
    rsi = ta.momentum.RSIIndicator(close=df["close"], window=period)
    rsi_values = rsi.rsi()
    current = rsi_values.iloc[-1] if len(rsi_values) > 0 and pd.notna(rsi_values.iloc[-1]) else None

    signal = "neutral"
    if current is not None:
        if current <= 30:
            signal = "oversold"
        elif current >= 70:
            signal = "overbought"

    return {"value": round(current, 2) if current else None, "signal": signal}


def compute_stoch_rsi(df: pd.DataFrame, period: int = 14) -> dict:
    """Compute Stochastic RSI."""
    stoch = ta.momentum.StochRSIIndicator(close=df["close"], window=period)
    k = stoch.stochrsi_k().iloc[-1] if len(stoch.stochrsi_k()) > 0 else None
    d = stoch.stochrsi_d().iloc[-1] if len(stoch.stochrsi_d()) > 0 else None

    signal = "neutral"
    if k is not None and pd.notna(k):
        k_val = k * 100
        if k_val <= 20:
            signal = "oversold"
        elif k_val >= 80:
            signal = "overbought"
    else:
        k_val = None

    return {
        "k": round(k_val, 2) if k_val is not None else None,
        "d": round(d * 100, 2) if d is not None and pd.notna(d) else None,
        "signal": signal,
    }


def compute_macd(df: pd.DataFrame, fast: int = 12, slow: int = 26, signal_period: int = 9) -> dict:
    """Compute MACD indicator."""
    macd = ta.trend.MACD(close=df["close"], window_fast=fast, window_slow=slow, window_sign=signal_period)

    macd_line = macd.macd().iloc[-1] if len(macd.macd()) > 0 else None
    signal_line = macd.macd_signal().iloc[-1] if len(macd.macd_signal()) > 0 else None
    histogram = macd.macd_diff().iloc[-1] if len(macd.macd_diff()) > 0 else None

    # Detect crossover
    crossover = "neutral"
    macd_series = macd.macd()
    signal_series = macd.macd_signal()
    if len(macd_series) >= 2 and len(signal_series) >= 2:
        prev_diff = macd_series.iloc[-2] - signal_series.iloc[-2]
        curr_diff = macd_series.iloc[-1] - signal_series.iloc[-1]
        if pd.notna(prev_diff) and pd.notna(curr_diff):
            if prev_diff <= 0 and curr_diff > 0:
                crossover = "bullish"
            elif prev_diff >= 0 and curr_diff < 0:
                crossover = "bearish"

    return {
        "macd_line": round(macd_line, 4) if macd_line is not None and pd.notna(macd_line) else None,
        "signal_line": round(signal_line, 4) if signal_line is not None and pd.notna(signal_line) else None,
        "histogram": round(histogram, 4) if histogram is not None and pd.notna(histogram) else None,
        "crossover": crossover,
    }


def compute_bollinger_bands(df: pd.DataFrame, period: int = 20, std_dev: int = 2) -> dict:
    """Compute Bollinger Bands."""
    bb = ta.volatility.BollingerBands(close=df["close"], window=period, window_dev=std_dev)

    upper = bb.bollinger_hband().iloc[-1] if len(bb.bollinger_hband()) > 0 else None
    lower = bb.bollinger_lband().iloc[-1] if len(bb.bollinger_lband()) > 0 else None
    percent_b = bb.bollinger_pband().iloc[-1] if len(bb.bollinger_pband()) > 0 else None

    return {
        "upper": round(upper, 4) if upper is not None and pd.notna(upper) else None,
        "lower": round(lower, 4) if lower is not None and pd.notna(lower) else None,
        "percent_b": round(percent_b, 4) if percent_b is not None and pd.notna(percent_b) else None,
    }


def compute_ema_crossover(df: pd.DataFrame, short: int = 9, long: int = 21) -> dict:
    """Compute EMA crossover signal."""
    ema_short = ta.trend.EMAIndicator(close=df["close"], window=short).ema_indicator()
    ema_long = ta.trend.EMAIndicator(close=df["close"], window=long).ema_indicator()

    short_val = ema_short.iloc[-1] if len(ema_short) > 0 else None
    long_val = ema_long.iloc[-1] if len(ema_long) > 0 else None

    crossover = "neutral"
    if len(ema_short) >= 2 and len(ema_long) >= 2:
        prev_diff = ema_short.iloc[-2] - ema_long.iloc[-2]
        curr_diff = ema_short.iloc[-1] - ema_long.iloc[-1]
        if pd.notna(prev_diff) and pd.notna(curr_diff):
            if prev_diff <= 0 and curr_diff > 0:
                crossover = "bullish"
            elif prev_diff >= 0 and curr_diff < 0:
                crossover = "bearish"

    return {
        "ema_short": round(short_val, 4) if short_val is not None and pd.notna(short_val) else None,
        "ema_long": round(long_val, 4) if long_val is not None and pd.notna(long_val) else None,
        "crossover": crossover,
    }


def compute_obv_trend(df: pd.DataFrame) -> dict:
    """Compute On-Balance Volume trend."""
    if "volume" not in df.columns:
        return {"trend": "neutral", "value": None}

    obv = ta.volume.OnBalanceVolumeIndicator(close=df["close"], volume=df["volume"])
    obv_values = obv.on_balance_volume()

    if len(obv_values) < 5:
        return {"trend": "neutral", "value": None}

    recent_obv = obv_values.iloc[-5:]
    trend = "neutral"
    if recent_obv.is_monotonic_increasing:
        trend = "bullish"
    elif recent_obv.is_monotonic_decreasing:
        trend = "bearish"
    else:
        slope = recent_obv.iloc[-1] - recent_obv.iloc[0]
        if slope > 0:
            trend = "slightly_bullish"
        elif slope < 0:
            trend = "slightly_bearish"

    return {
        "trend": trend,
        "value": round(obv_values.iloc[-1], 2) if pd.notna(obv_values.iloc[-1]) else None,
    }


def compute_all_indicators(df: pd.DataFrame) -> dict:
    """Compute all technical indicators from OHLC data."""
    return {
        "rsi": compute_rsi(df),
        "stoch_rsi": compute_stoch_rsi(df),
        "macd": compute_macd(df),
        "bollinger_bands": compute_bollinger_bands(df),
        "ema_crossover": compute_ema_crossover(df),
        "obv": compute_obv_trend(df) if "volume" in df.columns else {"trend": "neutral", "value": None},
    }
