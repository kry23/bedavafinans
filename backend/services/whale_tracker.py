"""Whale activity tracker using blockchain.info latest blocks."""

import httpx

from config import CACHE_TTL_WHALES
from backend.cache.memory_cache import cache

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=30.0)
    return _client


async def fetch_whale_transactions() -> list[dict] | None:
    """Fetch recent large Bitcoin transactions (>50 BTC) from blockchain.info."""

    async def _fetch():
        client = _get_client()
        try:
            # Get latest block hash
            resp = await client.get("https://blockchain.info/q/latesthash")
            resp.raise_for_status()
            latest_hash = resp.text.strip()

            # Get block data with transactions
            resp2 = await client.get(
                f"https://blockchain.info/rawblock/{latest_hash}",
                params={"cors": "true"},
            )
            resp2.raise_for_status()
            block = resp2.json()

            results = []
            for tx in block.get("tx", []):
                total_out = sum(o.get("value", 0) for o in tx.get("out", []))
                value_btc = total_out / 1e8
                if value_btc >= 50:
                    results.append({
                        "hash": tx.get("hash", "")[:16] + "...",
                        "value_btc": round(value_btc, 2),
                        "value_usd": None,
                        "time": tx.get("time", ""),
                        "block_id": block.get("height"),
                    })

            # Sort by value descending, take top 10
            results.sort(key=lambda x: -x["value_btc"])
            return results[:10] if results else _get_fallback_whale_data()
        except Exception:
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
