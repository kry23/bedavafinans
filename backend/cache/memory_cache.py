"""In-memory TTL cache with rate-limit awareness."""

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine


@dataclass
class CacheEntry:
    data: Any
    fetched_at: float
    ttl: float

    @property
    def is_expired(self) -> bool:
        return (time.time() - self.fetched_at) > self.ttl


class MemoryCache:
    def __init__(self):
        self._store: dict[str, CacheEntry] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    def _get_lock(self, key: str) -> asyncio.Lock:
        if key not in self._locks:
            self._locks[key] = asyncio.Lock()
        return self._locks[key]

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None or entry.is_expired:
            return None
        return entry.data

    def set(self, key: str, data: Any, ttl: float):
        self._store[key] = CacheEntry(data=data, fetched_at=time.time(), ttl=ttl)

    def get_even_if_stale(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        return entry.data

    async def get_or_fetch(
        self,
        key: str,
        ttl: float,
        fetch_fn: Callable[[], Coroutine[Any, Any, Any]],
    ) -> Any | None:
        cached = self.get(key)
        if cached is not None:
            return cached

        lock = self._get_lock(key)
        async with lock:
            # Double-check after acquiring lock
            cached = self.get(key)
            if cached is not None:
                return cached

            try:
                data = await fetch_fn()
                if data is not None:
                    self.set(key, data, ttl)
                return data
            except Exception:
                # Return stale data if available
                return self.get_even_if_stale(key)

    def clear(self):
        self._store.clear()

    def stats(self) -> dict:
        now = time.time()
        total = len(self._store)
        fresh = sum(1 for e in self._store.values() if not e.is_expired)
        return {
            "total_entries": total,
            "fresh_entries": fresh,
            "stale_entries": total - fresh,
        }


# Global cache instance
cache = MemoryCache()
