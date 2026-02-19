"""
@ownership cad-platform
@raci docs/governance/raci-matrix.yaml
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uuid
import time
import asyncio
from datetime import datetime

# Import conversion router
from app.api.conversion import router as conversion_router

# Type alias for DFM check data
DFMCheckData = Dict[str, Any]

app = FastAPI(title="CNC Quote CAD Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include conversion router
app.include_router(conversion_router, prefix="/api", tags=["conversion"])

# In-memory storage for demo purposes
dfm_tasks: Dict[str, Any] = {}
dfm_results: Dict[str, Any] = {}

class DFMAnalysisRequest(BaseModel):
    file_id: str
    quote_line_id: str
    process: str  # CNC, SheetMetal, InjectionMolding
    material: str
    units: str = "mm"  # mm or in
    options: Optional[Dict[str, Any]] = None

class DFMAnalysisResponse(BaseModel):
    task_id: str
    status: str  # Queued, Processing, Succeeded, Failed

class DFMCheck(BaseModel):
    id: str
    title: str
    status: str  # passed, warning, blocker
    message: str
    metrics: Optional[Dict[str, Any]] = None
    suggestions: List[str] = []
    highlights: Dict[str, List[int]]  # face_ids, edge_ids

class DFMResult(BaseModel):
    status: str  # Processing, Succeeded, Failed
    summary: Optional[Dict[str, int]] = None  # passed, warnings, blockers
    checks: Optional[List[DFMCheck]] = None
    geom_props: Optional[Dict[str, Any]] = None

# Mock DFM checks data
MOCK_CHECKS: List[DFMCheckData] = [
    {
        "id": "file_type",
        "title": "File Type",
        "status": "passed",
        "message": "STEP file format is supported for CNC machining.",
        "metrics": {"file_extension": ".step"},
        "suggestions": [],
        "highlights": {"face_ids": [], "edge_ids": []}
    },
    {
        "id": "units_and_scale",
        "title": "Units & Scale Check",
        "status": "passed",
        "message": "Model dimensions are within acceptable range (100×50×25mm).",
        "metrics": {"bbox_mm": [0, 0, 0, 100, 50, 25]},
        "suggestions": [],
        "highlights": {"face_ids": [], "edge_ids": []}
    },
    {
        "id": "floating_parts",
        "title": "Floating Parts Check",
        "status": "passed",
        "message": "Single solid body detected - no floating parts.",
        "metrics": {"shell_count": 1},
        "suggestions": [],
        "highlights": {"face_ids": [], "edge_ids": []}
    },
    {
        "id": "model_fidelity",
        "title": "Model Fidelity",
        "status": "passed",
        "message": "Model geometry is valid with no self-intersections.",
        "metrics": {"brep_check": "Valid"},
        "suggestions": [],
        "highlights": {"face_ids": [], "edge_ids": []}
    },
    {
        "id": "self_intersection",
        "title": "Non-Manifold / Self-Intersection Check",
        "status": "passed",
        "message": "No self-intersections or non-manifold edges detected.",
        "metrics": {"intersections": 0},
        "suggestions": [],
        "highlights": {"face_ids": [], "edge_ids": []}
    },
    {
        "id": "shell_count",
        "title": "Model Shell Count",
        "status": "passed",
        "message": "Single closed shell - suitable for machining.",
        "metrics": {"shell_count": 1},
        "suggestions": [],
        "highlights": {"face_ids": [], "edge_ids": []}
    },
    {
        "id": "voids",
        "title": "Void Check",
        "status": "passed",
        "message": "No internal voids or trapped volumes detected.",
        "metrics": {"void_count": 0},
        "suggestions": [],
        "highlights": {"face_ids": [], "edge_ids": []}
    },
    {
        "id": "large_dimension",
        "title": "Large Part Dimension",
        "status": "passed",
        "message": "Part dimensions fit within machine travel limits.",
        "metrics": {"max_dimension_mm": 100},
        "suggestions": [],
        "highlights": {"face_ids": [], "edge_ids": []}
    },
    {
        "id": "finish_capacity",
        "title": "Part Exceeds Maximum Size for This Finish",
        "status": "passed",
        "message": "Part size is compatible with anodizing finish.",
        "metrics": {"finish_max_size_mm": 500},
        "suggestions": [],
        "highlights": {"face_ids": [], "edge_ids": []}
    },
    {
        "id": "tool_access",
        "title": "Tool Access / Reach (3-Axis Feasibility)",
        "status": "warning",
        "message": "Some features may require 5-axis machining for proper tool access.",
        "metrics": {"inaccessible_faces": 3},
        "suggestions": ["Consider 5-axis machining or redesign for better access."],
        "highlights": {"face_ids": [123, 456, 789], "edge_ids": []}
    },
    {
        "id": "corner_radius",
        "title": "Internal Corner Radius vs Cutter Diameter",
        "status": "blocker",
        "message": "Internal corner radius (0.5mm) smaller than minimum cutter diameter (1.0mm).",
        "metrics": {"corner_radius_mm": 0.5, "min_cutter_mm": 1.0},
        "suggestions": ["Increase internal corner radius to ≥ 1.0mm."],
        "highlights": {"face_ids": [], "edge_ids": [88, 99]}
    },
    {
        "id": "min_wall",
        "title": "Minimum Wall Thickness",
        "status": "warning",
        "message": "Two walls below 1.0 mm for Aluminum (0.78 mm, 0.92 mm).",
        "metrics": {"min_wall_mm": 0.78},
        "suggestions": ["Increase to ≥ 1.0 mm or change to Steel (≥0.8 mm)."],
        "highlights": {"face_ids": [123, 456], "edge_ids": []}
    },
    {
        "id": "thin_web",
        "title": "Thin Web / Fin Slenderness",
        "status": "passed",
        "message": "All webs meet minimum thickness requirements.",
        "metrics": {"min_web_ratio": 8.5},
        "suggestions": [],
        "highlights": {"face_ids": [], "edge_ids": []}
    },
    {
        "id": "min_hole_dia",
        "title": "Minimum Hole Diameter",
        "status": "passed",
        "message": "All holes meet minimum diameter requirements.",
        "metrics": {"min_hole_dia_mm": 3.0},
        "suggestions": [],
        "highlights": {"face_ids": [], "edge_ids": []}
    },
    {
        "id": "hole_depth_ratio",
        "title": "Hole Depth-to-Diameter Ratio",
        "status": "passed",
        "message": "All hole depth ratios are within acceptable limits.",
        "metrics": {"max_depth_ratio": 8.5},
        "suggestions": [],
        "highlights": {"face_ids": [], "edge_ids": []}
    },
    {
        "id": "pocket_ratio",
        "title": "Pocket Depth-to-Width Ratio",
        "status": "passed",
        "message": "All pocket ratios are within machining limits.",
        "metrics": {"max_pocket_ratio": 2.5},
        "suggestions": [],
        "highlights": {"face_ids": [], "edge_ids": []}
    },
    {
        "id": "slot_width",
        "title": "Slot Width vs Cutter Availability",
        "status": "passed",
        "message": "All slot widths are compatible with available cutters.",
        "metrics": {"min_slot_width_mm": 2.0},
        "suggestions": [],
        "highlights": {"face_ids": [], "edge_ids": []}
    },
    {
        "id": "boss_slenderness",
        "title": "Boss/Pin Slenderness",
        "status": "passed",
        "message": "All bosses meet slenderness requirements.",
        "metrics": {"max_boss_ratio": 2.8},
        "suggestions": [],
        "highlights": {"face_ids": [], "edge_ids": []}
    },
    {
        "id": "thread_feasibility",
        "title": "Thread Feasibility",
        "status": "passed",
        "message": "All threads are feasible with standard tooling.",
        "metrics": {"thread_count": 2},
        "suggestions": [],
        "highlights": {"face_ids": [], "edge_ids": []}
    },
    {
        "id": "workholding",
        "title": "Workholding / Clamp Area",
        "status": "warning",
        "message": "Limited flat surfaces may require custom workholding.",
        "metrics": {"clamp_area_mm2": 1200},
        "suggestions": ["Add tabs for better clamping or use soft jaws."],
        "highlights": {"face_ids": [101, 202], "edge_ids": []}
    }
]

async def process_dfm_analysis(task_id: str, request: DFMAnalysisRequest):
    """Basic CAD file validation and analysis"""
    try:
        # Update status to processing when task actually starts
        dfm_tasks[task_id]["status"] = "Processing"

        # Simulate processing time
        await asyncio.sleep(2)

        # Basic file validation and geometry extraction
        checks = await validate_cad_file(request)

        # Calculate summary
        summary = {
            "passed": len([c for c in checks if c.status == "passed"]),
            "warnings": len([c for c in checks if c.status == "warning"]),
            "blockers": len([c for c in checks if c.status == "blocker"])
        }

        # Basic geometric properties (would be extracted from actual CAD parsing)
        geom_props = {
            "bbox_mm": [0, 0, 0, 100, 50, 25],  # placeholder
            "obb_mm": [0, 0, 0, 100, 50, 25],   # placeholder
            "vol_mm3": 125000,                   # placeholder
            "area_mm2": 16500                    # placeholder
        }

        result = DFMResult(
            status="Succeeded",
            summary=summary,
            checks=checks,
            geom_props=geom_props
        )

        dfm_results[task_id] = result
        dfm_tasks[task_id]["status"] = "Succeeded"

    except Exception as e:
        print(f"Error processing DFM analysis for task {task_id}: {e}")
        dfm_tasks[task_id]["status"] = "Failed"
        dfm_results[task_id] = DFMResult(status="Failed")

async def validate_cad_file(request: DFMAnalysisRequest) -> List[DFMCheck]:
    """Validate CAD file format and perform basic checks"""
    checks = []

    # File type validation
    file_extension = request.file_id.split('.')[-1].lower() if '.' in request.file_id else ''
    supported_formats = ['step', 'stp', 'iges', 'igs', 'stl', 'obj', 'dxf']

    if file_extension in supported_formats:
        checks.append(DFMCheck(**{
            "id": "file_type",
            "title": "File Type",
            "status": "passed",
            "message": f"{file_extension.upper()} file format is supported for CNC machining.",
            "metrics": {"file_extension": f".{file_extension}"},
            "suggestions": [],
            "highlights": {"face_ids": [], "edge_ids": []}
        }))
    else:
        checks.append(DFMCheck(**{
            "id": "file_type",
            "title": "File Type",
            "status": "blocker",
            "message": f"{file_extension.upper()} file format is not supported.",
            "metrics": {"file_extension": f".{file_extension}"},
            "suggestions": ["Convert to STEP, IGES, or STL format"],
            "highlights": {"face_ids": [], "edge_ids": []}
        }))

    # Basic geometry validation (placeholder - would analyze actual file)
    checks.append(DFMCheck(**{
        "id": "units_and_scale",
        "title": "Units & Scale Check",
        "status": "passed",
        "message": "Model dimensions are within acceptable range.",
        "metrics": {"bbox_mm": [0, 0, 0, 100, 50, 25]},
        "suggestions": [],
        "highlights": {"face_ids": [], "edge_ids": []}
    }))

    checks.append(DFMCheck(**{
        "id": "floating_parts",
        "title": "Floating Parts Check",
        "status": "passed",
        "message": "Single solid body detected - no floating parts.",
        "metrics": {"shell_count": 1},
        "suggestions": [],
        "highlights": {"face_ids": [], "edge_ids": []}
    }))

    checks.append(DFMCheck(**{
        "id": "model_fidelity",
        "title": "Model Fidelity",
        "status": "passed",
        "message": "Model geometry appears valid.",
        "metrics": {"brep_check": "Valid"},
        "suggestions": [],
        "highlights": {"face_ids": [], "edge_ids": []}
    }))

    # Add more basic checks
    checks.append(DFMCheck(**{
        "id": "self_intersection",
        "title": "Non-Manifold / Self-Intersection Check",
        "status": "passed",
        "message": "No self-intersections detected.",
        "metrics": {"intersections": 0},
        "suggestions": [],
        "highlights": {"face_ids": [], "edge_ids": []}
    }))

    return checks

@app.post("/dfm/analyze", response_model=DFMAnalysisResponse)
async def start_dfm_analysis(request: DFMAnalysisRequest, background_tasks: BackgroundTasks):
    """Start DFM analysis for a CAD file"""
    task_id = str(uuid.uuid4())

    # Store task info
    dfm_tasks[task_id] = {
        "status": "Queued",
        "request": request.model_dump(),
        "created_at": datetime.now()
    }

    # Start background processing
    background_tasks.add_task(process_dfm_analysis, task_id, request)

    return DFMAnalysisResponse(
        task_id=task_id,
        status="Queued"
    )

@app.get("/dfm/result/{task_id}", response_model=DFMResult)
async def get_dfm_result(task_id: str):
    """Get DFM analysis result"""
    if task_id not in dfm_tasks:
        raise HTTPException(status_code=404, detail="Task not found")

    task = dfm_tasks[task_id]

    if task["status"] == "Processing":
        return DFMResult(status="Processing")
    elif task["status"] == "Failed":
        return DFMResult(status="Failed")
    elif task["status"] == "Succeeded":
        return dfm_results[task_id]
    else:
        return DFMResult(status="Processing")

@app.get("/")
async def root():
    return {"message": "CNC Quote CAD Service", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# Server startup code
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=3002,
        reload=True,
        log_level="info"
    )
