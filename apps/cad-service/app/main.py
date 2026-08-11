from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import threading
import logging

from .routers import analyze, gltf, health
from .api import manufacturability_scoring, conversion
from .api.v1 import machining as machining_v1
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

API_DESCRIPTION = """
CAD analysis and conversion service.

Upload a CAD file and get back geometry, manufacturing features, meshes for
preview, or a manufacturability assessment.

### Where to start

* **machining-analysis** - `POST /api/v1/cad/analyze-machining` extracts
  machining-relevant geometry from STEP/IGES/BREP deterministically. Start here
  for CNC feature extraction.
* **analyze** - general multi-format analysis (STEP, IGES, STL, OBJ, DXF).
* **gltf** - GLB meshes for the 3D viewer.

### Units

All linear dimensions are millimetres and all areas are mm² unless an endpoint
documents otherwise. STEP files are read with the OpenCASCADE unit pinned to
MM, so a file authored in inches yields the same numbers as one authored in
millimetres.

### CAD kernel

STEP/IGES/BREP handling needs an OpenCASCADE binding (`OCP` or
`pythonocc-core`). When neither is installed, those endpoints return
**503**; STL and DXF handling is unaffected.
"""

OPENAPI_TAGS = [
    {
        "name": "machining-analysis",
        "description": (
            "**Deterministic CNC geometry extraction.** Answers *what geometry "
            "exists* - bounding box, mass properties, face classification, "
            "holes, bores, pockets, slots, bosses, fillets, chamfers, threads, "
            "repeated-feature patterns, tool-diameter constraints, "
            "accessibility and setup candidates, and a bounding-box stock "
            "estimate.\n\n"
            "It deliberately does **not** estimate cost, select a machine or "
            "process, or produce a price - those belong to downstream services. "
            "No LLM is involved: the same file always returns the same JSON."
        ),
        "externalDocs": {
            "description": "Endpoint README - detectors, thresholds, error codes",
            "url": "https://github.com/seovimalraj/cnc-quote/blob/main/apps/cad-service/app/machining/README.md",
        },
    },
    {
        "name": "analyze",
        "description": (
            "General CAD analysis across STEP, IGES, STL, OBJ and DXF, including "
            "process classification and DFM checks. Asynchronous via Celery "
            "(`POST /analyze`, then poll `GET /analyze/{task_id}`) or immediate "
            "via `POST /analyze/sync`."
        ),
    },
    {
        "name": "gltf",
        "description": (
            "GLB mesh generation for the 3D viewer, with low/med/high levels of "
            "detail cached by file hash."
        ),
    },
    {
        "name": "scoring",
        "description": "Manufacturability scoring over previously extracted features.",
    },
    {
        "name": "conversion",
        "description": "Direct STEP/IGES to STL/OBJ tessellation and download.",
    },
    {
        "name": "health",
        "description": "Liveness and readiness, including Celery and system resources.",
    },
]


def _openapi_servers():
    """Server list for the Swagger 'Servers' selector.

    The deployed origin comes from PUBLIC_BASE_URL when set, so 'Try it out'
    targets the right host instead of defaulting to the docs page origin.
    """
    servers = []
    public = os.getenv("PUBLIC_BASE_URL")
    if public:
        servers.append({"url": public.rstrip("/"), "description": "Deployed"})
    port = os.getenv("PORT", "8001")
    servers.append({"url": f"http://localhost:{port}", "description": "Local development"})
    return servers


def create_app():
    global otel_initialized

    app = FastAPI(
        title="CAD Service",
        description=API_DESCRIPTION,
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        openapi_tags=OPENAPI_TAGS,
        servers=_openapi_servers(),
        # A `url` rather than an `email`: FastAPI types Contact.email as
        # EmailStr, which pulls in the optional email-validator package.
        contact={
            "name": "Frigate Engineering",
            "url": "https://github.com/seovimalraj/cnc-quote/tree/main/apps/cad-service",
        },
        swagger_ui_parameters={
            # Collapsed by default: the machining response schema is large and
            # an expanded page is unreadable.
            "docExpansion": "none",
            "defaultModelsExpandDepth": 1,
            "displayRequestDuration": True,
            "filter": True,
            "tryItOutEnabled": True,
            "persistAuthorization": True,
        },
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
    # Deterministic machining geometry extraction (no cost, no pricing).
    app.include_router(
        machining_v1.router, prefix="/api/v1/cad", tags=["machining-analysis"]
    )

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
