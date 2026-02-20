"""BedavaFinans Configuration - All constants and settings."""

# === API URLs ===
COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3"
BINANCE_BASE_URL = "https://api.binance.com/api/v3"
BINANCE_FUTURES_URL = "https://fapi.binance.com"
ALTERNATIVE_ME_URL = "https://api.alternative.me/fng/"
CRYPTOCOMPARE_BASE_URL = "https://min-api.cryptocompare.com"
BLOCKCHAIR_BASE_URL = "https://api.blockchair.com"

# === General ===
TOP_N_COINS = 100
SIGNAL_COINS_COUNT = 15  # Top N coins for automatic signal computation
TOP_MOVERS_COUNT = 10
AUTO_REFRESH_INTERVAL = 120  # seconds - frontend polling

# === Cache TTLs (seconds) ===
CACHE_TTL_MARKET_DATA = 120    # 2 min
CACHE_TTL_OHLC = 300           # 5 min
CACHE_TTL_GLOBAL = 120         # 2 min
CACHE_TTL_FEAR_GREED = 3600    # 1 hour
CACHE_TTL_DERIVATIVES = 300    # 5 min
CACHE_TTL_WHALES = 300         # 5 min
CACHE_TTL_NEWS = 900           # 15 min
CACHE_TTL_SOCIAL = 600         # 10 min (social sentiment)
CACHE_TTL_ARBITRAGE = 300      # 5 min (funding rate arbitrage)

# === Technical Analysis Parameters ===
RSI_PERIOD = 14
STOCH_RSI_PERIOD = 14
MACD_FAST = 12
MACD_SLOW = 26
MACD_SIGNAL = 9
BB_PERIOD = 20
BB_STD_DEV = 2
EMA_SHORT = 9
EMA_LONG = 21
OBV_PERIOD = 14

# === Signal Thresholds ===
RSI_OVERSOLD = 30
RSI_OVERBOUGHT = 70
VOLUME_ANOMALY_STD_MULTIPLIER = 2.0

# === Signal Layer Weights ===
WEIGHT_TECHNICAL = 0.40
WEIGHT_VOLUME = 0.25
WEIGHT_SENTIMENT = 0.20
WEIGHT_DERIVATIVES = 0.15

# === Binance Symbol Mapping (CoinGecko ID → Binance symbol) ===
BINANCE_SYMBOL_MAP = {
    "bitcoin": "BTC",
    "ethereum": "ETH",
    "binancecoin": "BNB",
    "solana": "SOL",
    "ripple": "XRP",
    "cardano": "ADA",
    "dogecoin": "DOGE",
    "avalanche-2": "AVAX",
    "polkadot": "DOT",
    "chainlink": "LINK",
    "tron": "TRX",
    "polygon-ecosystem-token": "POL",
    "shiba-inu": "SHIB",
    "litecoin": "LTC",
    "bitcoin-cash": "BCH",
    "uniswap": "UNI",
    "stellar": "XLM",
    "near": "NEAR",
    "internet-computer": "ICP",
    "aptos": "APT",
    "filecoin": "FIL",
    "cosmos": "ATOM",
    "arbitrum": "ARB",
    "optimism": "OP",
    "sui": "SUI",
    "render-token": "RENDER",
    "injective-protocol": "INJ",
    "the-graph": "GRT",
    "hedera-hashgraph": "HBAR",
    "aave": "AAVE",
}

# === Sentiment Keywords ===
POSITIVE_KEYWORDS = [
    "bullish", "surge", "rally", "gain", "pump", "moon", "breakout",
    "adoption", "partnership", "upgrade", "launch", "approval", "growth",
    "record", "high", "buy", "accumulate", "institutional",
]
NEGATIVE_KEYWORDS = [
    "bearish", "crash", "dump", "plunge", "hack", "exploit", "ban",
    "regulation", "lawsuit", "fraud", "scam", "sell", "liquidation",
    "fear", "decline", "loss", "warning", "risk",
]

# === Social Sentiment ===
LUNARCRUSH_API_KEY = ""  # Free tier - get from lunarcrush.com/developers
SOCIAL_TRENDING_COUNT = 20  # Number of trending topics to fetch

# CoinGecko ID → LunarCrush topic slug mapping
LUNARCRUSH_TOPIC_MAP = {
    "bitcoin": "bitcoin",
    "ethereum": "ethereum",
    "binancecoin": "bnb",
    "solana": "solana",
    "ripple": "xrp",
    "cardano": "cardano",
    "dogecoin": "dogecoin",
    "avalanche-2": "avalanche",
    "polkadot": "polkadot",
    "chainlink": "chainlink",
    "tron": "tron",
    "shiba-inu": "shiba-inu",
    "litecoin": "litecoin",
    "uniswap": "uniswap",
    "near": "near-protocol",
    "sui": "sui",
    "aptos": "aptos",
    "arbitrum": "arbitrum",
    "optimism": "optimism",
    "aave": "aave",
}

# === Server ===
HOST = "0.0.0.0"
PORT = 8000
