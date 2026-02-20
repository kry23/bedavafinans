"""All API route definitions."""

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter

from config import SIGNAL_COINS_COUNT, TOP_MOVERS_COUNT, BINANCE_SYMBOL_MAP
from backend.services.coingecko import fetch_top_coins, fetch_global, fetch_ohlc
from backend.services.binance import fetch_klines, coingecko_id_to_binance, fetch_top_derivatives
from backend.services.fear_greed import fetch_fear_greed
from backend.services.whale_tracker import fetch_whale_transactions, enrich_whale_data
from backend.services.news_sentiment import fetch_crypto_news, get_overall_sentiment
from backend.analysis.indicators import ohlc_to_dataframe, klines_to_dataframe, compute_all_indicators
from backend.analysis.signals import generate_composite_signal
from backend.analysis.volume_anomaly import scan_all_anomalies
from backend.analysis.derivatives import get_derivatives_summary
from backend.analysis.market_score import compute_market_score
from backend.cache.memory_cache import cache

router = APIRouter()


@router.get("/market/overview")
async def market_overview():
    """Global market stats + Fear/Greed + market score."""
    global_data, fear_greed, news_sentiment, top_coins = await asyncio.gather(
        fetch_global(),
        fetch_fear_greed(limit=30),
        get_overall_sentiment(),
        fetch_top_coins(),
    )

    market_score = compute_market_score(
        fear_greed=fear_greed,
        global_data=global_data,
        news_sentiment=news_sentiment,
        top_coins=top_coins,
    )

    result = {
        "total_market_cap_usd": None,
        "total_volume_usd": None,
        "btc_dominance": None,
        "market_cap_change_24h": None,
        "active_cryptocurrencies": None,
        "fear_greed": fear_greed,
        "market_score": market_score,
        "news_sentiment": news_sentiment,
    }

    if global_data:
        total_mc = global_data.get("total_market_cap", {})
        total_vol = global_data.get("total_volume", {})
        result["total_market_cap_usd"] = total_mc.get("usd")
        result["total_volume_usd"] = total_vol.get("usd")
        result["btc_dominance"] = global_data.get("market_cap_percentage", {}).get("btc")
        result["market_cap_change_24h"] = global_data.get("market_cap_change_percentage_24h_usd")
        result["active_cryptocurrencies"] = global_data.get("active_cryptocurrencies")

    return result


@router.get("/market/coins")
async def market_coins():
    """Top 50 coins with prices, volumes, changes."""
    coins = await fetch_top_coins()
    return coins or []


@router.get("/market/movers")
async def market_movers():
    """Top gainers and losers by 24h change."""
    coins = await fetch_top_coins()
    if not coins:
        return {"gainers": [], "losers": []}

    sorted_coins = sorted(
        [c for c in coins if c.get("price_change_percentage_24h_in_currency") is not None
         or c.get("price_change_percentage_24h") is not None],
        key=lambda c: c.get("price_change_percentage_24h_in_currency")
        or c.get("price_change_percentage_24h")
        or 0,
        reverse=True,
    )

    gainers = sorted_coins[:TOP_MOVERS_COUNT]
    losers = sorted_coins[-TOP_MOVERS_COUNT:][::-1]

    return {"gainers": gainers, "losers": losers}


@router.get("/signals")
async def get_signals():
    """Compute signals for top N coins."""
    coins = await fetch_top_coins()
    if not coins:
        return []

    fear_greed = await fetch_fear_greed(limit=1)
    news_sentiment = await get_overall_sentiment()

    signal_coins = coins[:SIGNAL_COINS_COUNT]
    results = []
    now = datetime.now(timezone.utc).isoformat()

    for coin in signal_coins:
        coin_id = coin["id"]
        indicators = await _compute_coin_indicators(coin_id)
        if indicators is None:
            results.append({
                "coin_id": coin_id,
                "symbol": coin.get("symbol", "").upper(),
                "name": coin.get("name", ""),
                "image": coin.get("image"),
                "current_price": coin.get("current_price"),
                "price_change_24h": coin.get("price_change_percentage_24h_in_currency")
                or coin.get("price_change_percentage_24h"),
                "signal": "NO DATA",
                "score": 0,
                "color": "#6b7280",
                "confidence": "Low",
                "layers": {"technical": 0, "volume": 0, "sentiment": 0, "derivatives": 0},
                "indicators": None,
                "updated_at": now,
            })
            continue

        # Get derivatives data for this coin
        deriv_data = None
        binance_symbol = coingecko_id_to_binance(coin_id)
        if binance_symbol:
            try:
                derivs = await fetch_top_derivatives([coin_id])
                if derivs:
                    deriv_data = derivs[0]
            except Exception:
                pass

        signal = generate_composite_signal(
            indicators=indicators,
            fear_greed=fear_greed,
            news_sentiment=news_sentiment,
            derivatives=deriv_data,
        )

        results.append({
            "coin_id": coin_id,
            "symbol": coin.get("symbol", "").upper(),
            "name": coin.get("name", ""),
            "image": coin.get("image"),
            "current_price": coin.get("current_price"),
            "price_change_24h": coin.get("price_change_percentage_24h_in_currency")
            or coin.get("price_change_percentage_24h"),
            "signal": signal["signal"],
            "score": signal["score"],
            "color": signal["color"],
            "confidence": signal["confidence"],
            "layers": signal["layers"],
            "indicators": indicators,
            "updated_at": now,
        })

    return results


@router.get("/signals/{coin_id}")
async def get_coin_signal(coin_id: str):
    """Detailed signal for a specific coin."""
    coins = await fetch_top_coins()
    coin = next((c for c in (coins or []) if c["id"] == coin_id), None)

    indicators = await _compute_coin_indicators(coin_id)
    fear_greed = await fetch_fear_greed(limit=1)
    news_sentiment = await get_overall_sentiment()

    deriv_data = None
    binance_symbol = coingecko_id_to_binance(coin_id)
    if binance_symbol:
        try:
            derivs = await fetch_top_derivatives([coin_id])
            if derivs:
                deriv_data = derivs[0]
        except Exception:
            pass

    if indicators is None:
        return {
            "coin_id": coin_id,
            "signal": "NO DATA",
            "score": 0,
            "color": "#6b7280",
            "confidence": "Low",
            "layers": {},
            "indicators": None,
        }

    signal = generate_composite_signal(
        indicators=indicators,
        fear_greed=fear_greed,
        news_sentiment=news_sentiment,
        derivatives=deriv_data,
    )

    return {
        "coin_id": coin_id,
        "symbol": coin.get("symbol", "").upper() if coin else coin_id,
        "name": coin.get("name", "") if coin else coin_id,
        "image": coin.get("image") if coin else None,
        "current_price": coin.get("current_price") if coin else None,
        "price_change_24h": (coin.get("price_change_percentage_24h_in_currency")
                             or coin.get("price_change_percentage_24h")) if coin else None,
        **signal,
        "indicators": indicators,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/ohlc/{coin_id}")
async def get_ohlc(coin_id: str, days: int = 14):
    """OHLC chart data for a coin."""
    # Try Binance first for higher resolution
    binance_symbol = coingecko_id_to_binance(coin_id)
    if binance_symbol:
        klines = await fetch_klines(binance_symbol, interval="4h", limit=100)
        if klines:
            return klines

    # Fallback to CoinGecko
    ohlc = await fetch_ohlc(coin_id, days=days)
    if ohlc:
        return [
            {"time": int(candle[0] / 1000), "open": candle[1], "high": candle[2], "low": candle[3], "close": candle[4]}
            for candle in ohlc
        ]
    return []


@router.get("/volume/anomalies")
async def volume_anomalies():
    """Detect volume anomalies across top coins."""
    coins = await fetch_top_coins()
    if not coins:
        return []
    return scan_all_anomalies(coins)


@router.get("/derivatives/overview")
async def derivatives_overview():
    """Derivatives data for top coins with Binance futures."""
    top_derivative_coins = list(BINANCE_SYMBOL_MAP.keys())[:15]
    raw = await fetch_top_derivatives(top_derivative_coins)
    return get_derivatives_summary(raw)


@router.get("/whales/recent")
async def whales_recent():
    """Recent whale transactions."""
    coins = await fetch_top_coins()
    btc_price = 0
    if coins:
        btc = next((c for c in coins if c["id"] == "bitcoin"), None)
        if btc:
            btc_price = btc.get("current_price", 0)

    txs = await fetch_whale_transactions()
    if txs and btc_price:
        txs = await enrich_whale_data(txs, btc_price)
    return txs or []


@router.get("/sentiment")
async def sentiment():
    """News sentiment + Fear/Greed trend."""
    news, fg = await asyncio.gather(
        fetch_crypto_news(),
        fetch_fear_greed(limit=30),
    )
    overall = await get_overall_sentiment()

    return {
        "overall": overall,
        "fear_greed": fg,
        "recent_news": (news or [])[:10],
    }


@router.get("/health")
async def health():
    """System health and cache stats."""
    return {
        "status": "ok",
        "cache": cache.stats(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


async def _compute_coin_indicators(coin_id: str) -> dict | None:
    """Compute technical indicators for a coin, trying Binance then CoinGecko."""
    # Try Binance klines first (has volume data)
    binance_symbol = coingecko_id_to_binance(coin_id)
    if binance_symbol:
        klines = await fetch_klines(binance_symbol, interval="4h", limit=100)
        if klines and len(klines) >= 30:
            df = klines_to_dataframe(klines)
            return compute_all_indicators(df)

    # Fallback to CoinGecko OHLC (no volume)
    ohlc = await fetch_ohlc(coin_id, days=14)
    if ohlc and len(ohlc) >= 30:
        df = ohlc_to_dataframe(ohlc)
        return compute_all_indicators(df)

    return None
