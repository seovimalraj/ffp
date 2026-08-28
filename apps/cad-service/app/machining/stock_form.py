"""Stock-form classification: sheet, plate, or bar, from the part envelope.

The question this answers is deliberately narrow: *what mill form does this
envelope resemble?* A part 200 x 150 x 3 mm could be cut from sheet; one
300 mm long on a 20 mm circular section could be turned from round bar. That
is a statement about proportions and surfaces, both of which the kernel
measured.

It is emphatically **not** a purchasing decision. Whether that sheet exists in
the required alloy, whether plate is cheaper than a sawn billet at this
quantity, whether the shop stocks 20 mm round - none of that is geometry, and
none of it is decided here.

Flat stock is settled on extent ratios; everything else is checked for being a
body of revolution before the remaining ratios get a say, because a ring and a
square block have much the same proportions.

Two things make the classification honest rather than a guess:

* Every cutoff lives in :class:`~app.machining.config.MachiningConfig`, so what
  counts as "sheet" is declared configuration, not a magic number buried in a
  branch.
* When a ratio sits within a configurable margin of the cutoff that decides it,
  the result comes back ``ambiguous`` with both candidates and a reason, the
  same contract the feature detectors follow.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional, Tuple

from .config import MachiningConfig
from .detectors.shared import group_coaxial, opposed_planar_pairs
from .records import CYLINDER, PLANE, FaceRecord, ShapeModel
from .schemas import (
    FeatureStatus,
    RoundStockEvidence,
    SheetEvidence,
    StockDimensions,
    StockForm,
    StockFormKind,
)
from .vectors import Vec, cluster_values, dot, is_parallel, normalize

logger = logging.getLogger(__name__)

#: Angular tolerance accepting a cylinder axis as running along the part.
_AXIS_PARALLEL_TOL_DEG = 10.0

#: The wall scan is O(planar faces squared); mirrors the thin-wall scan cap.
_MAX_PLANAR_FACES_FOR_SHEET_SCAN = 1500


def _near(value: float, threshold: float, margin: float) -> bool:
    """True when ``value`` sits within a relative ``margin`` of ``threshold``."""
    if threshold <= 0:
        return False
    return abs(value - threshold) / threshold <= margin


def _long_axis(model: ShapeModel, longest: int, method: str) -> Vec:
    """Unit direction of the largest extent, in world coordinates."""
    if method == "obb" and model.obb_axes is not None:
        return normalize(model.obb_axes[longest])
    basis: List[Vec] = [(1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0)]
    return basis[longest]


def _box_axes(model: ShapeModel, method: str) -> List[Vec]:
    """The three envelope directions, oriented or world-aligned."""
    if method == "obb" and model.obb_axes is not None:
        return [normalize(axis) for axis in model.obb_axes]
    return [(1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0)]


def _axial_extent(face: FaceRecord) -> float:
    """How far a cylindrical face runs along its own axis."""
    extent = face.axial_extent_mm
    if extent is not None and extent > 0:
        return float(extent)
    # Fall back to the face's own bounding box when the classifier could not
    # resolve a parametric extent.
    size = face.bbox_size
    return max(abs(v) for v in size) if size else 0.0


def _axial_interval(face: FaceRecord, axis: Vec) -> Tuple[float, float]:
    """Where a cylindrical face starts and ends along ``axis``.

    A cylinder is symmetric about its centroid along its own axis, so the
    centroid projection plus half the extent bounds it.
    """
    half = _axial_extent(face) / 2.0
    center = dot(face.centroid, axis)
    return center - half, center + half


def _union_length(intervals: List[Tuple[float, float]]) -> float:
    """Total length covered by possibly overlapping intervals."""
    if not intervals:
        return 0.0
    total = 0.0
    current_start, current_end = None, None
    for start, end in sorted(intervals):
        if current_end is None:
            current_start, current_end = start, end
            continue
        if start > current_end:
            total += current_end - current_start
            current_start, current_end = start, end
        else:
            current_end = max(current_end, end)
    if current_end is not None and current_start is not None:
        total += current_end - current_start
    return total


def find_sheet_stock(
    model: ShapeModel,
    envelope_thickness: float,
    config: MachiningConfig,
) -> Optional[SheetEvidence]:
    """Detect a part made from sheet, including one that has been formed.

    A bent bracket or a drawn enclosure has the envelope of a block - folding
    is exactly what destroys the flat proportions - so extent ratios can never
    recognise it. What survives forming is the *wall*: a constant, small
    thickness over most of the part.

    So opposed planar faces are paired, their separations clustered, and the
    dominant cluster taken as the wall thickness. It only counts as sheet when
    those walls account for most of the planar area; a solid block with one
    thin web has a dominant separation too, but almost none of its area sits on
    it.
    """
    planar = [
        face
        for face in model.faces.values()
        if face.surface_type == PLANE and face.normal is not None
    ]
    if len(planar) > _MAX_PLANAR_FACES_FOR_SHEET_SCAN:
        logger.debug(
            "%s planar faces exceed the sheet-wall scan limit - skipped",
            len(planar),
        )
        return None

    # Measured against the *whole* surface, not just the planar part of it.
    # On real sheet metal the two skin faces dominate every other surface; on a
    # turned pin the end faces and shoulders are almost all of the planar area
    # but a small share of the total, which is what keeps it out of here.
    total_area = sum(face.area_mm2 for face in model.faces.values())
    if total_area <= 0:
        return None

    pairs = opposed_planar_pairs(
        planar,
        min_gap=config.linear_tolerance_mm,
        max_gap=config.stock_form_sheet_max_thickness_mm,
    )
    if not pairs:
        return None

    # One part, one sheet thickness: the dominant cluster is the wall.
    clusters = cluster_values(
        (gap for _a, _b, gap in pairs), config.stock_form_wall_cluster_tol_mm
    )
    best_faces: Dict[int, FaceRecord] = {}
    best_thickness = 0.0
    best_area = 0.0
    for cluster in clusters:
        low, high = cluster[0], cluster[-1]
        faces = {
            face.id: face
            for face_a, face_b, gap in pairs
            if low <= gap <= high
            for face in (face_a, face_b)
        }
        area = sum(face.area_mm2 for face in faces.values())
        if area > best_area:
            best_area = area
            best_faces = faces
            best_thickness = sum(cluster) / len(cluster)

    fraction = min(1.0, best_area / total_area)
    if fraction < config.stock_form_sheet_wall_area_fraction:
        return None
    if best_thickness <= 0:
        return None

    return SheetEvidence(
        wall_thickness_mm=round(best_thickness, config.length_decimals),
        paired_area_fraction=round(fraction, 4),
        formed=envelope_thickness
        >= best_thickness * config.stock_form_formed_envelope_ratio,
    )


def find_round_stock(
    model: ShapeModel,
    extents: Vec,
    bounds_method: str,
    config: MachiningConfig,
) -> Optional[Tuple[RoundStockEvidence, int]]:
    """Detect a part that would be cut from round bar, and say about which axis.

    Two things make this harder than matching one cylinder:

    * **The rotational axis is not always the long one.** A ring, washer,
      flange or disc turns about its *shortest* extent. Probing only the long
      axis makes every such part read as a block.
    * **The outside diameter is rarely one face.** A stepped shaft carries
      several diameters, and grooves and shoulders split even a plain bar. So
      coaxial faces are grouped, their axial intervals unioned, and the stock
      diameter taken as the group's *largest* radius.

    A group qualifies when the two extents across its axis are equal (a round
    cross-section), the largest diameter fills that cross-section, and the
    faces together span most of the extent along the axis. Returns the evidence
    and the index of the envelope axis the part turns about.
    """
    candidates = [
        face
        for face in model.faces_of_type(CYLINDER)
        if not face.is_internal
        and face.axis is not None
        and face.radius_mm is not None
        and face.radius_mm > 0
    ]
    if not candidates:
        return None

    axes = _box_axes(model, bounds_method)
    best: Optional[Tuple[RoundStockEvidence, int, float]] = None

    for group in group_coaxial(candidates, config):
        direction = normalize(group[0].axis or (0.0, 0.0, 1.0))

        # Measure along the envelope axis this group turns about; without a
        # match there is no cross-section to compare the diameter against.
        axis_index = next(
            (
                index
                for index, axis in enumerate(axes)
                if is_parallel(direction, axis, _AXIS_PARALLEL_TOL_DEG)
            ),
            None,
        )
        if axis_index is None:
            continue

        along = extents[axis_index]
        across = [extents[i] for i in range(3) if i != axis_index]
        if along <= 0 or min(across) <= 0:
            continue

        # A round cross-section is as wide as it is tall.
        if (max(across) - min(across)) / max(across) > config.stock_form_squareness_tol:
            continue

        radius = max(float(face.radius_mm or 0.0) for face in group)
        if not _near(
            radius * 2.0, max(across), config.stock_form_round_radius_tol
        ):
            continue

        coverage = min(
            1.0,
            _union_length([_axial_interval(f, direction) for f in group]) / along,
        )
        if coverage < config.stock_form_round_axial_coverage:
            continue

        largest = max(group, key=lambda f: float(f.radius_mm or 0.0))
        evidence = RoundStockEvidence(
            face_id=largest.id,
            radius_mm=round(radius, config.length_decimals),
            axis=[round(v, 6) for v in direction],
            axial_coverage=round(coverage, 4),
        )
        if best is None or coverage > best[2]:
            best = (evidence, axis_index, coverage)

    return None if best is None else (best[0], best[1])


class StockFormClassifier:
    """Classifies the envelope into a mill form from ratios and face evidence."""

    def __init__(self, config: MachiningConfig):
        self.config = config

    def classify(self, model: ShapeModel) -> Optional[StockForm]:
        extents, bounds_method = model.extents
        if min(extents) <= 0:
            logger.warning(
                "Degenerate extents %s - stock form classification skipped", extents
            )
            return None

        length, width, thickness = sorted(extents, reverse=True)

        cfg = self.config
        flatness = thickness / width
        slenderness = width / length
        cross_section = (width - thickness) / width
        margin = cfg.stock_form_ambiguity_margin

        form: StockFormKind
        candidates: List[StockFormKind] = []
        reason: Optional[str] = None

        is_flat = flatness <= cfg.stock_form_flat_ratio_max
        is_slender = slenderness <= cfg.stock_form_bar_ratio_max
        is_square_section = cross_section <= cfg.stock_form_squareness_tol

        # Flat stock is decided first: a laser-cut washer comes off sheet
        # whatever its outline, so a round profile does not override flatness.
        if is_flat:
            thin = (
                thickness <= cfg.stock_form_sheet_max_thickness_mm
                and flatness <= cfg.stock_form_sheet_ratio_max
            )
            form = StockFormKind.SHEET if thin else StockFormKind.PLATE
            if _near(thickness, cfg.stock_form_sheet_max_thickness_mm, margin) or _near(
                flatness, cfg.stock_form_sheet_ratio_max, margin
            ):
                candidates = [StockFormKind.SHEET, StockFormKind.PLATE]
                reason = (
                    f"Thickness {thickness:.3f} mm and thickness/width ratio "
                    f"{flatness:.4f} sit on the sheet/plate boundary "
                    f"({cfg.stock_form_sheet_max_thickness_mm} mm, "
                    f"{cfg.stock_form_sheet_ratio_max})."
                )
            elif _near(flatness, cfg.stock_form_flat_ratio_max, margin):
                candidates = [StockFormKind.PLATE, StockFormKind.BLOCK]
                reason = (
                    f"Thickness/width ratio {flatness:.4f} sits on the "
                    f"plate/block boundary ({cfg.stock_form_flat_ratio_max})."
                )
            return self._build(
                form,
                reason,
                candidates,
                bounds_method,
                (length, width, thickness),
                flatness,
                slenderness,
                cross_section,
                None,
            )

        # A formed part - a bent bracket, a drawn enclosure - has the envelope
        # of a block, so its wall is the only thing left that says "sheet".
        sheet = find_sheet_stock(model, thickness, cfg)
        if sheet is not None:
            return self._build(
                StockFormKind.SHEET,
                None,
                [],
                bounds_method,
                (length, width, thickness),
                flatness,
                slenderness,
                cross_section,
                None,
                sheet,
            )

        # A body of revolution is round stock whichever extent it turns about -
        # a ring turns about its shortest one - so this is settled on face
        # evidence before the extent ratios get a say.
        round_stock = find_round_stock(model, extents, bounds_method, cfg)
        if round_stock is not None:
            evidence, _axis_index = round_stock
            return self._build(
                StockFormKind.ROUND_BAR,
                None,
                [],
                bounds_method,
                (length, width, thickness),
                flatness,
                slenderness,
                cross_section,
                evidence,
            )

        if is_slender:
            form = (
                StockFormKind.SQUARE_BAR
                if is_square_section
                else StockFormKind.RECTANGULAR_BAR
            )
            if _near(slenderness, cfg.stock_form_bar_ratio_max, margin):
                candidates = [form, StockFormKind.BLOCK]
                reason = (
                    f"Width/length ratio {slenderness:.4f} sits on the bar/block "
                    f"boundary ({cfg.stock_form_bar_ratio_max})."
                )
            elif is_square_section and _near(
                cross_section, cfg.stock_form_squareness_tol, margin
            ):
                candidates = [form, StockFormKind.RECTANGULAR_BAR]
                reason = (
                    f"Cross-section ratio {cross_section:.4f} sits on the "
                    f"square/rectangular boundary ({cfg.stock_form_squareness_tol})."
                )
        else:
            form = StockFormKind.BLOCK
            if _near(flatness, cfg.stock_form_flat_ratio_max, margin):
                candidates = [StockFormKind.BLOCK, StockFormKind.PLATE]
                reason = (
                    f"Thickness/width ratio {flatness:.4f} sits on the "
                    f"plate/block boundary ({cfg.stock_form_flat_ratio_max})."
                )
            elif _near(slenderness, cfg.stock_form_bar_ratio_max, margin):
                candidates = [StockFormKind.BLOCK, StockFormKind.RECTANGULAR_BAR]
                reason = (
                    f"Width/length ratio {slenderness:.4f} sits on the bar/block "
                    f"boundary ({cfg.stock_form_bar_ratio_max})."
                )

        return self._build(
            form,
            reason,
            candidates,
            bounds_method,
            (length, width, thickness),
            flatness,
            slenderness,
            cross_section,
            None,
        )

    def _build(
        self,
        form: StockFormKind,
        reason: Optional[str],
        candidates: List[StockFormKind],
        bounds_method: str,
        dimensions: Tuple[float, float, float],
        flatness: float,
        slenderness: float,
        cross_section: float,
        evidence: Optional[RoundStockEvidence],
        sheet: Optional[SheetEvidence] = None,
    ) -> StockForm:
        length, width, thickness = dimensions
        status = FeatureStatus.AMBIGUOUS if reason else FeatureStatus.RESOLVED
        return StockForm(
            form=form,
            status=status,
            reason=reason,
            candidate_forms=candidates,
            bounds_method=bounds_method,
            sorted_dimensions_mm=StockDimensions(
                length=self._r(length),
                width=self._r(width),
                height=self._r(thickness),
            ),
            thickness_mm=self._r(thickness),
            flatness_ratio=round(flatness, 4),
            slenderness_ratio=round(slenderness, 4),
            cross_section_ratio=round(cross_section, 4),
            round_evidence=evidence,
            sheet_evidence=sheet,
        )

    def _r(self, value: float) -> float:
        return round(value, self.config.length_decimals)
