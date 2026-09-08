"""Dominant sheet thickness + uniformity, from paired planar faces.

Ported from ``app.core.advanced_thickness_detection``'s
``enhanced_ray_casting_analysis`` / ``AdvancedThicknessDetector``: the same
"cluster the separations between opposed skin faces, trust the
largest-supported-area cluster" approach, but measured directly on the B-Rep
via :func:`app.sheet_metal.detectors.sheet_candidate.find_opposed_planar_pairs`
instead of trimesh ray-casting.

Why not trimesh/ray-casting here
---------------------------------
The legacy detector reaches for ray-casting because it starts from a
triangulated mesh with no face identity - ray-casting is the only way to
*discover* wall separations on a mesh. This package instead keeps the B-Rep's
face identity all the way through (``ShapeModel``/``FaceRecord``), so the
exact-geometry face-pairing approach (also used by
``app.machining.stock_form.find_sheet_stock``) is available and strictly more
precise: it reports the analytic gap between two real surfaces rather than a
statistical sample of ray hits, with no sampling-density tuning and no
watertight-mesh requirement. Trimesh/ray-casting is intentionally not used;
if a future part shape defeats the planar-pairing approach (e.g. a sheet
metal part whose skins are found only as dense free-form/NURBS surfaces
with no OCCT-planar classification), that would be the trigger to add a
ray-cast fallback - not needed for the fixtures/geometry this phase targets.
"""

from __future__ import annotations

from typing import Optional

from ...machining.records import ShapeModel
from ..config import SheetMetalConfig
from ..schemas import ThicknessInfo
from .sheet_candidate import cluster_pairs, dominant_cluster, find_opposed_planar_pairs

#: Same absolute/relative family as sheet_candidate's clustering tolerance.
_CLUSTER_TOL_ABS_MM = 0.1

#: A cluster whose relative spread exceeds this is reported as non-uniform.
_UNIFORMITY_REL_TOL = 0.08


def detect_thickness(model: ShapeModel, config: SheetMetalConfig) -> ThicknessInfo:
    """Estimate dominant wall thickness and its uniformity.

    Never raises: an inconclusive part gets a ``ThicknessInfo`` with
    ``dominant_thickness_mm=None`` and a clear ``note``, matching the
    candidate detector's "no hard failures" contract.
    """
    max_gap = config.max_sheet_thickness_mm * 1.5
    pairs = find_opposed_planar_pairs(model, min_gap=config.linear_tolerance_mm, max_gap=max_gap)
    if not pairs:
        return ThicknessInfo(
            dominant_thickness_mm=None,
            is_uniform=None,
            variance_mm=None,
            method="paired_planar_faces",
            sample_count=0,
            note="No opposed planar face pairs found - thickness could not be measured.",
        )

    clusters = cluster_pairs(pairs, tol_mm=max(_CLUSTER_TOL_ABS_MM, config.linear_tolerance_mm))
    dominant = dominant_cluster(clusters)
    assert dominant is not None

    variance = dominant.std_dev_mm ** 2
    relative_spread = (
        dominant.std_dev_mm / dominant.thickness_mm if dominant.thickness_mm > 0 else 1.0
    )
    is_uniform = relative_spread <= _UNIFORMITY_REL_TOL

    note: Optional[str]
    if is_uniform:
        note = (
            f"Dominant thickness {dominant.thickness_mm:.3f} mm from "
            f"{dominant.pair_count} paired face(s), std dev "
            f"{dominant.std_dev_mm:.4f} mm ({relative_spread:.1%} of thickness)."
        )
    else:
        note = (
            f"Dominant thickness {dominant.thickness_mm:.3f} mm is not uniform: "
            f"std dev {dominant.std_dev_mm:.4f} mm is {relative_spread:.1%} of "
            "thickness across the paired faces."
        )

    return ThicknessInfo(
        dominant_thickness_mm=round(dominant.thickness_mm, config.length_decimals),
        is_uniform=is_uniform,
        variance_mm=round(variance, 6),
        method="paired_planar_faces",
        sample_count=dominant.pair_count,
        note=note,
    )
