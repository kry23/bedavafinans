"""Funding rate arbitrage service using Binance Futures API."""

import httpx

from config import BINANCE_BASE_URL, BINANCE_FUTURES_URL, CACHE_TTL_ARBITRAGE
from backend.cache.memory_cache import cache

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=30.0)
    return _client


async def fetch_arbitrage_data() -> list[dict] | None:
    """Fetch funding rate arbitrage opportunities from Binance.

    Uses premiumIndex for funding rates + mark prices,
    spot ticker for spot prices, and openInterest for OI data.
    Returns sorted by absolute APR descending.
    """

    async def _fetch():
        client = _get_client()

        # 1) Get all futures premium index data (funding rates + mark/index prices)
        resp = await client.get(f"{BINANCE_FUTURES_URL}/fapi/v1/premiumIndex")
        resp.raise_for_status()
        premium_data = resp.json()

        # 2) Get all spot prices
        resp2 = await client.get(f"{BINANCE_BASE_URL}/ticker/price")
        resp2.raise_for_status()
        spot_prices = {item["symbol"]: float(item["price"]) for item in resp2.json()}

        # Filter to USDT perpetual pairs only
        usdt_perps = [
            p for p in premium_data
            if p["symbol"].endswith("USDT") and "DEFI" not in p["symbol"]
        ]

        results = []
        for p in usdt_perps:
            symbol = p["symbol"]  # e.g. "BTCUSDT"
            base = symbol.replace("USDT", "")

            funding_rate = float(p.get("lastFundingRate", 0))
            mark_price = float(p.get("markPrice", 0))
            index_price = float(p.get("indexPrice", 0))
            next_funding = p.get("nextFundingTime", 0)

            if mark_price == 0:
                continue

            spot_price = spot_prices.get(symbol, index_price)
            if spot_price == 0:
                spot_price = index_price

            # APR = funding_rate * 3 (per day, 8h intervals) * 365 * 100
            apr = funding_rate * 3 * 365 * 100

            # Spread = (futures_price - spot_price) / spot_price * 100
            spread = ((mark_price - spot_price) / spot_price * 100) if spot_price else 0

            results.append({
                "symbol": base,
                "pair": symbol,
                "funding_rate": round(funding_rate * 100, 6),  # as percentage
                "apr": round(apr, 2),
                "mark_price": mark_price,
                "spot_price": spot_price,
                "spread": round(spread, 4),
                "next_funding": next_funding,
            })

        # Fetch open interest for top pairs by absolute APR
        results.sort(key=lambda x: abs(x["apr"]), reverse=True)
        top_results = results[:50]

        # Batch fetch OI for top 50
        for item in top_results:
            try:
                oi_resp = await client.get(
                    f"{BINANCE_FUTURES_URL}/fapi/v1/openInterest",
                    params={"symbol": item["pair"]},
                )
                if oi_resp.status_code == 200:
                    oi_data = oi_resp.json()
                    oi_value = float(oi_data.get("openInterest", 0))
                    item["open_interest"] = oi_value
                    item["open_interest_usd"] = round(oi_value * item["mark_price"], 0)
                else:
                    item["open_interest"] = None
                    item["open_interest_usd"] = None
            except Exception:
                item["open_interest"] = None
                item["open_interest_usd"] = None

        return top_results

    try:
        return await cache.get_or_fetch("arbitrage_data", CACHE_TTL_ARBITRAGE, _fetch)
    except Exception:
        return _get_fallback_data()


def _get_fallback_data() -> list[dict]:
    """Fallback when API is unavailable."""
    return []
