"""BedavaFinans - Crypto Market Signal Dashboard."""

import asyncio
import sys
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, Response, JSONResponse

from config import HOST, PORT, CACHE_TTL_MARKET_DATA
from backend.api.routes import router as api_router

# Ensure project root is on path
sys.path.insert(0, str(Path(__file__).parent))

# Dynamic cache-bust version (changes every deploy/restart)
ASSET_VERSION = str(int(time.time()))


# ─── Rate Limiting ───
rate_limit_store: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_MAX = 60  # requests per window
RATE_LIMIT_WINDOW = 60  # seconds


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
async def rate_limit_middleware(request: Request, call_next):
    """Rate limit API requests (60 req/min per IP)."""
    path = request.url.path
    if path.startswith("/api/") and path != "/api/health":
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        # Clean old entries
        rate_limit_store[client_ip] = [
            t for t in rate_limit_store[client_ip] if now - t < RATE_LIMIT_WINDOW
        ]
        if len(rate_limit_store[client_ip]) >= RATE_LIMIT_MAX:
            return JSONResponse(
                status_code=429,
                content={"error": "Too many requests. Please wait."},
                headers={"Retry-After": str(RATE_LIMIT_WINDOW)},
            )
        rate_limit_store[client_ip].append(now)
    return await call_next(request)


@app.middleware("http")
async def add_cache_headers(request: Request, call_next):
    """Add cache-control headers for static assets."""
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/static/"):
        if path.endswith((".css", ".js")):
            response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=86400"
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
    """Serve the main dashboard page with dynamic cache-bust versions."""
    html = (frontend_dir / "index.html").read_text(encoding="utf-8")
    html = html.replace("?v=2", f"?v={ASSET_VERSION}")
    return HTMLResponse(
        content=html,
        headers={"Cache-Control": "no-cache"},
    )


@app.get("/manifest.json")
async def serve_manifest():
    """Serve PWA manifest."""
    return FileResponse(str(frontend_dir / "manifest.json"), media_type="application/manifest+json")


@app.get("/sw.js")
async def serve_sw():
    """Serve service worker from root scope."""
    return FileResponse(
        str(frontend_dir / "sw.js"),
        media_type="application/javascript",
        headers={"Cache-Control": "no-cache"},
    )


@app.get("/sitemap.xml")
async def serve_sitemap():
    """Serve XML sitemap for search engines."""
    xml = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://bedavafinans.info/</loc>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.bedavafinans.info/</loc>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>"""
    return Response(content=xml, media_type="application/xml")


@app.get("/robots.txt")
async def serve_robots():
    """Serve robots.txt for search engine crawlers."""
    txt = """User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://bedavafinans.info/sitemap.xml"""
    return Response(content=txt, media_type="text/plain")


# 404 catch-all (must be last)
@app.api_route("/{path:path}", methods=["GET"])
async def catch_all(path: str):
    """Serve 404 page for unknown routes."""
    return FileResponse(str(frontend_dir / "404.html"), status_code=404)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
