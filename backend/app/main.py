import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import get_settings
from app.database import engine
from app.routes import auth, dashboard, expenses

settings = get_settings()
logger = logging.getLogger("daybook")


@asynccontextmanager
async def lifespan(application: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(
    title="Daybook API",
    version="1.0.0",
    docs_url="/api/docs" if settings.app_env != "production" else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if settings.app_env != "production" else None,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    origin = request.headers.get("origin")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        if origin is not None and origin not in settings.allowed_origins:
            return JSONResponse({"detail": "Origin is not allowed"}, status_code=403)
        if request.headers.get("sec-fetch-site") == "cross-site":
            return JSONResponse({"detail": "Cross-site requests are not allowed"}, status_code=403)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(SQLAlchemyError)
async def database_error(request: Request, error: SQLAlchemyError):
    logger.error("Database request failed", exc_info=error)
    return JSONResponse({"detail": "Service temporarily unavailable"}, status_code=503)


@app.get("/api/health", tags=["Health"])
async def health():
    return {"status": "ok"}


@app.get("/api/ready", tags=["Health"])
async def ready():
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))
        await connection.execute(text("SELECT id FROM users LIMIT 0"))
        await connection.execute(text("SELECT id FROM expenses LIMIT 0"))
    return {"status": "ready"}


app.include_router(auth.router, prefix="/api/v1")
app.include_router(expenses.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
