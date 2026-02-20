"""BedavaFinans - Crypto Market Signal Dashboard."""

import asyncio
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
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
    from backend.services.social_sentiment import get_social_overview

    while True:
        try:
            await fetch_top_coins()
            await fetch_global()
            await fetch_fear_greed(limit=30)
            await get_overall_sentiment()
            await get_social_overview()
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


@app.middleware("http")
async def add_cache_headers(request: Request, call_next):
    """Add cache-control headers for static assets."""
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/static/"):
        if path.endswith((".css", ".js")):
            response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=86400"
        elif path.endswith((".png", ".svg", ".jpg", ".jpeg", ".webp", ".ico")):
            response.headers["Cache-Control"] = "public, max-age=86400, immutable"
        elif path.endswith((".woff", ".woff2", ".ttf")):
            response.headers["Cache-Control"] = "public, max-age=604800, immutable"
    return response


# Mount frontend static files
frontend_dir = Path(__file__).parent / "frontend"
app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="static")

# Include API routes
app.include_router(api_router, prefix="/api")


@app.get("/")
async def serve_dashboard():
    """Serve the main dashboard page."""
    return FileResponse(str(frontend_dir / "index.html"))


@app.get("/manifest.json")
async def serve_manifest():
    """Serve PWA manifest."""
    return FileResponse(str(frontend_dir / "manifest.json"), media_type="application/manifest+json")


@app.get("/sw.js")
async def serve_sw():
    """Serve service worker from root scope."""
    return FileResponse(str(frontend_dir / "sw.js"), media_type="application/javascript")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
