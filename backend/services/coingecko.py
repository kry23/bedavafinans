"""CoinGecko API client for market data, OHLC, and global stats."""

import httpx

from config import COINGECKO_BASE_URL, TOP_N_COINS, CACHE_TTL_MARKET_DATA, CACHE_TTL_OHLC, CACHE_TTL_GLOBAL
from backend.cache.memory_cache import cache

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=30.0)
    return _client


async def fetch_top_coins(n: int = TOP_N_COINS) -> list[dict] | None:
    """Fetch top N coins by market cap with price changes."""

    async def _fetch():
        client = _get_client()
        resp = await client.get(
            f"{COINGECKO_BASE_URL}/coins/markets",
            params={
                "vs_currency": "usd",
                "order": "market_cap_desc",
                "per_page": n,
                "page": 1,
                "sparkline": "true",
                "price_change_percentage": "1h,24h,7d",
            },
        )
        resp.raise_for_status()
        return resp.json()

    return await cache.get_or_fetch(f"markets_top{n}", CACHE_TTL_MARKET_DATA, _fetch)


async def fetch_global() -> dict | None:
    """Fetch global market data (total market cap, BTC dominance, etc.)."""

    async def _fetch():
        client = _get_client()
        resp = await client.get(f"{COINGECKO_BASE_URL}/global")
        resp.raise_for_status()
        data = resp.json()
        return data.get("data", {})

    return await cache.get_or_fetch("global_data", CACHE_TTL_GLOBAL, _fetch)


async def fetch_ohlc(coin_id: str, days: int = 14) -> list[list] | None:
    """Fetch OHLC data for a specific coin. Returns [[timestamp, O, H, L, C], ...]."""

    async def _fetch():
        client = _get_client()
        resp = await client.get(
            f"{COINGECKO_BASE_URL}/coins/{coin_id}/ohlc",
            params={"vs_currency": "usd", "days": days},
        )
        resp.raise_for_status()
        return resp.json()

    return await cache.get_or_fetch(f"ohlc_{coin_id}_{days}", CACHE_TTL_OHLC, _fetch)


async def fetch_coin_detail(coin_id: str) -> dict | None:
    """Fetch detailed coin info including description and links."""

    async def _fetch():
        client = _get_client()
        resp = await client.get(
            f"{COINGECKO_BASE_URL}/coins/{coin_id}",
            params={"localization": "false", "tickers": "false", "community_data": "false", "developer_data": "false"},
        )
        resp.raise_for_status()
        return resp.json()

    return await cache.get_or_fetch(f"detail_{coin_id}", CACHE_TTL_OHLC, _fetch)
