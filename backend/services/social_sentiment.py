"""Social & market buzz aggregator - Market buzz from existing data + LunarCrush trending."""

import httpx

from config import (
    CACHE_TTL_SOCIAL,
    LUNARCRUSH_API_KEY,
    LUNARCRUSH_TOPIC_MAP,
    SOCIAL_TRENDING_COUNT,
)
from backend.cache.memory_cache import cache
from backend.services.coingecko import fetch_top_coins

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=30.0)
    return _client


# ──────────────────────────────────────────────
# Market Buzz (from existing market data)
# ──────────────────────────────────────────────

async def compute_market_buzz() -> list[dict]:
    """Compute market buzz scores from volume and price momentum data.

    Coins with unusual volume, large price movements, and high activity
    get higher buzz scores - indicating market attention/interest.
    """

    # Stablecoins to exclude from buzz ranking
    stablecoins = {"tether", "usd-coin", "dai", "true-usd", "first-digital-usd",
                    "binance-peg-busd", "usdd", "pax-dollar", "frax", "paypal-usd",
                    "ethena-usde", "usual-usd", "usd1-wlfi", "tether-gold", "pax-gold",
                    "staked-ether", "wrapped-bitcoin", "wrapped-steth", "wrapped-eeth"}

    async def _fetch():
        coins = await fetch_top_coins()
        if not coins:
            return []

        results = []
        for coin in coins[:50]:
            # Skip stablecoins
            if coin["id"] in stablecoins:
                continue
            pct_1h = abs(coin.get("price_change_percentage_1h_in_currency") or 0)
            pct_24h = abs(coin.get("price_change_percentage_24h_in_currency")
                         or coin.get("price_change_percentage_24h") or 0)
            pct_7d = abs(coin.get("price_change_percentage_7d_in_currency") or 0)
            volume = coin.get("total_volume") or 0
            market_cap = coin.get("market_cap") or 1

            # Volume to market cap ratio (higher = more trading activity)
            vol_ratio = volume / market_cap if market_cap > 0 else 0

            # Buzz score: combines price volatility + volume intensity
            # More volatile + high volume = people are paying attention
            buzz = (
                (pct_1h * 10)        # short-term momentum (amplified)
                + (pct_24h * 3)      # daily momentum
                + (pct_7d * 1)       # weekly trend
                + (vol_ratio * 500)  # volume relative to market cap
            )

            # Direction: positive = upward buzz, negative = downward
            raw_24h = (coin.get("price_change_percentage_24h_in_currency")
                       or coin.get("price_change_percentage_24h") or 0)
            direction = "up" if raw_24h >= 0 else "down"

            results.append({
                "coin_id": coin["id"],
                "name": coin.get("name", ""),
                "symbol": coin.get("symbol", "").upper(),
                "image": coin.get("image"),
                "buzz_score": round(buzz, 1),
                "direction": direction,
                "price_change_1h": coin.get("price_change_percentage_1h_in_currency"),
                "price_change_24h": raw_24h,
                "price_change_7d": coin.get("price_change_percentage_7d_in_currency"),
                "volume_ratio": round(vol_ratio * 100, 2),  # as percentage
                "current_price": coin.get("current_price"),
            })

        # Sort by buzz score descending
        results.sort(key=lambda x: x["buzz_score"], reverse=True)
        return results

    return await cache.get_or_fetch("market_buzz", CACHE_TTL_SOCIAL, _fetch)


# ──────────────────────────────────────────────
# Trending (CoinGecko free + LunarCrush fallback)
# ──────────────────────────────────────────────

async def fetch_trending() -> list[dict] | None:
    """Fetch trending coins from CoinGecko (free, no API key needed)."""

    async def _fetch():
        client = _get_client()
        try:
            resp = await client.get(
                "https://api.coingecko.com/api/v3/search/trending",
            )
            resp.raise_for_status()
            raw = resp.json()
            coins = raw.get("coins", [])

            results = []
            for entry in coins:
                item = entry.get("item", {})
                price_data = item.get("data", {})
                results.append({
                    "topic": item.get("id", ""),
                    "title": item.get("name", ""),
                    "symbol": item.get("symbol", "").upper(),
                    "rank": item.get("market_cap_rank"),
                    "interactions_24h": item.get("score", 0) * 1000,
                    "posts_24h": 0,
                    "contributors_24h": 0,
                    "sentiment": 65 if (price_data.get("price_change_percentage_24h", {}).get("usd", 0) or 0) > 0 else 35,
                    "galaxy_score": item.get("score", 0),
                    "thumb": item.get("thumb"),
                    "large_image": item.get("large"),
                    "price_btc": item.get("price_btc"),
                    "price_change_24h": price_data.get("price_change_percentage_24h", {}).get("usd"),
                    "market_cap": price_data.get("market_cap"),
                    "sparkline": price_data.get("sparkline"),
                })
            return results if results else None
        except Exception:
            # Fallback to LunarCrush if available
            return await _fetch_lunarcrush_trending()

    return await cache.get_or_fetch("trending_coins", CACHE_TTL_SOCIAL, _fetch)


async def _fetch_lunarcrush_trending() -> list[dict] | None:
    """Fallback: fetch trending from LunarCrush if API key is set."""
    if not LUNARCRUSH_API_KEY:
        return None
    client = _get_client()
    try:
        resp = await client.get(
            "https://lunarcrush.com/api4/public/topics/list/v1",
            headers={"Authorization": f"Bearer {LUNARCRUSH_API_KEY}"},
        )
        resp.raise_for_status()
        raw = resp.json()
        topics = raw.get("data", [])[:SOCIAL_TRENDING_COUNT]
        return [
            {
                "topic": t.get("topic", ""),
                "title": t.get("title", t.get("topic", "")),
                "rank": t.get("rank"),
                "interactions_24h": t.get("interactions_24h"),
                "posts_24h": t.get("num_posts"),
                "contributors_24h": t.get("num_contributors"),
                "sentiment": t.get("sentiment"),
                "galaxy_score": t.get("galaxy_score"),
            }
            for t in topics
        ]
    except Exception:
        return None


# ──────────────────────────────────────────────
# Combined Social Data
# ──────────────────────────────────────────────

async def get_social_overview() -> dict:
    """Get combined social/market buzz overview."""
    trending = await fetch_trending()
    market_buzz = await compute_market_buzz()

    return {
        "trending": trending or [],
        "market_buzz": market_buzz or [],
        "has_lunarcrush": bool(trending),
    }


async def get_coin_social(coin_id: str) -> dict:
    """Get social data for a specific coin."""
    # Get buzz data for this coin
    buzz_data = await compute_market_buzz()
    coin_buzz = next((b for b in (buzz_data or []) if b["coin_id"] == coin_id), None)

    return {
        "coin_id": coin_id,
        "market_buzz": coin_buzz,
    }
