"""Multi-layer composite signal generator."""

from config import (
    WEIGHT_TECHNICAL,
    WEIGHT_VOLUME,
    WEIGHT_SENTIMENT,
    WEIGHT_DERIVATIVES,
)


def _score_rsi(rsi: dict) -> float:
    """Score RSI from -1 to 1."""
    val = rsi.get("value")
    if val is None:
        return 0.0
    if val <= 20:
        return 1.0
    elif val <= 30:
        return 0.5
    elif val >= 80:
        return -1.0
    elif val >= 70:
        return -0.5
    elif 40 <= val <= 60:
        return 0.0
    elif val < 40:
        return 0.25
    else:
        return -0.25


def _score_macd(macd: dict) -> float:
    """Score MACD from -1 to 1."""
    crossover = macd.get("crossover", "neutral")
    histogram = macd.get("histogram")

    if crossover == "bullish":
        return 1.0
    elif crossover == "bearish":
        return -1.0

    if histogram is not None:
        if histogram > 0:
            return 0.3
        elif histogram < 0:
            return -0.3

    return 0.0


def _score_bollinger(bb: dict) -> float:
    """Score Bollinger Bands %B from -1 to 1."""
    pct_b = bb.get("percent_b")
    if pct_b is None:
        return 0.0
    if pct_b < -0.05:
        return 1.0  # Below lower band
    elif pct_b < 0.05:
        return 0.5
    elif pct_b > 1.05:
        return -1.0  # Above upper band
    elif pct_b > 0.95:
        return -0.5
    return 0.0


def _score_ema(ema: dict) -> float:
    """Score EMA crossover from -1 to 1."""
    crossover = ema.get("crossover", "neutral")
    if crossover == "bullish":
        return 1.0
    elif crossover == "bearish":
        return -1.0

    short_val = ema.get("ema_short")
    long_val = ema.get("ema_long")
    if short_val and long_val:
        if short_val > long_val:
            return 0.3
        elif short_val < long_val:
            return -0.3
    return 0.0


def compute_technical_score(indicators: dict) -> float:
    """Compute technical analysis score (Layer 1). Returns -1 to 1."""
    scores = []

    rsi = indicators.get("rsi", {})
    scores.append(_score_rsi(rsi))

    stoch = indicators.get("stoch_rsi", {})
    if stoch.get("k") is not None:
        if stoch["k"] <= 20:
            scores.append(0.7)
        elif stoch["k"] >= 80:
            scores.append(-0.7)
        else:
            scores.append(0.0)

    macd = indicators.get("macd", {})
    scores.append(_score_macd(macd))

    bb = indicators.get("bollinger_bands", {})
    scores.append(_score_bollinger(bb))

    ema = indicators.get("ema_crossover", {})
    scores.append(_score_ema(ema))

    return sum(scores) / len(scores) if scores else 0.0


def compute_volume_score(indicators: dict, volume_anomaly: dict | None = None) -> float:
    """Compute volume & momentum score (Layer 2). Returns -1 to 1."""
    scores = []

    obv = indicators.get("obv", {})
    trend = obv.get("trend", "neutral")
    trend_scores = {
        "bullish": 0.8,
        "slightly_bullish": 0.3,
        "neutral": 0.0,
        "slightly_bearish": -0.3,
        "bearish": -0.8,
    }
    scores.append(trend_scores.get(trend, 0.0))

    if volume_anomaly and volume_anomaly.get("is_anomaly"):
        # Volume anomaly is direction-neutral, adds magnitude
        scores.append(0.2)

    return sum(scores) / len(scores) if scores else 0.0


def compute_sentiment_score(fear_greed: dict | None = None, news_sentiment: dict | None = None) -> float:
    """Compute sentiment score (Layer 3). Returns -1 to 1."""
    scores = []

    if fear_greed:
        fg_value = fear_greed.get("value", 50)
        # Fear (0-25) = buy signal, Greed (75-100) = sell signal
        if fg_value <= 15:
            scores.append(1.0)   # Extreme fear → strong buy
        elif fg_value <= 25:
            scores.append(0.5)   # Fear → buy
        elif fg_value >= 85:
            scores.append(-1.0)  # Extreme greed → strong sell
        elif fg_value >= 75:
            scores.append(-0.5)  # Greed → sell
        else:
            scores.append(0.0)

    if news_sentiment:
        news_score = news_sentiment.get("score", 0.0)
        scores.append(max(-1.0, min(1.0, news_score * 3)))  # Amplify

    return sum(scores) / len(scores) if scores else 0.0


def compute_derivatives_score(derivatives: dict | None = None) -> float:
    """Compute derivatives score (Layer 4). Returns -1 to 1."""
    if not derivatives:
        return 0.0

    scores = []

    # Funding rate: very positive = overcrowded longs (sell signal)
    funding = derivatives.get("funding_rate")
    if funding is not None:
        if funding > 0.001:      # >0.1% → very high
            scores.append(-0.8)
        elif funding > 0.0005:
            scores.append(-0.3)
        elif funding < -0.001:
            scores.append(0.8)
        elif funding < -0.0005:
            scores.append(0.3)
        else:
            scores.append(0.0)

    # Long/Short ratio
    ls_ratio = derivatives.get("long_short_ratio")
    if ls_ratio is not None:
        if ls_ratio > 2.0:        # Overcrowded longs
            scores.append(-0.5)
        elif ls_ratio > 1.5:
            scores.append(-0.2)
        elif ls_ratio < 0.5:      # Overcrowded shorts
            scores.append(0.5)
        elif ls_ratio < 0.7:
            scores.append(0.2)
        else:
            scores.append(0.0)

    return sum(scores) / len(scores) if scores else 0.0


def generate_composite_signal(
    indicators: dict,
    volume_anomaly: dict | None = None,
    fear_greed: dict | None = None,
    news_sentiment: dict | None = None,
    derivatives: dict | None = None,
) -> dict:
    """Generate final composite signal combining all 4 layers."""
    tech_score = compute_technical_score(indicators)
    vol_score = compute_volume_score(indicators, volume_anomaly)
    sent_score = compute_sentiment_score(fear_greed, news_sentiment)
    deriv_score = compute_derivatives_score(derivatives)

    composite = (
        tech_score * WEIGHT_TECHNICAL
        + vol_score * WEIGHT_VOLUME
        + sent_score * WEIGHT_SENTIMENT
        + deriv_score * WEIGHT_DERIVATIVES
    )
    composite = max(-1.0, min(1.0, composite))

    if composite >= 0.5:
        signal, color = "STRONG BUY", "#10b981"
    elif composite >= 0.2:
        signal, color = "BUY", "#34d399"
    elif composite <= -0.5:
        signal, color = "STRONG SELL", "#ef4444"
    elif composite <= -0.2:
        signal, color = "SELL", "#f97316"
    else:
        signal, color = "NEUTRAL", "#6b7280"

    confidence = abs(composite)
    if confidence >= 0.5:
        confidence_label = "High"
    elif confidence >= 0.2:
        confidence_label = "Medium"
    else:
        confidence_label = "Low"

    return {
        "signal": signal,
        "score": round(composite, 3),
        "color": color,
        "confidence": confidence_label,
        "layers": {
            "technical": round(tech_score, 3),
            "volume": round(vol_score, 3),
            "sentiment": round(sent_score, 3),
            "derivatives": round(deriv_score, 3),
        },
    }
