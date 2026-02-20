"""BedavaFinans - Crypto Market Signal Dashboard."""

import asyncio
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from config import HOST, PORT, CACHE_TTL_MARKET_DATA
from backend.api.routes import router as api_router

# Ensure project root is on path
sys.path.insert(0, str(Path(__file__).parent))


async def periodic_refresh():
    """Background task to pre-warm cache periodically."""
    from backend.services.coingecko import fetch_top_coins, fetch_global
    from backend.services.fear_greed import fetch_fear_greed
    from backend.services.news_sentiment import get_overall_sentiment

    while True:
        try:
            await fetch_top_coins()
            await fetch_global()
            await fetch_fear_greed(limit=30)
            await get_overall_sentiment()
        except Exception as e:
            print(f"[BedavaFinans] Refresh error: {e}")
        await asyncio.sleep(CACHE_TTL_MARKET_DATA)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage background refresh task lifecycle."""
    task = asyncio.create_task(periodic_refresh())
    print(f"[BedavaFinans] Dashboard starting at http://localhost:{PORT}")
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="BedavaFinans - Crypto Signal Dashboard", lifespan=lifespan)

# Mount frontend static files
frontend_dir = Path(__file__).parent / "frontend"
app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="static")

# Include API routes
app.include_router(api_router, prefix="/api")


@app.get("/")
async def serve_dashboard():
    """Serve the main dashboard page."""
    return FileResponse(str(frontend_dir / "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
