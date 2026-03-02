# FFP (Frigate Fast Parts) CAD Analysis System - Technical Architecture

**Version:** 1.0  
**Date:** February 2026  
**Classification:** Technical Reference

---

## 1. Executive Summary

The FFP (Frigate Fast Parts) CAD Analysis System is an enterprise-grade manufacturing intelligence platform that automatically analyzes CAD files, identifies manufacturing processes, extracts geometric features, and provides instant pricing. The system processes STEP, IGES, STL, and DXF files using advanced geometric analysis algorithms.

### Key Capabilities
- **Automatic Process Detection**: Distinguishes between sheet metal, CNC milling, CNC turning, and specialized processes (5-axis, turn-mill, casting, weldments)
- **Feature Extraction**: Identifies holes, pockets, threads, bends, undercuts, fillets, and more
- **DFM Analysis**: Provides Design for Manufacturability feedback with recommendations
- **Instant Pricing**: Calculates accurate quotes based on geometry, material, and process

---

## 2. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FFP PLATFORM ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌─────────────────┐     ┌────────────────────────────┐│
│  │   Web UI    │────▶│    API Server   │────▶│      CAD Service           ││
│  │  (Next.js)  │     │    (NestJS)     │     │      (FastAPI)             ││
│  └─────────────┘     └─────────────────┘     └────────────────────────────┘│
│        │                    │                          │                    │
│        │                    │                          │                    │
│        ▼                    ▼                          ▼                    │
│  ┌─────────────┐     ┌─────────────────┐     ┌────────────────────────────┐│
│  │  Pricing    │     │    Database     │     │    OpenCASCADE (OCC)       ││
│  │  Engine     │     │   (Supabase)    │     │    + Trimesh               ││
│  └─────────────┘     └─────────────────┘     └────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Component Overview

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Web UI** | Next.js, React | User interface for upload, configuration, and ordering |
| **API Server** | NestJS (Node.js) | Business logic, authentication, order management |
| **CAD Service** | FastAPI (Python) | CAD file analysis, geometry extraction, classification |
| **Pricing Engine** | TypeScript | Cost calculation, quote generation |
| **Database** | Supabase (PostgreSQL) | Persistent storage for orders, users, configurations |

### 2.2 Data Flow

```
1. User Upload → Web UI
      │
      ▼
2. File Storage → Supabase Storage (CDN)
      │
      ▼
3. Analysis Request → API Server → CAD Service
      │
      ▼
4. Geometry Extraction → OpenCASCADE / Trimesh
      │
      ▼
5. Feature Detection → Classification Engine
      │
      ▼
6. Process Determination → ML + Rule Engine
      │
      ▼
7. DFM Analysis → Issue Detection & Recommendations
      │
      ▼
8. Pricing Calculation → Pricing Engine
      │
      ▼
9. Quote Response → User
```

---

## 3. CAD Service Architecture

The CAD Service is the core analysis engine, built on Python with FastAPI.

### 3.1 Module Structure

```
apps/cad-service/
├── app/
│   ├── main.py              # FastAPI application entry point
│   ├── models.py            # Data models (HoleFeature, PocketFeature, etc.)
│   ├── dfm_analyzer.py      # Design for Manufacturability analysis
│   │
│   ├── core/                # Core analysis algorithms
│   │   ├── classification.py        # Process classification (11-tier cascade)
│   │   ├── geometry.py              # Geometric metrics calculation
│   │   ├── face_classification.py   # BRep face type analysis
│   │   ├── bend_detection.py        # Bend and flange detection
│   │   ├── feature_analysis.py      # Feature signal computation
│   │   ├── machining_complexity.py  # 5-axis and complexity analysis
│   │   └── ml_classifier.py         # ML-assisted classification
│   │
│   ├── extractors/          # Feature extraction modules
│   │   ├── holes.py         # Hole detection (blind, through, countersink)
│   │   ├── pockets.py       # Pocket detection
│   │   ├── threads.py       # Thread detection (metric, imperial)
│   │   ├── bends.py         # Bend angle extraction (STEP)
│   │   ├── fillets.py       # Fillet/chamfer detection
│   │   ├── slots.py         # Slot detection
│   │   ├── undercuts.py     # Undercut detection
│   │   └── ...
│   │
│   ├── loaders/             # File format loaders
│   │   ├── step_loader.py   # STEP/IGES loader (OpenCASCADE)
│   │   ├── stl_loader.py    # STL loader (Trimesh)
│   │   └── ...
│   │
│   └── routers/             # API endpoints
│       └── analyze.py       # Main analysis endpoint
│
└── tests/                   # Unit and integration tests
```

### 3.2 Technology Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| **OpenCASCADE (PythonOCC)** | 7.x | STEP/IGES parsing, B-Rep analysis |
| **Trimesh** | 4.x | STL/mesh processing, ray casting |
| **NumPy** | 1.x | Numerical operations |
| **FastAPI** | 0.100+ | REST API framework |
| **Pydantic** | 2.x | Data validation |

---

## 4. Security & Scalability

### 4.1 File Security
- Files uploaded to Supabase with signed URLs
- Temporary files cleaned after analysis
- No CAD files stored permanently without user consent

### 4.2 Scalability Architecture
- Stateless CAD Service allows horizontal scaling
- Redis-based job queue for async processing (Celery)
- CDN-backed file storage for fast uploads

### 4.3 Performance Targets
| Metric | Target | Current |
|--------|--------|---------|
| STEP Analysis (< 10MB) | < 5s | ~2-4s |
| STL Analysis (< 5MB) | < 3s | ~1-2s |
| DXF Analysis | < 2s | ~0.5s |
| Concurrent Analysis | 50+ | 100+ |

---

## 5. API Reference

### 5.1 Main Analysis Endpoint

```
POST /analyze
Content-Type: application/json

Request Body:
{
  "file_url": "https://storage.example.com/part.step",
  "unit": "mm",           // mm, inch, cm, m
  "material": "aluminum", // Optional: for material-specific analysis
  "format": "step"        // step, iges, stl, dxf
}

Response:
{
  "process_type": "sheet_metal",
  "confidence": 0.94,
  "geometry": {
    "volume_mm3": 12500,
    "surface_area_mm2": 45000,
    "bounding_box": {
      "x_mm": 200, "y_mm": 150, "z_mm": 2
    }
  },
  "features": {
    "holes": [...],
    "bends": [...],
    "pockets": [...]
  },
  "dfm": {
    "score": 85,
    "issues": [...],
    "recommendations": [...]
  },
  "classification_metadata": {
    "method": "face_type_paired_plane",
    "reasoning": "..."
  }
}
```

---

## 6. Deployment

### 6.1 Container Architecture

```yaml
# docker-compose.yml (simplified)
services:
  cad-service:
    image: ffp/cad-service:latest
    environment:
      - OCC_AVAILABLE=true
    resources:
      limits:
        memory: 4G
        cpus: 2
    
  api:
    image: ffp/api:latest
    depends_on:
      - cad-service
    
  web:
    image: ffp/web:latest
    depends_on:
      - api
```

### 6.2 Environment Requirements

| Service | CPU | RAM | Storage |
|---------|-----|-----|---------|
| CAD Service | 2+ cores | 4GB+ | 10GB |
| API Server | 1+ core | 1GB | 5GB |
| Web Frontend | 0.5 core | 512MB | 1GB |

---

## 7. Integration Points

### 7.1 Supported CAD Formats

| Format | Extension | Engine | Features |
|--------|-----------|--------|----------|
| STEP | .step, .stp | OpenCASCADE | Full B-Rep, tolerances |
| IGES | .iges, .igs | OpenCASCADE | Basic B-Rep |
| STL | .stl | Trimesh | Mesh only, no B-Rep |
| DXF | .dxf | ezdxf | 2D profiles, flat parts |

### 7.2 ERP Integration
- REST API for quote injection
- Webhook support for order events
- CSV/Excel export capabilities

---

*Document maintained by FFP Tech Team*
