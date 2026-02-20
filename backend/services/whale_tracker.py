"""Whale activity tracker using Blockchair and Binance large trades."""

import httpx

from config import BLOCKCHAIR_BASE_URL, CACHE_TTL_WHALES
from backend.cache.memory_cache import cache

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=30.0)
    return _client


async def fetch_whale_transactions() -> list[dict] | None:
    """Fetch recent large Bitcoin transactions (>100 BTC) from Blockchair."""

    async def _fetch():
        client = _get_client()
        try:
            resp = await client.get(
                f"{BLOCKCHAIR_BASE_URL}/bitcoin/transactions",
                params={
                    "s": "output_total(desc)",
                    "limit": 10,
                },
            )
            resp.raise_for_status()
            raw = resp.json()
            txs = raw.get("data", [])
            results = []
            for tx in txs:
                value_btc = tx.get("output_total", 0) / 1e8
                if value_btc >= 100:
                    results.append({
                        "hash": tx.get("hash", "")[:16] + "...",
                        "value_btc": round(value_btc, 2),
                        "value_usd": None,  # Will be enriched with current price
                        "time": tx.get("time", ""),
                        "block_id": tx.get("block_id"),
                    })
            return results
        except Exception:
            # Fallback: return simulated data based on known patterns
            return _get_fallback_whale_data()

    return await cache.get_or_fetch("whale_txs", CACHE_TTL_WHALES, _fetch)


def _get_fallback_whale_data() -> list[dict]:
    """Fallback whale data when API is unavailable."""
    return [
        {
            "hash": "API limited...",
            "value_btc": 0,
            "value_usd": 0,
            "time": "",
            "block_id": None,
            "note": "Whale data temporarily unavailable",
        }
    ]


async def enrich_whale_data(whale_txs: list[dict], btc_price: float) -> list[dict]:
    """Add USD values to whale transactions."""
    for tx in whale_txs:
        if tx.get("value_btc") and tx["value_btc"] > 0:
            tx["value_usd"] = round(tx["value_btc"] * btc_price, 0)
    return whale_txs
