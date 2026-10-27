"""FastAPI application entry point.

In production the React build is served from the same origin as the API, so
the deployment is a single container with no CORS surface.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .api.routes import router
from .config import DB_PATH, REPO_ROOT
from .db import READ_ONLY, connect, init_db

log = logging.getLogger(__name__)


def _cors_origins() -> list[str]:
    raw = os.environ.get(
        "WINDCAST_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def create_app(db_path: Path | None = None) -> FastAPI:
    app = FastAPI(
        title="Windcast API",
        version="0.1.0",
        description=(
            "Day-ahead wind forecast intelligence for a GB energy utility. "
            "Vintage-aware selection, quantified forecast error, and "
            "procurement support."
        ),
    )
    app.state.db_path = db_path or DB_PATH

    app.add_middleware(GZipMiddleware, minimum_size=800)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(),
        allow_credentials=False,
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    app.include_router(router)

    # Ensure a usable schema exists even if the snapshot has not been built.
    # Serverless deployments mount the snapshot read-only and skip this step.
    if not READ_ONLY:
        try:
            conn = connect(app.state.db_path)
            init_db(conn)
            conn.close()
        except Exception:  # noqa: BLE001 - API should still start and report health
            log.exception("Could not initialise the SQLite snapshot")

    dist = REPO_ROOT / "frontend" / "dist"
    if dist.exists():
        assets = dist / "assets"
        if assets.exists():
            app.mount("/assets", StaticFiles(directory=assets), name="assets")

        @app.get("/{full_path:path}", include_in_schema=False)
        def spa(full_path: str) -> FileResponse:
            candidate = (dist / full_path).resolve()
            if (
                full_path
                and candidate.is_file()
                and candidate.is_relative_to(dist.resolve())
            ):
                return FileResponse(candidate)
            return FileResponse(dist / "index.html")

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    logging.basicConfig(level=logging.INFO)
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
