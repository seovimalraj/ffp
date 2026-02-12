from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os

from .routers import analyze, gltf, health
from .api import manufacturability_scoring, conversion
from .workers.celery import celery_app
from . import otel
from . import logging_config

# Initialize OpenTelemetry first
otel_initialized = False

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
    
    return app

# Create app instance
app = create_app()

# Graceful shutdown handler
import atexit
atexit.register(otel.shutdown)
