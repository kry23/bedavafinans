"""Overall market health score calculator (0-100)."""


def compute_market_score(
    fear_greed: dict | None = None,
    global_data: dict | None = None,
    news_sentiment: dict | None = None,
    top_coins: list[dict] | None = None,
) -> dict:
    """Compute a composite market health score (0-100).

    Components:
    - Fear & Greed Index (30%)
    - Market cap trend (20%)
    - Price momentum of top coins (30%)
    - News sentiment (20%)
    """
    scores = {}

    # Fear & Greed (already 0-100)
    if fear_greed:
        scores["fear_greed"] = fear_greed.get("value", 50)
    else:
        scores["fear_greed"] = 50

    # Market cap 24h change → map to 0-100
    if global_data:
        mc_change = global_data.get("market_cap_change_percentage_24h_usd", 0)
        # -10% → 0, 0% → 50, +10% → 100
        scores["market_trend"] = max(0, min(100, 50 + mc_change * 5))
    else:
        scores["market_trend"] = 50

    # Price momentum: % of top coins that are green in 24h
    if top_coins:
        green_count = sum(
            1 for c in top_coins
            if (c.get("price_change_percentage_24h_in_currency") or c.get("price_change_percentage_24h") or 0) > 0
        )
        scores["momentum"] = (green_count / len(top_coins)) * 100 if top_coins else 50
    else:
        scores["momentum"] = 50

    # News sentiment: map -1..1 to 0..100
    if news_sentiment:
        ns = news_sentiment.get("score", 0)
        scores["news"] = max(0, min(100, 50 + ns * 50))
    else:
        scores["news"] = 50

    # Weighted composite
    composite = (
        scores["fear_greed"] * 0.30
        + scores["market_trend"] * 0.20
        + scores["momentum"] * 0.30
        + scores["news"] * 0.20
    )

    if composite >= 75:
        label = "Very Bullish"
    elif composite >= 60:
        label = "Bullish"
    elif composite >= 40:
        label = "Neutral"
    elif composite >= 25:
        label = "Bearish"
    else:
        label = "Very Bearish"

    return {
        "score": round(composite, 1),
        "label": label,
        "components": {k: round(v, 1) for k, v in scores.items()},
    }
