"""Configurable thresholds for sheet-metal feature extraction.

Mirrors ``app.machining.config`` exactly: every numeric decision boundary
used by the (future) detectors lives here rather than inside detector code,
so thresholds can be tuned per deployment without touching geometry logic.

Resolution order (later wins):

1. the defaults below
2. ``sheet_metal_config.json`` next to this package, if present
3. the file named by ``$SHEET_METAL_CONFIG_PATH``, if set
4. individual ``$SHEET_METAL_<UPPER_FIELD>`` environment variables

None of these values are prices, rates, or machine selections - they are
purely geometric decision boundaries.

Threshold provenance (design doc section 3.4):
- ``min_sheet_thickness_mm`` / ``max_sheet_thickness_mm``: seeded from the
  legacy ``SHEET_METAL_MIN_THICKNESS`` / ``SHEET_METAL_MAX_THICKNESS``
  constants in ``app/core/classification.py`` (0.4 mm / 6.0 mm).
- ``min_bend_angle_deg`` / ``max_bend_angle_deg``: seeded from the legacy
  bend detector's 45-135 degree clustering window (``app/core/bend_detection.py``).
- ``paired_face_area_fraction_threshold``: reuses the concept of
  ``app.machining``'s ``stock_form_sheet_wall_area_fraction`` /
  ``sheet_evidence.paired_area_fraction`` (opposed-face wall-thickness evidence).
"""

from __future__ import annotations

import json
import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

_DEFAULT_CONFIG_FILE = Path(__file__).with_name("sheet_metal_config.json")
_ENV_PREFIX = "SHEET_METAL_"


class SheetMetalConfig(BaseModel):
    """Geometric thresholds. All lengths in millimetres, angles in degrees."""

    # --- upload / parsing (shared shape with MachiningConfig) -------------
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

    # --- shape healing (reused from machining's repair behaviour) ---------
    repair_open_shells: bool = Field(default=True)
    sew_tolerance_mm: float = Field(default=0.01)

    # --- numeric tolerances -------------------------------------------------
    linear_tolerance_mm: float = Field(default=1e-4)
    angular_tolerance_deg: float = Field(default=1.0)

    # --- sheet-metal candidate gating ---------------------------------------
    min_sheet_thickness_mm: float = Field(
        default=0.4,
        description="Below this a wall is too thin to be sheet stock (legacy SHEET_METAL_MIN_THICKNESS).",
    )
    max_sheet_thickness_mm: float = Field(
        default=6.0,
        description=(
            "Above this a part reads as plate/block rather than sheet metal "
            "(legacy SHEET_METAL_MAX_THICKNESS, the practical press-brake limit)."
        ),
    )
    paired_face_area_fraction_threshold: float = Field(
        default=0.5,
        description=(
            "Fraction of total surface area that must sit on opposed "
            "parallel-face pairs of the dominant thickness before a part "
            "reads as sheet-metal candidate evidence."
        ),
    )

    # --- bend detection window ----------------------------------------------
    min_bend_angle_deg: float = Field(
        default=45.0, description="Lower bound of the bend-zone clustering window."
    )
    max_bend_angle_deg: float = Field(
        default=135.0, description="Upper bound of the bend-zone clustering window."
    )
    default_k_factor: float = Field(
        default=0.44,
        description=(
            "Recorded per bend as metadata for a future flat-pattern-unfolding "
            "phase. Not used for unfolding yet."
        ),
    )

    # --- DFM flag thresholds -------------------------------------------------
    min_bend_radius_to_thickness_ratio: float = Field(
        default=1.0,
        description="Below this ratio a bend radius is flagged BEND_RADIUS_TOO_TIGHT.",
    )
    min_feature_size_mm: float = Field(
        default=1.0, description="Smallest allowed cut width before FEATURE_BELOW_MIN_SIZE fires."
    )
    min_hole_to_edge_distance_mm: float = Field(
        default=2.0, description="Below this a hole is flagged HOLE_TOO_CLOSE_TO_EDGE."
    )
    min_hole_to_bend_distance_mm: float = Field(
        default=3.0, description="Below this a hole is flagged HOLE_TOO_CLOSE_TO_BEND."
    )

    # --- topology entities (shared shape with MachiningConfig) -------------
    max_topology_entities: int = Field(default=4000)

    # --- output --------------------------------------------------------------
    length_decimals: int = Field(default=3)
    area_decimals: int = Field(default=2)
    volume_decimals: int = Field(default=2)

    model_config = {"frozen": True, "extra": "forbid"}


def _load_file(path: Path) -> Dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        if not isinstance(data, dict):
            logger.warning("sheet_metal config %s is not a JSON object - ignored", path)
            return {}
        return {k: v for k, v in data.items() if not k.startswith("_")}
    except FileNotFoundError:
        return {}
    except Exception as exc:
        logger.warning("sheet_metal config %s could not be read: %s", path, exc)
        return {}


def _env_overrides() -> Dict[str, Any]:
    overrides: Dict[str, Any] = {}
    for name, field in SheetMetalConfig.model_fields.items():
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
def get_sheet_metal_config() -> SheetMetalConfig:
    """Resolve and cache the effective configuration."""
    values: Dict[str, Any] = {}
    values.update(_load_file(_DEFAULT_CONFIG_FILE))

    custom = os.getenv(f"{_ENV_PREFIX}CONFIG_PATH")
    if custom:
        values.update(_load_file(Path(custom)))

    values.update(_env_overrides())

    try:
        return SheetMetalConfig(**values)
    except Exception as exc:
        logger.error("Invalid sheet_metal configuration (%s) - using defaults", exc)
        return SheetMetalConfig()


def reset_config_cache() -> None:
    """Drop the cached config. Used by tests that patch the environment."""
    get_sheet_metal_config.cache_clear()
