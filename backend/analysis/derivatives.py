"""Derivatives market analysis - funding rates, OI, long/short ratios."""


def analyze_funding_rate(rate: float | None) -> dict:
    """Analyze funding rate for signal implications."""
    if rate is None:
        return {"signal": "neutral", "description": "No data", "value": None}

    pct = rate * 100
    if rate > 0.001:
        signal = "bearish"
        desc = f"High positive funding ({pct:.4f}%) - overcrowded longs"
    elif rate > 0.0005:
        signal = "slightly_bearish"
        desc = f"Elevated funding ({pct:.4f}%) - more longs"
    elif rate < -0.001:
        signal = "bullish"
        desc = f"Negative funding ({pct:.4f}%) - overcrowded shorts"
    elif rate < -0.0005:
        signal = "slightly_bullish"
        desc = f"Slightly negative funding ({pct:.4f}%)"
    else:
        signal = "neutral"
        desc = f"Normal funding ({pct:.4f}%)"

    return {"signal": signal, "description": desc, "value": round(pct, 4)}


def analyze_long_short_ratio(ratio: float | None) -> dict:
    """Analyze long/short ratio for market positioning."""
    if ratio is None:
        return {"signal": "neutral", "description": "No data", "value": None}

    if ratio > 2.0:
        signal = "bearish"
        desc = f"Extremely long-heavy ({ratio:.2f}) - potential squeeze down"
    elif ratio > 1.5:
        signal = "slightly_bearish"
        desc = f"Long-heavy ({ratio:.2f})"
    elif ratio < 0.5:
        signal = "bullish"
        desc = f"Extremely short-heavy ({ratio:.2f}) - potential squeeze up"
    elif ratio < 0.7:
        signal = "slightly_bullish"
        desc = f"Short-heavy ({ratio:.2f})"
    else:
        signal = "neutral"
        desc = f"Balanced ({ratio:.2f})"

    return {"signal": signal, "description": desc, "value": round(ratio, 2)}


def get_derivatives_summary(derivatives_data: list[dict]) -> list[dict]:
    """Create a summary of derivatives data for all tracked coins."""
    summaries = []
    for d in derivatives_data:
        funding_analysis = analyze_funding_rate(d.get("funding_rate"))
        ls_analysis = analyze_long_short_ratio(d.get("long_short_ratio"))

        summaries.append({
            "coin_id": d.get("coin_id"),
            "symbol": d.get("symbol"),
            "funding_rate": funding_analysis,
            "long_short_ratio": ls_analysis,
            "open_interest": d.get("open_interest"),
        })

    return summaries
