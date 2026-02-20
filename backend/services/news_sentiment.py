"""CryptoCompare news client with simple keyword-based sentiment analysis."""

import httpx

from config import CRYPTOCOMPARE_BASE_URL, CACHE_TTL_NEWS, POSITIVE_KEYWORDS, NEGATIVE_KEYWORDS
from backend.cache.memory_cache import cache

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=30.0)
    return _client


def _analyze_text_sentiment(text: str) -> float:
    """Simple keyword-based sentiment score. Returns -1.0 to 1.0."""
    text_lower = text.lower()
    pos_count = sum(1 for kw in POSITIVE_KEYWORDS if kw in text_lower)
    neg_count = sum(1 for kw in NEGATIVE_KEYWORDS if kw in text_lower)
    total = pos_count + neg_count
    if total == 0:
        return 0.0
    return (pos_count - neg_count) / total


async def fetch_crypto_news(categories: str = "BTC,ETH,Trading") -> list[dict] | None:
    """Fetch latest crypto news from CryptoCompare."""

    async def _fetch():
        client = _get_client()
        resp = await client.get(
            f"{CRYPTOCOMPARE_BASE_URL}/data/v2/news/",
            params={"categories": categories, "lang": "EN"},
        )
        resp.raise_for_status()
        raw = resp.json()
        articles = raw.get("Data", [])[:20]

        results = []
        for article in articles:
            title = article.get("title", "")
            body = article.get("body", "")
            sentiment = _analyze_text_sentiment(f"{title} {body}")

            results.append({
                "title": title,
                "url": article.get("url", ""),
                "source": article.get("source", ""),
                "published_on": article.get("published_on", 0),
                "sentiment": round(sentiment, 3),
                "image": article.get("imageurl", ""),
            })
        return results

    return await cache.get_or_fetch("crypto_news", CACHE_TTL_NEWS, _fetch)


async def get_overall_sentiment() -> dict:
    """Calculate overall market sentiment from recent news."""
    news = await fetch_crypto_news()
    if not news:
        return {"score": 0.0, "label": "Neutral", "article_count": 0, "positive": 0, "negative": 0, "neutral": 0}

    scores = [a["sentiment"] for a in news]
    avg_score = sum(scores) / len(scores)

    positive = sum(1 for s in scores if s > 0.1)
    negative = sum(1 for s in scores if s < -0.1)
    neutral = len(scores) - positive - negative

    if avg_score > 0.2:
        label = "Bullish"
    elif avg_score > 0.05:
        label = "Slightly Bullish"
    elif avg_score < -0.2:
        label = "Bearish"
    elif avg_score < -0.05:
        label = "Slightly Bearish"
    else:
        label = "Neutral"

    return {
        "score": round(avg_score, 3),
        "label": label,
        "article_count": len(news),
        "positive": positive,
        "negative": negative,
        "neutral": neutral,
    }
