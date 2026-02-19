from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import threading
import logging

from .routers import analyze, gltf, health
from .api import manufacturability_scoring, conversion
from .workers.celery import celery_app
from . import otel
from . import logging_config

logger = logging.getLogger(__name__)

# Initialize OpenTelemetry first
otel_initialized = False


def _background_ml_pretrain():
    """Pre-train ML classifier in background thread (non-blocking)."""
    try:
        from .core.ml_classifier import pretrain_ml_classifier
        logger.info("Starting ML classifier pre-training in background...")
        success = pretrain_ml_classifier()
        if success:
            logger.info("ML classifier pre-training completed successfully")
        else:
            logger.warning("ML classifier pre-training skipped or failed (classifier will work without ML)")
    except Exception as exc:
        logger.warning("ML pre-training background task failed: %s (continuing without ML)", exc)

def create_app():
    global otel_initialized
    
    app = FastAPI(
        title="CAD Service",
        description="CAD analysis and conversion service for CNC Quote",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc"
    )

    # Initialize observability (once)
    if not otel_initialized:
        # Initialize structured logging
        logging_config  # Module initialization happens on import
        
        # Instrument app with OpenTelemetry
        otel.instrument_app(app)
        otel_initialized = True

    # CORS middleware
    ALLOWED_ORIGINS = [
        "https://cnc-quote-web.onrender.com",
        "https://cnc-quote-api.onrender.com",
    ]
    if os.getenv("NODE_ENV") == "development":
        ALLOWED_ORIGINS.append("http://localhost:3000")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
        max_age=3600,
    )

    # Include routers
    app.include_router(analyze.router, prefix="/analyze", tags=["analyze"])
    app.include_router(gltf.router, prefix="/gltf", tags=["gltf"])
    app.include_router(health.router, tags=["health"])
    app.include_router(manufacturability_scoring.router, prefix="/scoring", tags=["scoring"])
    app.include_router(conversion.router, prefix="/convert", tags=["conversion"])

    @app.get("/")
    async def root():
        return {"message": "CAD Service API", "version": "1.0.0"}
    
    @app.on_event("startup")
    async def startup_event():
        """Start ML pre-training in background (non-blocking)."""
        # Use daemon thread so it doesn't block shutdown
        ml_thread = threading.Thread(target=_background_ml_pretrain, daemon=True)
        ml_thread.start()
    
    return app

# Create app instance
app = create_app()

# Graceful shutdown handler
import atexit
atexit.register(otel.shutdown)
