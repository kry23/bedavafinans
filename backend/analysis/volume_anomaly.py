"""Volume anomaly detection for unusual market activity."""

from collections import deque
import time

# Rolling history for volume baseline calculation
_volume_history: dict[str, deque] = {}
MAX_HISTORY_POINTS = 50


def record_volume(coin_id: str, volume: float):
    """Record a volume data point for baseline tracking."""
    if coin_id not in _volume_history:
        _volume_history[coin_id] = deque(maxlen=MAX_HISTORY_POINTS)
    _volume_history[coin_id].append({"volume": volume, "time": time.time()})


def detect_anomaly(coin_id: str, current_volume: float, market_cap: float) -> dict:
    """Detect if current volume is anomalous."""
    record_volume(coin_id, current_volume)

    history = _volume_history.get(coin_id, deque())

    if len(history) >= 5:
        volumes = [h["volume"] for h in history]
        mean_vol = sum(volumes) / len(volumes)
        variance = sum((v - mean_vol) ** 2 for v in volumes) / len(volumes)
        std_dev = variance ** 0.5

        if std_dev > 0:
            deviation = (current_volume - mean_vol) / std_dev
        else:
            deviation = 0.0

        is_anomaly = deviation > 2.0
        baseline = mean_vol
    else:
        # Heuristic: volume/market_cap ratio
        ratio = current_volume / market_cap if market_cap > 0 else 0
        is_anomaly = ratio > 0.15
        deviation = ratio * 10
        baseline = market_cap * 0.05  # Expected ~5% turnover

    return {
        "coin_id": coin_id,
        "current_volume": current_volume,
        "baseline_volume": round(baseline, 0),
        "deviation_multiple": round(deviation, 2),
        "is_anomaly": is_anomaly,
    }


def scan_all_anomalies(coins: list[dict]) -> list[dict]:
    """Scan all coins for volume anomalies. Returns only anomalous ones."""
    anomalies = []
    for coin in coins:
        result = detect_anomaly(
            coin_id=coin.get("id", ""),
            current_volume=coin.get("total_volume", 0),
            market_cap=coin.get("market_cap", 1),
        )
        if result["is_anomaly"]:
            result["symbol"] = coin.get("symbol", "").upper()
            result["name"] = coin.get("name", "")
            result["price_change_24h"] = coin.get("price_change_percentage_24h_in_currency", 0)
            anomalies.append(result)

    anomalies.sort(key=lambda x: x["deviation_multiple"], reverse=True)
    return anomalies
