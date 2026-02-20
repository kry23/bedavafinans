"""Pydantic response models for all API endpoints."""

from pydantic import BaseModel


class CoinMarketData(BaseModel):
    id: str
    symbol: str
    name: str
    image: str | None = None
    current_price: float | None = None
    market_cap: int | None = None
    market_cap_rank: int | None = None
    total_volume: int | None = None
    price_change_percentage_1h_in_currency: float | None = None
    price_change_percentage_24h_in_currency: float | None = None
    price_change_percentage_7d_in_currency: float | None = None
    price_change_percentage_24h: float | None = None
    high_24h: float | None = None
    low_24h: float | None = None
    circulating_supply: float | None = None


class TechnicalIndicators(BaseModel):
    rsi: dict | None = None
    stoch_rsi: dict | None = None
    macd: dict | None = None
    bollinger_bands: dict | None = None
    ema_crossover: dict | None = None
    obv: dict | None = None


class SignalResponse(BaseModel):
    coin_id: str
    symbol: str
    name: str
    image: str | None = None
    current_price: float | None = None
    price_change_24h: float | None = None
    signal: str
    score: float
    color: str
    confidence: str
    layers: dict
    indicators: TechnicalIndicators | None = None
    updated_at: str | None = None


class FearGreedResponse(BaseModel):
    value: int
    classification: str
    timestamp: str
    history: list[dict] = []


class MarketOverview(BaseModel):
    total_market_cap_usd: float | None = None
    total_volume_usd: float | None = None
    btc_dominance: float | None = None
    market_cap_change_24h: float | None = None
    active_cryptocurrencies: int | None = None
    fear_greed: FearGreedResponse | None = None
    market_score: dict | None = None
    news_sentiment: dict | None = None


class TopMovers(BaseModel):
    gainers: list[dict] = []
    losers: list[dict] = []


class VolumeAnomaly(BaseModel):
    coin_id: str
    symbol: str
    name: str
    current_volume: float
    baseline_volume: float
    deviation_multiple: float
    is_anomaly: bool


class DerivativesEntry(BaseModel):
    coin_id: str
    symbol: str
    funding_rate: dict | None = None
    long_short_ratio: dict | None = None
    open_interest: float | None = None
