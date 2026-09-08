"""Sheet-metal candidate scoring - is this solid a formed/flat sheet part?

Ported from ``app.core.classification.calculate_sheet_metal_score`` and the
face-pairing evidence in ``app.machining.stock_form.find_sheet_stock`` /
``app.core.advanced_thickness_detection`` (their common insight: a sheet part
is defined by *opposed, parallel, closely-spaced "skin" faces that dominate
the surface area*, not by the bounding box alone - a bent bracket has the
bounding-box proportions of a solid block, but its walls still read as thin).

Adapted here to the ``ShapeModel``/``FaceRecord`` intermediate representation
that ``app.sheet_metal.service`` already builds via the reused
``app.machining.topology.TopologyAnalyzer`` - no OCC/OCP import, no trimesh,
pure Python over the flattened B-Rep, so every function is unit-testable with
synthetic faces and no CAD kernel installed.

Algorithm
---------
1. Collect every planar face with a resolved normal.
2. Pair up faces that face away from each other (near-antiparallel normals),
   overlap when projected into the shared plane, and sit a plausible
   "sheet wall" distance apart (``> linear_tolerance_mm``, up to a generous
   multiple of ``max_sheet_thickness_mm`` so a still-uncertain thickness is
   never pre-filtered away).
3. Cluster the pair separations (a part has one thickness; several clusters
   usually means "this isn't sheet metal" or "multiple detected wall
   thicknesses on a stepped/pocketed CNC part").
4. The dominant cluster (by supporting area, not by count - a handful of
   large skin faces should outweigh many small tab edges) gives the candidate
   thickness and its ``paired_area_fraction`` of total surface area.
5. ``flatness_ratio`` = dominant thickness / largest planar in-plane extent
   seen on any face in the dominant pair set - how "sheet-like" the part's
   proportions are, independent of the bounding box (which folding disrupts).
6. Confidence blends: paired-area coverage, thinness (thickness vs. the
   model's largest planar extent) and cluster dominance, mirroring
   ``advanced_thickness_detection._evaluate_sheet_criteria``'s weighting.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Sequence, Tuple

from ...machining.records import PLANE, FaceRecord, ShapeModel
from ...machining.vectors import (
    Vec,
    cluster_values,
    dot,
    normalize,
    perpendicular_basis,
    sub,
)
from ..config import SheetMetalConfig
from ..schemas import SheetMetalCandidate, SheetMetalCandidateEvidence

#: Antiparallel dot-product threshold for "these two faces face away from
#: each other" - mirrors ``app.machining.detectors.shared.opposed_planar_pairs``.
_ANTIPARALLEL_DOT_MAX = -0.98

#: Above this, distinct thickness clusters are treated as genuinely separate
#: (5% relative or 0.1mm, whichever is larger) - same tolerance family as
#: ``AdvancedThicknessDetector.THICKNESS_CONSISTENCY_*`` in the legacy module.
_CLUSTER_TOL_ABS_MM = 0.1


@dataclass
class PlanarPair:
    """One pair of opposed, overlapping planar faces and their separation."""

    face_a: FaceRecord
    face_b: FaceRecord
    gap_mm: float
    support_area_mm2: float


@dataclass
class ThicknessCluster:
    """Pairs grouped by similar separation - candidate wall thicknesses."""

    thickness_mm: float
    support_area_mm2: float
    pair_count: int
    std_dev_mm: float
    pairs: List[PlanarPair] = field(default_factory=list)


def _bbox_corners(face: FaceRecord) -> List[Vec]:
    (x0, y0, z0), (x1, y1, z1) = face.bbox_min, face.bbox_max
    return [(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]


def _projected_extent(face: FaceRecord, axis: Vec) -> Tuple[float, float]:
    projections = [dot(corner, axis) for corner in _bbox_corners(face)]
    return min(projections), max(projections)


def _faces_overlap_in_plane(a: FaceRecord, b: FaceRecord, normal: Vec) -> bool:
    """True when the two faces' bounding boxes overlap in the plane perpendicular
    to ``normal`` - i.e. they could plausibly be the two skins of the same wall,
    not two unrelated faces that merely happen to be parallel and close."""
    u, v = perpendicular_basis(normal)
    for axis in (u, v):
        a_lo, a_hi = _projected_extent(a, axis)
        b_lo, b_hi = _projected_extent(b, axis)
        if a_hi < b_lo or b_hi < a_lo:
            return False
    return True


def _planar_in_plane_extent(face: FaceRecord, normal: Vec) -> float:
    """Larger of the face's two in-plane bounding extents."""
    u, v = perpendicular_basis(normal)
    u_lo, u_hi = _projected_extent(face, u)
    v_lo, v_hi = _projected_extent(face, v)
    return max(u_hi - u_lo, v_hi - v_lo)


def find_opposed_planar_pairs(
    model: ShapeModel, min_gap: float, max_gap: float
) -> List[PlanarPair]:
    """Pairs of planar faces that plausibly form the two sides of one wall.

    Deterministic (ascending by face id) so repeated runs and tests agree
    exactly.
    """
    planar = sorted(
        (f for f in model.faces.values() if f.surface_type == PLANE and f.normal is not None),
        key=lambda f: f.id,
    )
    pairs: List[PlanarPair] = []
    for index, face_a in enumerate(planar):
        normal_a = normalize(face_a.normal)  # type: ignore[arg-type]
        for face_b in planar[index + 1 :]:
            normal_b = normalize(face_b.normal)  # type: ignore[arg-type]
            if dot(normal_a, normal_b) > _ANTIPARALLEL_DOT_MAX:
                continue
            gap = abs(dot(sub(face_b.centroid, face_a.centroid), normal_a))
            if gap <= min_gap or gap >= max_gap:
                continue
            if not _faces_overlap_in_plane(face_a, face_b, normal_a):
                continue
            support_area = min(face_a.area_mm2, face_b.area_mm2)
            pairs.append(PlanarPair(face_a, face_b, gap, support_area))
    return pairs


def cluster_pairs(pairs: Sequence[PlanarPair], tol_mm: float) -> List[ThicknessCluster]:
    """Group pairs by similar separation into candidate wall thicknesses."""
    if not pairs:
        return []
    ordered = sorted(pairs, key=lambda p: p.gap_mm)
    groups: List[List[PlanarPair]] = []
    for pair in ordered:
        if groups and abs(pair.gap_mm - groups[-1][-1].gap_mm) <= tol_mm:
            groups[-1].append(pair)
        else:
            groups.append([pair])

    clusters: List[ThicknessCluster] = []
    for group in groups:
        gaps = [p.gap_mm for p in group]
        mean = sum(gaps) / len(gaps)
        variance = sum((g - mean) ** 2 for g in gaps) / len(gaps)
        std_dev = variance ** 0.5
        support_area = sum(p.support_area_mm2 for p in group)
        clusters.append(
            ThicknessCluster(
                thickness_mm=mean,
                support_area_mm2=support_area,
                pair_count=len(group),
                std_dev_mm=std_dev,
                pairs=group,
            )
        )
    return clusters


def dominant_cluster(clusters: Sequence[ThicknessCluster]) -> Optional[ThicknessCluster]:
    """The cluster with the most supporting area - the candidate wall thickness."""
    if not clusters:
        return None
    return max(clusters, key=lambda c: c.support_area_mm2)


def _second_best_area(clusters: Sequence[ThicknessCluster], dominant: ThicknessCluster) -> float:
    others = [c.support_area_mm2 for c in clusters if c is not dominant]
    return max(others) if others else 0.0


def detect_sheet_candidate(
    model: ShapeModel, config: SheetMetalConfig
) -> SheetMetalCandidate:
    """Score whether ``model`` looks like a sheet-metal part.

    A rejection is never a hard failure for the pipeline - see
    :class:`~app.sheet_metal.schemas.SheetMetalCandidate`'s docstring - so this
    always returns a populated schema object with a ``reason``, never raises
    on "this isn't sheet metal".
    """
    total_area = sum(f.area_mm2 for f in model.faces.values())
    if total_area <= 0:
        return SheetMetalCandidate(
            is_candidate=False,
            confidence=0.0,
            status="rejected",
            reason="Model has no measurable surface area.",
        )

    # Generous upper bound so a thickness right at the configured limit is
    # still visible to the clustering step rather than silently filtered out.
    max_gap = config.max_sheet_thickness_mm * 1.5
    pairs = find_opposed_planar_pairs(model, min_gap=config.linear_tolerance_mm, max_gap=max_gap)

    if not pairs:
        return SheetMetalCandidate(
            is_candidate=False,
            confidence=0.0,
            evidence=SheetMetalCandidateEvidence(method="paired_planar_faces"),
            status="rejected",
            reason=(
                "No opposed, overlapping planar face pairs found within a "
                f"plausible sheet-thickness gap (0, {max_gap:.2f} mm) - the "
                "part does not present a thin wall."
            ),
        )

    clusters = cluster_pairs(pairs, tol_mm=max(_CLUSTER_TOL_ABS_MM, config.linear_tolerance_mm))
    dominant = dominant_cluster(clusters)
    assert dominant is not None  # pairs is non-empty, so clusters is too

    paired_area_fraction = min(1.0, dominant.support_area_mm2 / total_area)
    largest_extent = max(
        (
            _planar_in_plane_extent(p.face_a, p.face_a.normal)  # type: ignore[arg-type]
            for p in dominant.pairs
        ),
        default=0.0,
    )
    flatness_ratio = (dominant.thickness_mm / largest_extent) if largest_extent > 0 else None

    evidence = SheetMetalCandidateEvidence(
        paired_area_fraction=round(paired_area_fraction, 4),
        flatness_ratio=round(flatness_ratio, 6) if flatness_ratio is not None else None,
        dominant_thickness_mm=round(dominant.thickness_mm, config.length_decimals),
        method="paired_planar_faces",
    )

    in_thickness_range = (
        config.min_sheet_thickness_mm <= dominant.thickness_mm <= config.max_sheet_thickness_mm
    )
    second_best = _second_best_area(clusters, dominant)
    cluster_dominance = (
        dominant.support_area_mm2 / second_best if second_best > 0 else float("inf")
    )

    confidence = 0.0
    reasons: List[str] = []

    if paired_area_fraction >= config.paired_face_area_fraction_threshold:
        confidence += 0.4
        reasons.append(f"paired area fraction {paired_area_fraction:.1%} meets threshold")
    elif paired_area_fraction >= config.paired_face_area_fraction_threshold * 0.6:
        confidence += 0.2
        reasons.append(f"paired area fraction {paired_area_fraction:.1%} is moderate")
    else:
        reasons.append(f"paired area fraction {paired_area_fraction:.1%} is low")

    if in_thickness_range:
        confidence += 0.3
        reasons.append(f"dominant thickness {dominant.thickness_mm:.2f} mm is in sheet range")
    else:
        reasons.append(
            f"dominant thickness {dominant.thickness_mm:.2f} mm is outside "
            f"[{config.min_sheet_thickness_mm}, {config.max_sheet_thickness_mm}] mm"
        )

    if flatness_ratio is not None and flatness_ratio <= 0.1:
        confidence += 0.2
        reasons.append(f"flat profile (thickness/extent={flatness_ratio:.3f})")
    elif flatness_ratio is not None:
        reasons.append(f"moderately flat profile (thickness/extent={flatness_ratio:.3f})")

    if cluster_dominance >= 1.8:
        confidence += 0.1
        reasons.append(f"dominant cluster {cluster_dominance:.1f}x the next-best")
    else:
        reasons.append(f"weak cluster dominance ({cluster_dominance:.1f}x)")

    confidence = max(0.0, min(1.0, confidence))
    is_candidate = in_thickness_range and paired_area_fraction >= (
        config.paired_face_area_fraction_threshold * 0.6
    )

    if is_candidate and paired_area_fraction < config.paired_face_area_fraction_threshold:
        status = "ambiguous"
        reason = (
            "Thickness is in the sheet-metal range but paired-face area "
            "coverage is below the configured threshold: " + "; ".join(reasons)
        )
    elif is_candidate:
        status = "resolved"
        reason = "; ".join(reasons)
    else:
        status = "rejected"
        reason = "Not a sheet-metal candidate: " + "; ".join(reasons)

    return SheetMetalCandidate(
        is_candidate=is_candidate,
        confidence=round(confidence, 4),
        evidence=evidence,
        status=status,
        reason=reason,
    )
