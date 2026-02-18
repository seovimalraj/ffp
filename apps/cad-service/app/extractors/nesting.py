"""Nesting estimation for sheet-metal flat blanks.

Estimates how many parts can be nested on a standard sheet and the
material utilisation percentage.  Uses a simple strip-packing heuristic
with two-orientation comparison (0° and 90° rotations).
"""
from __future__ import annotations

import logging
import math
from typing import Optional, Tuple

from ..models import NestingEstimate

logger = logging.getLogger(__name__)

# Common sheet sizes (width × height in mm)
STANDARD_SHEETS = {
    "small": (1000.0, 2000.0),
    "medium": (1220.0, 2440.0),  # 4′ × 8′
    "large": (1500.0, 3000.0),
    "jumbo": (2000.0, 4000.0),
}

# Default kerf/gap between parts (mm)
DEFAULT_KERF_MM = 3.0


def _select_sheet_size(part_l: float, part_w: float, kerf_mm: float) -> Tuple[float, float]:
    """Select the smallest standard sheet that fits at least one part."""
    for name in ["small", "medium", "large", "jumbo"]:
        csw, csh = STANDARD_SHEETS[name]
        if (part_l + kerf_mm) <= csw and (part_w + kerf_mm) <= csh:
            return csw, csh
        if (part_w + kerf_mm) <= csw and (part_l + kerf_mm) <= csh:
            return csw, csh
    return STANDARD_SHEETS["medium"]


def _compute_mixed_packing(
    cols_0: int, cols_90: int, step_w_0: float, step_w_90: float, sh: float,
) -> int:
    """Try alternating rows of 0° and 90° orientations."""
    pair_height = step_w_0 + step_w_90
    full_pairs = int(sh // pair_height)
    remaining = sh - full_pairs * pair_height
    mixed_count = full_pairs * (cols_0 + cols_90)
    if remaining >= step_w_0:
        mixed_count += cols_0
    elif remaining >= step_w_90:
        mixed_count += cols_90
    return mixed_count


def estimate_nesting(
    flat_length: float,
    flat_width: float,
    thickness: float = 1.0,
    sheet_size: Optional[Tuple[float, float]] = None,
    kerf_mm: float = DEFAULT_KERF_MM,
    quantity: int = 1,
) -> NestingEstimate:
    """Estimate nesting for a rectangular flat blank.

    Parameters
    ----------
    flat_length, flat_width : Flat pattern dimensions in mm.
    thickness : Material thickness in mm.
    sheet_size : (width, height) of sheet in mm.  If None, selects the
        smallest standard sheet that fits at least one part.
    kerf_mm : Gap between parts (laser kerf + safety margin).
    quantity : Order quantity (for context only).

    Returns
    -------
    NestingEstimate dataclass.
    """
    if flat_length <= 0 or flat_width <= 0:
        return NestingEstimate(
            sheet_width_mm=0,
            sheet_height_mm=0,
            parts_per_sheet=0,
            utilization_pct=0.0,
            flat_length_mm=flat_length,
            flat_width_mm=flat_width,
        )

    # Ensure length >= width
    part_l = max(flat_length, flat_width)
    part_w = min(flat_length, flat_width)

    part_area = part_l * part_w

    if sheet_size:
        sw, sh = sheet_size
    else:
        sw, sh = _select_sheet_size(part_l, part_w, kerf_mm)

    # --- Strip-pack in orientation 0° ---
    step_l_0 = part_l + kerf_mm
    step_w_0 = part_w + kerf_mm
    cols_0 = max(int(sw // step_l_0), 0)
    rows_0 = max(int(sh // step_w_0), 0)
    count_0 = cols_0 * rows_0

    # --- Strip-pack in orientation 90° ---
    step_l_90 = part_w + kerf_mm
    step_w_90 = part_l + kerf_mm
    cols_90 = max(int(sw // step_l_90), 0)
    rows_90 = max(int(sh // step_w_90), 0)
    count_90 = cols_90 * rows_90

    best_count = max(count_0, count_90, 0)

    # Mixed packing: try alternating rows of 0° and 90°
    if count_0 > 0 and count_90 > 0:
        mixed_count = _compute_mixed_packing(cols_0, cols_90, step_w_0, step_w_90, sh)
        best_count = max(best_count, mixed_count)

    sheet_area = sw * sh
    utilization = (best_count * part_area / sheet_area * 100) if sheet_area > 0 else 0.0

    est = NestingEstimate(
        sheet_width_mm=round(sw, 1),
        sheet_height_mm=round(sh, 1),
        parts_per_sheet=best_count,
        utilization_pct=round(min(utilization, 100.0), 1),
        flat_length_mm=round(part_l, 2),
        flat_width_mm=round(part_w, 2),
    )

    logger.info(
        "Nesting estimate: %d parts/sheet, %.1f%% utilisation on %.0f×%.0fmm sheet",
        best_count, est.utilization_pct, sw, sh,
    )
    return est
