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
from typing import List, Optional, Tuple

from .config import MachiningConfig
from .detectors.shared import group_coaxial
from .records import CYLINDER, FaceRecord, ShapeModel
from .schemas import (
    FeatureStatus,
    RoundStockEvidence,
    StockDimensions,
    StockForm,
    StockFormKind,
)
from .vectors import Vec, is_parallel, normalize

logger = logging.getLogger(__name__)

#: Angular tolerance accepting a cylinder axis as running along the part.
_AXIS_PARALLEL_TOL_DEG = 10.0


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


def find_dominant_external_cylinder(
    model: ShapeModel,
    long_axis: Vec,
    expected_radius: float,
    length: float,
    config: MachiningConfig,
) -> Optional[Tuple[FaceRecord, float]]:
    """The external cylinder that would be the outside of round bar, if any.

    Rod and square bar have identical extents - the cross-section is what tells
    them apart, so thickness alone cannot answer this.

    A turned part almost never carries its outside diameter as a single face:
    grooves, shoulders and chamfers split it into several coaxial cylinders of
    the same radius. So candidates are grouped by axis line and their coverage
    summed, and the group must span most of the length. Returns the largest
    face of the winning group and that group's coverage.
    """
    if expected_radius <= 0 or length <= 0:
        return None

    candidates = [
        face
        for face in model.faces_of_type(CYLINDER)
        if not face.is_internal
        and face.axis is not None
        and face.radius_mm is not None
        and is_parallel(face.axis, long_axis, _AXIS_PARALLEL_TOL_DEG)
        and _near(face.radius_mm, expected_radius, config.stock_form_round_radius_tol)
    ]
    if not candidates:
        return None

    best: Optional[Tuple[FaceRecord, float]] = None
    for group in group_coaxial(candidates, config):
        extents = [(_axial_extent(face), face) for face in group]
        coverage = min(1.0, sum(extent for extent, _ in extents) / length)
        if coverage < config.stock_form_round_axial_coverage:
            continue
        largest = max(extents, key=lambda pair: pair[0])[1]
        if best is None or coverage > best[1]:
            best = (largest, coverage)

    return best


def _axial_extent(face: FaceRecord) -> float:
    """How far a cylindrical face runs along its own axis."""
    extent = face.axial_extent_mm
    if extent is not None and extent > 0:
        return float(extent)
    # Fall back to the face's own bounding box when the classifier could not
    # resolve a parametric extent.
    size = face.bbox_size
    return max(abs(v) for v in size) if size else 0.0


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

        # Track which original axis each sorted extent came from, so the round
        # probe knows which direction runs along the bar.
        order = sorted(range(3), key=lambda i: extents[i], reverse=True)
        length, width, thickness = (extents[i] for i in order)

        cfg = self.config
        flatness = thickness / width
        slenderness = width / length
        cross_section = (width - thickness) / width
        margin = cfg.stock_form_ambiguity_margin

        form: StockFormKind
        candidates: List[StockFormKind] = []
        reason: Optional[str] = None
        evidence: Optional[RoundStockEvidence] = None

        is_flat = flatness <= cfg.stock_form_flat_ratio_max
        is_slender = slenderness <= cfg.stock_form_bar_ratio_max
        is_square_section = cross_section <= cfg.stock_form_squareness_tol

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
        elif is_slender:
            if is_square_section:
                probe = find_dominant_external_cylinder(
                    model,
                    _long_axis(model, order[0], bounds_method),
                    width / 2.0,
                    length,
                    cfg,
                )
                if probe is not None:
                    face, coverage = probe
                    form = StockFormKind.ROUND_BAR
                    evidence = RoundStockEvidence(
                        face_id=face.id,
                        radius_mm=round(
                            float(face.radius_mm or 0.0), cfg.length_decimals
                        ),
                        axis=[
                            round(v, 6)
                            for v in normalize(face.axis or (0.0, 0.0, 1.0))
                        ],
                        axial_coverage=round(coverage, 4),
                    )
                else:
                    form = StockFormKind.SQUARE_BAR
            else:
                form = StockFormKind.RECTANGULAR_BAR

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
        )

    def _r(self, value: float) -> float:
        return round(value, self.config.length_decimals)
