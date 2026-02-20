"""Alternative.me Fear & Greed Index client."""

import httpx

from config import ALTERNATIVE_ME_URL, CACHE_TTL_FEAR_GREED
from backend.cache.memory_cache import cache

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=30.0)
    return _client


async def fetch_fear_greed(limit: int = 30) -> dict | None:
    """Fetch Fear & Greed index with history.
    Returns {current: {value, classification}, history: [{value, classification, timestamp}, ...]}.
    """

    async def _fetch():
        client = _get_client()
        resp = await client.get(
            ALTERNATIVE_ME_URL, params={"limit": limit, "format": "json"}
        )
        resp.raise_for_status()
        raw = resp.json()
        entries = raw.get("data", [])
        if not entries:
            return None

        current = entries[0]
        return {
            "value": int(current["value"]),
            "classification": current["value_classification"],
            "timestamp": current["timestamp"],
            "history": [
                {
                    "value": int(e["value"]),
                    "classification": e["value_classification"],
                    "timestamp": e["timestamp"],
                }
                for e in entries
            ],
        }

    return await cache.get_or_fetch("fear_greed", CACHE_TTL_FEAR_GREED, _fetch)
