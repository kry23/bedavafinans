"""Binance API client for klines, funding rates, and open interest."""

import httpx

from config import (
    BINANCE_BASE_URL,
    BINANCE_FUTURES_URL,
    BINANCE_SYMBOL_MAP,
    CACHE_TTL_OHLC,
    CACHE_TTL_DERIVATIVES,
)
from backend.cache.memory_cache import cache

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=30.0)
    return _client


def coingecko_id_to_binance(coin_id: str) -> str | None:
    """Convert CoinGecko coin ID to Binance trading symbol."""
    return BINANCE_SYMBOL_MAP.get(coin_id)


async def fetch_klines(
    symbol: str, interval: str = "4h", limit: int = 100
) -> list[dict] | None:
    """Fetch kline/candlestick data from Binance spot.
    Returns list of {time, open, high, low, close, volume}.
    """

    async def _fetch():
        client = _get_client()
        resp = await client.get(
            f"{BINANCE_BASE_URL}/klines",
            params={"symbol": f"{symbol}USDT", "interval": interval, "limit": limit},
        )
        resp.raise_for_status()
        raw = resp.json()
        return [
            {
                "time": int(k[0] / 1000),
                "open": float(k[1]),
                "high": float(k[2]),
                "low": float(k[3]),
                "close": float(k[4]),
                "volume": float(k[5]),
            }
            for k in raw
        ]

    return await cache.get_or_fetch(
        f"binance_klines_{symbol}_{interval}", CACHE_TTL_OHLC, _fetch
    )


async def fetch_funding_rates(symbol: str | None = None) -> list[dict] | None:
    """Fetch latest funding rates for futures. If no symbol, returns top coins."""

    async def _fetch():
        client = _get_client()
        params = {"limit": 30}
        if symbol:
            params["symbol"] = f"{symbol}USDT"
        resp = await client.get(
            f"{BINANCE_FUTURES_URL}/fapi/v1/fundingRate", params=params
        )
        resp.raise_for_status()
        return resp.json()

    key = f"funding_{symbol or 'all'}"
    return await cache.get_or_fetch(key, CACHE_TTL_DERIVATIVES, _fetch)


async def fetch_open_interest(symbol: str) -> dict | None:
    """Fetch open interest for a futures symbol."""

    async def _fetch():
        client = _get_client()
        resp = await client.get(
            f"{BINANCE_FUTURES_URL}/fapi/v1/openInterest",
            params={"symbol": f"{symbol}USDT"},
        )
        resp.raise_for_status()
        return resp.json()

    return await cache.get_or_fetch(
        f"oi_{symbol}", CACHE_TTL_DERIVATIVES, _fetch
    )


async def fetch_long_short_ratio(
    symbol: str, period: str = "1h"
) -> list[dict] | None:
    """Fetch global long/short account ratio."""

    async def _fetch():
        client = _get_client()
        resp = await client.get(
            f"{BINANCE_FUTURES_URL}/futures/data/globalLongShortAccountRatio",
            params={"symbol": f"{symbol}USDT", "period": period, "limit": 10},
        )
        resp.raise_for_status()
        return resp.json()

    return await cache.get_or_fetch(
        f"ls_ratio_{symbol}_{period}", CACHE_TTL_DERIVATIVES, _fetch
    )


async def fetch_top_derivatives(coin_ids: list[str]) -> list[dict]:
    """Fetch derivatives overview for a list of coins."""
    results = []
    for coin_id in coin_ids:
        symbol = coingecko_id_to_binance(coin_id)
        if not symbol:
            continue
        try:
            funding = await fetch_funding_rates(symbol)
            oi = await fetch_open_interest(symbol)
            ls = await fetch_long_short_ratio(symbol)

            latest_funding = float(funding[-1]["fundingRate"]) if funding else None
            oi_value = float(oi["openInterest"]) if oi else None
            ls_ratio = float(ls[0]["longShortRatio"]) if ls else None

            results.append({
                "coin_id": coin_id,
                "symbol": symbol,
                "funding_rate": latest_funding,
                "open_interest": oi_value,
                "long_short_ratio": ls_ratio,
            })
        except Exception:
            continue
    return results
