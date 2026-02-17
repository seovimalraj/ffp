"""
BRepAdaptor-based face type classification.

Uses OCC's BRepAdaptor_Surface.GetType() to build a face-type histogram
for each part.  This is the single most reliable signal for distinguishing
sheet metal (mostly planes with paired parallel faces at uniform distance)
from CNC parts (mix of planes, cylinders, cones, splines).

The module also computes a *face type distribution score* that downstream
classifiers can use as a first-class signal.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------


@dataclass
class FaceTypeHistogram:
    """Distribution of face types found on the part."""

    plane: int = 0
    cylinder: int = 0
    cone: int = 0
    sphere: int = 0
    torus: int = 0
    bezier: int = 0
    bspline: int = 0
    revolution: int = 0
    extrusion: int = 0
    offset: int = 0
    other: int = 0

    @property
    def total(self) -> int:
        return (
            self.plane
            + self.cylinder
            + self.cone
            + self.sphere
            + self.torus
            + self.bezier
            + self.bspline
            + self.revolution
            + self.extrusion
            + self.offset
            + self.other
        )

    def to_dict(self) -> dict:
        return {
            "plane": self.plane,
            "cylinder": self.cylinder,
            "cone": self.cone,
            "sphere": self.sphere,
            "torus": self.torus,
            "bezier": self.bezier,
            "bspline": self.bspline,
            "revolution": self.revolution,
            "extrusion": self.extrusion,
            "offset": self.offset,
            "other": self.other,
            "total": self.total,
        }


@dataclass
class PlanarPairInfo:
    """Info about a pair of approximately parallel planar faces."""

    face1_area: float
    face2_area: float
    distance: float  # mm between the two planes
    normal: Tuple[float, float, float]


@dataclass
class FaceClassificationResult:
    """Complete result of BRepAdaptor face-type analysis."""

    histogram: FaceTypeHistogram

    # Derived ratios (0-1)
    plane_ratio: float  # fraction of faces that are planar
    cylinder_ratio: float  # fraction that are cylindrical (holes/fillets)
    freeform_ratio: float  # fraction that are BSpline/Bezier/Revolution
    mixed_ratio: float  # 1 - plane_ratio  (cone+sphere+torus+…)

    # Area-weighted variants (more meaningful than simple counts)
    plane_area_ratio: float  # fraction of total area on planes
    cylinder_area_ratio: float

    # Paired-plane analysis (sheet metal signature)
    paired_plane_count: int  # number of plane pairs at uniform distance
    paired_plane_area: float  # total area covered by paired planes (mm²)
    dominant_pair_thickness: Optional[float]  # most common pair distance (mm)

    # Classification hints
    is_likely_sheet_metal: bool  # True when distribution strongly suggests SM
    is_likely_cnc: bool  # True when distribution strongly suggests CNC
    cnc_face_score: float  # 0-100 score for CNC likelihood from faces
    sheet_metal_face_score: float  # 0-100 score for SM likelihood from faces

    reasoning: str

    def to_dict(self) -> dict:
        return {
            "histogram": self.histogram.to_dict(),
            "plane_ratio": round(self.plane_ratio, 4),
            "cylinder_ratio": round(self.cylinder_ratio, 4),
            "freeform_ratio": round(self.freeform_ratio, 4),
            "mixed_ratio": round(self.mixed_ratio, 4),
            "plane_area_ratio": round(self.plane_area_ratio, 4),
            "cylinder_area_ratio": round(self.cylinder_area_ratio, 4),
            "paired_plane_count": self.paired_plane_count,
            "paired_plane_area": round(self.paired_plane_area, 2),
            "dominant_pair_thickness": (
                round(self.dominant_pair_thickness, 3)
                if self.dominant_pair_thickness
                else None
            ),
            "is_likely_sheet_metal": self.is_likely_sheet_metal,
            "is_likely_cnc": self.is_likely_cnc,
            "cnc_face_score": round(self.cnc_face_score, 1),
            "sheet_metal_face_score": round(self.sheet_metal_face_score, 1),
            "reasoning": self.reasoning,
        }


# ---------------------------------------------------------------------------
# Core analysis
# ---------------------------------------------------------------------------


def _try_import_brep_adaptor():
    """Import OCC modules needed for face classification."""
    try:
        from OCC.Core.BRepAdaptor import BRepAdaptor_Surface
        from OCC.Core.TopExp import TopExp_Explorer
        from OCC.Core.TopAbs import TopAbs_FACE
        from OCC.Core.GeomAbs import (
            GeomAbs_Plane,
            GeomAbs_Cylinder,
            GeomAbs_Cone,
            GeomAbs_Sphere,
            GeomAbs_Torus,
            GeomAbs_BezierSurface,
            GeomAbs_BSplineSurface,
            GeomAbs_SurfaceOfRevolution,
            GeomAbs_SurfaceOfExtrusion,
            GeomAbs_OffsetSurface,
            GeomAbs_OtherSurface,
        )
        from OCC.Core.GProp import GProp_GProps
        from OCC.Core.BRepGProp import brepgprop
        from OCC.Core.gp import gp_Pnt, gp_Vec
        from OCC.Core.BRep import BRep_Tool

        return {
            "BRepAdaptor_Surface": BRepAdaptor_Surface,
            "TopExp_Explorer": TopExp_Explorer,
            "TopAbs_FACE": TopAbs_FACE,
            "GeomAbs_Plane": GeomAbs_Plane,
            "GeomAbs_Cylinder": GeomAbs_Cylinder,
            "GeomAbs_Cone": GeomAbs_Cone,
            "GeomAbs_Sphere": GeomAbs_Sphere,
            "GeomAbs_Torus": GeomAbs_Torus,
            "GeomAbs_BezierSurface": GeomAbs_BezierSurface,
            "GeomAbs_BSplineSurface": GeomAbs_BSplineSurface,
            "GeomAbs_SurfaceOfRevolution": GeomAbs_SurfaceOfRevolution,
            "GeomAbs_SurfaceOfExtrusion": GeomAbs_SurfaceOfExtrusion,
            "GeomAbs_OffsetSurface": GeomAbs_OffsetSurface,
            "GeomAbs_OtherSurface": GeomAbs_OtherSurface,
            "GProp_GProps": GProp_GProps,
            "brepgprop": brepgprop,
            "gp_Pnt": gp_Pnt,
            "gp_Vec": gp_Vec,
            "BRep_Tool": BRep_Tool,
        }
    except Exception as exc:
        logger.warning("BRepAdaptor imports unavailable: %s", exc)
        return None


# Map GeomAbs enum → histogram field name
_TYPE_FIELD_MAP: Dict[int, str] = {}  # populated lazily


def _build_type_map(occ: dict) -> Dict[int, str]:
    """Build mapping from GeomAbs_SurfaceType → field name."""
    return {
        occ["GeomAbs_Plane"]: "plane",
        occ["GeomAbs_Cylinder"]: "cylinder",
        occ["GeomAbs_Cone"]: "cone",
        occ["GeomAbs_Sphere"]: "sphere",
        occ["GeomAbs_Torus"]: "torus",
        occ["GeomAbs_BezierSurface"]: "bezier",
        occ["GeomAbs_BSplineSurface"]: "bspline",
        occ["GeomAbs_SurfaceOfRevolution"]: "revolution",
        occ["GeomAbs_SurfaceOfExtrusion"]: "extrusion",
        occ["GeomAbs_OffsetSurface"]: "offset",
    }


def _face_area(face, occ: dict) -> float:
    """Compute the area of a single face."""
    props = occ["GProp_GProps"]()
    occ["brepgprop"].SurfaceProperties(face, props)
    return float(props.Mass())


def _plane_normal_and_d(face, occ: dict):
    """Return (normal_tuple, signed_distance_from_origin) for a planar face.

    Returns ``(None, None)`` if the face is not planar.
    """
    adaptor = occ["BRepAdaptor_Surface"](face)
    if adaptor.GetType() != occ["GeomAbs_Plane"]:
        return None, None
    pln = adaptor.Plane()
    ax = pln.Axis().Direction()
    loc = pln.Location()
    normal = (ax.X(), ax.Y(), ax.Z())
    d = normal[0] * loc.X() + normal[1] * loc.Y() + normal[2] * loc.Z()
    return normal, d


def _normals_antiparallel(n1, n2, tol_deg: float = 5.0) -> bool:
    """Check if two normals are approximately anti-parallel."""
    dot = n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2]
    # Anti-parallel means dot ≈ -1
    return dot < -math.cos(math.radians(tol_deg))


def _normals_parallel(n1, n2, tol_deg: float = 5.0) -> bool:
    """Check if two normals are approximately parallel (same or opposite)."""
    dot = abs(n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2])
    return dot > math.cos(math.radians(tol_deg))


def _find_paired_planes(
    planar_faces: List[dict],
    min_area: float = 100.0,
) -> List[PlanarPairInfo]:
    """Find pairs of approximately parallel planar faces at uniform distances.

    Args:
        planar_faces: list of dicts with keys ``normal``, ``d``, ``area``, ``face``.
        min_area: minimum face area (mm²) to consider.

    Returns:
        list of PlanarPairInfo for detected pairs.
    """
    significant = [f for f in planar_faces if f["area"] >= min_area]
    pairs: List[PlanarPairInfo] = []
    used: set = set()

    for i, f1 in enumerate(significant):
        if i in used:
            continue
        best_j = -1
        best_dist = float("inf")
        for j, f2 in enumerate(significant):
            if j <= i or j in used:
                continue
            if not _normals_parallel(f1["normal"], f2["normal"]):
                continue
            dist = abs(f1["d"] - f2["d"])
            # Distance must be positive and reasonable (0.1 – 50 mm for sheet metal)
            if 0.1 <= dist <= 50.0 and dist < best_dist:
                # Check area similarity — paired faces should be roughly the same size
                area_ratio = min(f1["area"], f2["area"]) / max(f1["area"], f2["area"])
                if area_ratio > 0.3:
                    best_j = j
                    best_dist = dist

        if best_j >= 0:
            f2 = significant[best_j]
            used.add(i)
            used.add(best_j)
            pairs.append(
                PlanarPairInfo(
                    face1_area=f1["area"],
                    face2_area=f2["area"],
                    distance=best_dist,
                    normal=f1["normal"],
                )
            )

    return pairs


# ---------------------------------------------------------------------------
# Main public function
# ---------------------------------------------------------------------------


def classify_faces(shape, total_surface_area: float = 0.0) -> FaceClassificationResult:
    """Classify all B-Rep faces by type using BRepAdaptor_Surface.

    Args:
        shape: OCC TopoDS_Shape
        total_surface_area: known surface area (mm²) — if 0 computed internally.

    Returns:
        FaceClassificationResult with histogram, ratios, paired-plane info,
        and classification hints.
    """
    occ = _try_import_brep_adaptor()
    if occ is None:
        return _empty_result("OCC BRepAdaptor not available")

    type_map = _build_type_map(occ)

    histogram = FaceTypeHistogram()
    planar_faces: List[dict] = []

    # Per-type area accumulators
    area_by_type: Dict[str, float] = {
        "plane": 0.0,
        "cylinder": 0.0,
        "cone": 0.0,
        "sphere": 0.0,
        "torus": 0.0,
        "bezier": 0.0,
        "bspline": 0.0,
        "revolution": 0.0,
        "extrusion": 0.0,
        "offset": 0.0,
        "other": 0.0,
    }
    total_computed_area = 0.0

    # Iterate every face
    exp = occ["TopExp_Explorer"](shape, occ["TopAbs_FACE"])
    while exp.More():
        face = exp.Current()
        exp.Next()
        try:
            adaptor = occ["BRepAdaptor_Surface"](face)
            stype = adaptor.GetType()
            field = type_map.get(stype, "other")
        except Exception:
            field = "other"

        setattr(histogram, field, getattr(histogram, field) + 1)

        try:
            area = _face_area(face, occ)
        except Exception:
            area = 0.0
        area_by_type[field] += area
        total_computed_area += area

        # Collect planar face info for pairing analysis
        if field == "plane":
            normal, d = _plane_normal_and_d(face, occ)
            if normal is not None:
                planar_faces.append(
                    {"normal": normal, "d": d, "area": area, "face": face}
                )

    total_area = total_surface_area if total_surface_area > 0 else total_computed_area
    if total_area <= 0:
        total_area = 1.0  # avoid division by zero

    total_faces = histogram.total or 1

    # Ratios
    plane_ratio = histogram.plane / total_faces
    cylinder_ratio = histogram.cylinder / total_faces
    freeform_count = histogram.bezier + histogram.bspline + histogram.revolution
    freeform_ratio = freeform_count / total_faces
    mixed_ratio = 1.0 - plane_ratio

    plane_area_ratio = area_by_type["plane"] / total_area
    cylinder_area_ratio = area_by_type["cylinder"] / total_area

    # Paired-plane analysis
    pairs = _find_paired_planes(planar_faces)
    paired_area = sum(p.face1_area + p.face2_area for p in pairs)

    # Dominant pair thickness
    dominant_thickness: Optional[float] = None
    if pairs:
        # Pick thickness with most paired area
        thickness_areas: Dict[float, float] = {}
        for p in pairs:
            rounded = round(p.distance, 2)
            thickness_areas[rounded] = thickness_areas.get(rounded, 0) + (
                p.face1_area + p.face2_area
            )
        dominant_thickness = max(thickness_areas, key=thickness_areas.get)  # type: ignore[arg-type]

    # Score calculation
    sm_score, cnc_score, reasoning_parts = _compute_scores(
        plane_ratio,
        plane_area_ratio,
        cylinder_ratio,
        cylinder_area_ratio,
        freeform_ratio,
        histogram,
        len(pairs),
        paired_area,
        total_area,
        dominant_thickness,
    )

    is_sm = sm_score >= 60 and sm_score > cnc_score
    is_cnc = cnc_score >= 55 and cnc_score > sm_score

    reasoning = "; ".join(reasoning_parts)

    logger.info(
        "Face classification: %d faces, plane=%.0f%%, cyl=%.0f%%, "
        "freeform=%.0f%%, pairs=%d, SM=%.0f, CNC=%.0f — %s",
        total_faces,
        plane_ratio * 100,
        cylinder_ratio * 100,
        freeform_ratio * 100,
        len(pairs),
        sm_score,
        cnc_score,
        "sheet_metal" if is_sm else ("cnc" if is_cnc else "uncertain"),
    )

    return FaceClassificationResult(
        histogram=histogram,
        plane_ratio=plane_ratio,
        cylinder_ratio=cylinder_ratio,
        freeform_ratio=freeform_ratio,
        mixed_ratio=mixed_ratio,
        plane_area_ratio=plane_area_ratio,
        cylinder_area_ratio=cylinder_area_ratio,
        paired_plane_count=len(pairs),
        paired_plane_area=paired_area,
        dominant_pair_thickness=dominant_thickness,
        is_likely_sheet_metal=is_sm,
        is_likely_cnc=is_cnc,
        cnc_face_score=cnc_score,
        sheet_metal_face_score=sm_score,
        reasoning=reasoning,
    )


# ---------------------------------------------------------------------------
# Score helpers
# ---------------------------------------------------------------------------


def _compute_scores(
    plane_ratio: float,
    plane_area_ratio: float,
    cylinder_ratio: float,
    cylinder_area_ratio: float,
    freeform_ratio: float,
    histogram: FaceTypeHistogram,
    pair_count: int,
    paired_area: float,
    total_area: float,
    dominant_thickness: Optional[float],
) -> Tuple[float, float, List[str]]:
    """Compute sheet-metal and CNC scores from face distribution.

    Returns (sm_score, cnc_score, reasoning_parts).
    """
    sm = 0.0
    cnc = 0.0
    reasons: List[str] = []

    # --- Plane ratio ---
    if plane_ratio >= 0.85:
        sm += 30
        reasons.append(f"very high plane ratio ({plane_ratio:.0%})")
    elif plane_ratio >= 0.70:
        sm += 20
        reasons.append(f"high plane ratio ({plane_ratio:.0%})")
    elif plane_ratio >= 0.50:
        sm += 10
    else:
        cnc += 15
        reasons.append(f"low plane ratio ({plane_ratio:.0%})")

    # --- Area-weighted plane ratio ---
    if plane_area_ratio >= 0.80:
        sm += 15
    elif plane_area_ratio >= 0.60:
        sm += 8
    else:
        cnc += 10

    # --- Cylinder ratio (holes, fillets, bosses) ---
    if cylinder_ratio >= 0.25:
        cnc += 25
        reasons.append(f"many cylindrical faces ({cylinder_ratio:.0%})")
    elif cylinder_ratio >= 0.15:
        cnc += 15
    elif cylinder_ratio >= 0.05:
        cnc += 5
    else:
        sm += 5

    # --- Freeform surfaces (BSpline, Bezier, Revolution) ---
    if freeform_ratio >= 0.15:
        cnc += 20
        reasons.append(f"freeform surfaces ({freeform_ratio:.0%})")
    elif freeform_ratio >= 0.05:
        cnc += 10
    else:
        sm += 5

    # --- Cone faces (chamfers, tapers) ---
    if histogram.cone >= 4:
        cnc += 10
        reasons.append(f"{histogram.cone} cone faces (chamfers)")
    elif histogram.cone >= 1:
        cnc += 3

    # --- Torus faces (fillet radii in machined parts) ---
    if histogram.torus >= 4:
        cnc += 10
    elif histogram.torus >= 1:
        cnc += 3

    # --- Paired-plane analysis (sheet metal signature) ---
    if pair_count >= 3:
        sm += 20
        reasons.append(f"{pair_count} planar pairs at uniform distance")
    elif pair_count >= 1:
        sm += 10

    paired_area_ratio = paired_area / total_area if total_area > 0 else 0
    if paired_area_ratio >= 0.50:
        sm += 15
        reasons.append(f"paired planes cover {paired_area_ratio:.0%} of area")
    elif paired_area_ratio >= 0.30:
        sm += 8

    # --- Dominant pair thickness (sheet metal gauge) ---
    if dominant_thickness is not None:
        if 0.4 <= dominant_thickness <= 8.0:
            sm += 10
            reasons.append(f"dominant pair thickness {dominant_thickness:.2f}mm in sheet range")
        elif dominant_thickness > 8.0:
            cnc += 10
            reasons.append(f"thick pairs ({dominant_thickness:.1f}mm) suggest CNC")

    # --- Total face count heuristic ---
    # CNC parts tend to have many more faces than sheet metal
    total = histogram.total
    if total > 200 and cylinder_ratio > 0.1:
        cnc += 5
    elif total < 30 and plane_ratio > 0.7:
        sm += 5

    return sm, cnc, reasons


def _empty_result(reason: str) -> FaceClassificationResult:
    """Return an empty result when analysis is not possible."""
    return FaceClassificationResult(
        histogram=FaceTypeHistogram(),
        plane_ratio=0.0,
        cylinder_ratio=0.0,
        freeform_ratio=0.0,
        mixed_ratio=1.0,
        plane_area_ratio=0.0,
        cylinder_area_ratio=0.0,
        paired_plane_count=0,
        paired_plane_area=0.0,
        dominant_pair_thickness=None,
        is_likely_sheet_metal=False,
        is_likely_cnc=False,
        cnc_face_score=0.0,
        sheet_metal_face_score=0.0,
        reasoning=reason,
    )
