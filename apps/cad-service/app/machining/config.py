"""Configurable thresholds for machining feature extraction.

Every numeric decision boundary used by the detectors lives here rather than
inside the extraction code, so thresholds can be tuned per deployment without
touching geometry logic.

Resolution order (later wins):

1. the defaults below
2. ``machining_config.json`` next to this package, if present
3. the file named by ``$MACHINING_CONFIG_PATH``, if set
4. individual ``$MACHINING_<UPPER_FIELD>`` environment variables

None of these values are prices, rates, or machine selections - they are purely
geometric decision boundaries.
"""

from __future__ import annotations

import json
import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

_DEFAULT_CONFIG_FILE = Path(__file__).with_name("machining_config.json")
_ENV_PREFIX = "MACHINING_"


class MachiningConfig(BaseModel):
    """Geometric thresholds. All lengths in millimetres, angles in degrees."""

    # --- upload / parsing -------------------------------------------------
    max_upload_bytes: int = Field(
        default=100 * 1024 * 1024,
        description="Hard cap on the uploaded CAD file size.",
    )
    upload_chunk_bytes: int = Field(
        default=1024 * 1024,
        description="Streaming chunk size so uploads never sit fully in memory.",
    )
    max_faces: int = Field(
        default=50_000,
        description="Refuse models above this face count to bound analysis time.",
    )

    # --- shape healing ----------------------------------------------------
    repair_open_shells: bool = Field(
        default=True,
        description=(
            "When a file contains shells but no solid, sew them and build "
            "solids rather than rejecting it. Converted STEP files commonly "
            "need this."
        ),
    )
    sew_tolerance_mm: float = Field(
        default=0.01,
        description=(
            "Gap below which adjacent faces are sewn together during repair. "
            "Too large fuses genuinely separate walls; too small leaves the "
            "shell open."
        ),
    )

    # --- numeric tolerances ----------------------------------------------
    linear_tolerance_mm: float = Field(
        default=1e-4, description="Distance below which two points are the same point."
    )
    angular_tolerance_deg: float = Field(
        default=1.0, description="Angle below which two directions are parallel."
    )
    tangency_tolerance_deg: float = Field(
        default=5.0,
        description="Normal deviation across a shared edge still counted as tangent.",
    )
    coaxial_tolerance_mm: float = Field(
        default=0.05, description="Axis offset below which two cylinders are coaxial."
    )

    # --- holes / bores ----------------------------------------------------
    min_hole_diameter_mm: float = Field(default=0.5)
    max_hole_diameter_mm: float = Field(
        default=25.0,
        description="Internal cylinders above this diameter are candidate bores.",
    )
    bore_min_diameter_mm: float = Field(
        default=25.0, description="Lower diameter bound for classifying a bore."
    )
    bore_min_depth_mm: float = Field(
        default=10.0, description="Lower depth bound for classifying a bore."
    )
    hole_min_angular_span_deg: float = Field(
        default=180.0,
        description=(
            "Minimum angular wrap for a bore, summed across every coaxial "
            "fragment at that radius. A boolean can split one bore into several "
            "arcs, so the test applies to the reassembled segment rather than to "
            "each face; below this the geometry is a fillet or a partial wall."
        ),
    )
    hole_end_probe_offset_mm: float = Field(
        default=0.05,
        description=(
            "How far past a bore's end to sample when deciding through vs blind. "
            "A closing wall thinner than this reads as open."
        ),
    )
    countersink_max_half_angle_deg: float = Field(
        default=75.0,
        description="Coaxial cone with half-angle under this reads as a countersink.",
    )
    counterbore_min_diameter_ratio: float = Field(
        default=1.15,
        description="Coaxial larger cylinder must exceed this ratio to be a counterbore.",
    )

    # --- pockets / slots --------------------------------------------------
    pocket_min_depth_mm: float = Field(default=0.5)
    pocket_min_wall_count: int = Field(
        default=3, description="Minimum surrounding wall faces for a pocket floor."
    )
    pocket_min_area_mm2: float = Field(default=4.0)
    slot_min_aspect_ratio: float = Field(
        default=3.0, description="length/width at or above which a pocket is a slot."
    )
    slot_max_width_mm: float = Field(default=50.0)
    keyway_max_width_mm: float = Field(default=25.0)

    # --- bosses -----------------------------------------------------------
    boss_min_height_mm: float = Field(default=1.0)
    boss_min_diameter_mm: float = Field(default=1.0)

    # --- fillets / chamfers ----------------------------------------------
    fillet_max_radius_mm: float = Field(
        default=50.0, description="Above this a cylindrical band is not read as a fillet."
    )
    chamfer_max_width_mm: float = Field(default=10.0)
    chamfer_min_angle_deg: float = Field(default=10.0)
    chamfer_max_angle_deg: float = Field(default=80.0)
    chamfer_max_aspect_for_band: float = Field(
        default=0.35,
        description="width/length below which a narrow planar face reads as a chamfer band.",
    )

    # --- machining flags --------------------------------------------------
    deep_hole_depth_diameter_ratio: float = Field(
        default=5.0, description="depth/diameter at or above which a hole is DEEP_HOLE."
    )
    very_deep_hole_depth_diameter_ratio: float = Field(default=10.0)
    deep_pocket_depth_width_ratio: float = Field(default=4.0)
    small_hole_diameter_mm: float = Field(default=2.0)
    thin_wall_thickness_mm: float = Field(
        default=1.5, description="Parallel face pairs closer than this are thin walls."
    )
    narrow_slot_width_mm: float = Field(default=3.0)

    # --- tooling constraints ---------------------------------------------
    tool_diameter_safety_factor: float = Field(
        default=1.0,
        description=(
            "max_tool_diameter = 2 * internal_corner_radius * factor. A factor of "
            "1.0 is the pure geometric limit; below 1.0 leaves clearance."
        ),
    )
    min_practical_tool_diameter_mm: float = Field(default=0.5)

    # --- accessibility ----------------------------------------------------
    accessibility_directions: List[str] = Field(
        default_factory=lambda: ["+X", "-X", "+Y", "-Y", "+Z", "-Z"]
    )
    accessibility_ray_clearance_mm: float = Field(
        default=1.0,
        description="Ray start offset outside the bounding box when probing access.",
    )
    accessibility_hit_tolerance_mm: float = Field(
        default=0.5,
        description="A ray hit within this distance of the feature counts as reaching it.",
    )

    # --- stock ------------------------------------------------------------
    stock_allowance_mm: float = Field(
        default=2.5,
        description="Per-side machining allowance added to each bounding-box axis.",
    )
    stock_round_up_to_mm: float = Field(
        default=0.0,
        description="Round each stock dimension up to a multiple of this (0 disables).",
    )

    # --- stock form classification ----------------------------------------
    # These cutoffs are the only judgement in the classification: the extents
    # and face evidence are measured facts, and where the boundaries between
    # sheet, plate and bar sit is a shop convention, so it is declared here.
    stock_form_sheet_max_thickness_mm: float = Field(
        default=6.0,
        description="At or below this thickness a flat part reads as sheet rather than plate.",
    )
    stock_form_sheet_ratio_max: float = Field(
        default=0.10,
        description="Thickness/width ratio at or below which a flat part reads as sheet.",
    )
    stock_form_flat_ratio_max: float = Field(
        default=0.25,
        description="Thickness/width ratio at or below which a part reads as plate.",
    )
    stock_form_bar_ratio_max: float = Field(
        default=0.25,
        description="Width/length ratio at or below which a part reads as bar stock.",
    )
    stock_form_squareness_tol: float = Field(
        default=0.05,
        description=(
            "Relative difference between the two smaller extents below which a "
            "bar cross-section counts as square (or round)."
        ),
    )
    stock_form_round_radius_tol: float = Field(
        default=0.05,
        description=(
            "Relative tolerance matching an external cylinder radius against "
            "half the cross-section, used to separate round bar from square bar."
        ),
    )
    stock_form_round_axial_coverage: float = Field(
        default=0.6,
        description=(
            "Fraction of the long extent an external cylinder must span before "
            "it counts as evidence of round stock."
        ),
    )
    stock_form_ambiguity_margin: float = Field(
        default=0.10,
        description=(
            "Relative distance from a threshold within which the classification "
            "is reported as ambiguous instead of committing to a form."
        ),
    )

    # --- topology entities ------------------------------------------------
    max_topology_entities: int = Field(
        default=4000,
        description=(
            "Cap on faces, edges and vertices returned per category when "
            "include_topology_entities is set. A real part has tens of "
            "thousands; sending them all would dwarf the rest of the payload."
        ),
    )

    # --- output -----------------------------------------------------------
    length_decimals: int = Field(default=3)
    area_decimals: int = Field(default=2)
    volume_decimals: int = Field(default=2)

    model_config = {"frozen": True, "extra": "forbid"}

    @property
    def angular_tolerance_rad(self) -> float:
        import math

        return math.radians(self.angular_tolerance_deg)

    @property
    def tangency_tolerance_rad(self) -> float:
        import math

        return math.radians(self.tangency_tolerance_deg)


def _load_file(path: Path) -> Dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        if not isinstance(data, dict):
            logger.warning("machining config %s is not a JSON object - ignored", path)
            return {}
        # Keys beginning with '_' are documentation, not settings.
        return {k: v for k, v in data.items() if not k.startswith("_")}
    except FileNotFoundError:
        return {}
    except Exception as exc:
        logger.warning("machining config %s could not be read: %s", path, exc)
        return {}


def _env_overrides() -> Dict[str, Any]:
    overrides: Dict[str, Any] = {}
    for name, field in MachiningConfig.model_fields.items():
        raw = os.getenv(f"{_ENV_PREFIX}{name.upper()}")
        if raw is None:
            continue
        try:
            if field.annotation is int:
                overrides[name] = int(raw)
            elif field.annotation is float:
                overrides[name] = float(raw)
            elif field.annotation is bool:
                overrides[name] = raw.strip().lower() in ("1", "true", "yes", "on")
            else:
                overrides[name] = json.loads(raw)
        except Exception as exc:
            logger.warning("Ignoring invalid %s%s: %s", _ENV_PREFIX, name.upper(), exc)
    return overrides


@lru_cache(maxsize=1)
def get_machining_config() -> MachiningConfig:
    """Resolve and cache the effective configuration."""
    values: Dict[str, Any] = {}
    values.update(_load_file(_DEFAULT_CONFIG_FILE))

    custom = os.getenv(f"{_ENV_PREFIX}CONFIG_PATH")
    if custom:
        values.update(_load_file(Path(custom)))

    values.update(_env_overrides())

    try:
        return MachiningConfig(**values)
    except Exception as exc:
        logger.error("Invalid machining configuration (%s) - using defaults", exc)
        return MachiningConfig()


def reset_config_cache() -> None:
    """Drop the cached config. Used by tests that patch the environment."""
    get_machining_config.cache_clear()
