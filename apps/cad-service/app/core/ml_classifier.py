"""
ML-Assisted Manufacturing Process Classification.

Uses gradient-boosted trees (XGBoost-style via scikit-learn) trained on
geometric feature vectors to supplement the rule-based ProcessClassifier.

Key design goals:
  • Works out-of-the-box with a pre-seeded training set derived from
    known manufacturing heuristics, so it adds value even before
    production data is collected.
  • Continuously learns from confirmed quotes (feedback loop).
  • Returns calibrated probabilities that the rule engine can blend
    with its own confidence scores.
  • Falls back gracefully if scikit-learn is unavailable.
"""
from __future__ import annotations

import json
import logging
import math
import os
import pickle
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Feature vector definition
# ---------------------------------------------------------------------------

FEATURE_NAMES = [
    "volume_mm3",
    "surface_area_mm2",
    "min_dim",
    "mid_dim",
    "max_dim",
    "aspect_ratio",
    "volume_efficiency",
    "sa_to_vol_ratio",
    "detected_thickness",
    "thickness_confidence",
    "thickness_to_min_dim_ratio",
    "bend_count",
    "bend_confidence",
    "bend_complexity",
    "sheet_metal_score",
    "xy_similarity",       # cylindrical detection
    "hole_count",
    "pocket_count",
    "thread_count",
    "undercut_count",
    "fillet_count",
    "slot_count",
    "triangle_count",
    "uniform_ratio",        # from advanced thickness
    "cluster_dominance",    # from advanced thickness
    "planarity_score",
    "wall_consistency",
    "cnc_likelihood",
    # Face classification features (from BRepAdaptor analysis)
    "face_plane_ratio",
    "face_cylinder_ratio",
    "face_freeform_ratio",
    "face_paired_plane_count",
    "face_dominant_thickness",
    "face_cnc_score",
    "face_sheet_metal_score",
    # Feature analysis signals (GAP 7)
    "rib_count",
    "boss_count",
    "chamfer_count",
    "counterbore_count",
    "countersink_count",
    "surface_step_count",
    "hole_pattern_count",
    "bend_radius_ratio",      # avg_bend_radius / part_thickness
    "edge_sharpness_ratio",   # sharp_edges / total_edges
    "face_revolution_count",  # CNC turning indicator
    "draft_angle_avg",        # injection molding indicator
    "undercut_major_count",   # 5-axis CNC indicator
    # NEW: Surface finish features
    "min_ra_required",        # Minimum Ra finish required (µm)
    "precision_face_count",   # Faces requiring precision finish
    "finish_complexity_score", # Overall finish complexity 0-100
    # NEW: Tolerance features
    "tightest_tolerance_mm",  # Tightest tolerance in mm
    "precision_feature_count", # Features requiring IT6 or tighter
    "datum_count",            # Number of datum features
    "tolerance_complexity",   # Overall tolerance complexity 0-100
    # NEW: Machining complexity features
    "requires_5axis",         # 1.0 if 5-axis required
    "requires_4axis",         # 1.0 if 4-axis required
    "is_turn_mill",           # 1.0 if turn-mill hybrid
    "access_direction_count", # Number of tool approach directions
    "setup_count_estimate",   # Estimated number of setups
    "machining_complexity",   # Overall machining complexity 0-100
    # NEW: Process detection features
    "is_likely_cast",         # 1.0 if casting indicators present
    "casting_confidence",     # Casting detection confidence
    "is_weldment",           # 1.0 if weldment detected
    "weld_joint_count",      # Number of weld joints
    "body_count",            # Number of solid bodies
]

# Extended process types
PROCESS_LABELS = [
    "sheet_metal",
    "cnc_milling",
    "cnc_turning",
    "cnc_turn_mill",        # Turn-mill hybrid
    "cnc_5axis",            # 5-axis milling
    "injection_molding",    # Plastic injection
    "die_casting",          # Die cast aluminum/zinc
    "sand_casting",         # Sand casting
    "investment_casting",   # Investment/lost-wax casting
    "3d_printing",          # Additive manufacturing
    "weldment",             # Welded assembly
]
LABEL_MAP = {label: idx for idx, label in enumerate(PROCESS_LABELS)}
IDX_MAP = {idx: label for label, idx in LABEL_MAP.items()}


@dataclass
class MLClassificationResult:
    """Result from the ML classifier."""
    predicted_process: str          # 'sheet_metal' | 'cnc_milling' | 'cnc_turning'
    probabilities: Dict[str, float] # per-class probabilities
    confidence: float               # max probability
    is_borderline: bool             # True when top-2 probs within 15%
    feature_importances: Dict[str, float]  # top features driving decision
    model_version: str

    def to_dict(self) -> dict:
        return {
            "predicted_process": self.predicted_process,
            "probabilities": {k: round(v, 4) for k, v in self.probabilities.items()},
            "confidence": round(self.confidence, 4),
            "is_borderline": self.is_borderline,
            "feature_importances": {k: round(v, 4) for k, v in self.feature_importances.items()},
            "model_version": self.model_version,
        }


# ---------------------------------------------------------------------------
# Synthetic training data generator
# ---------------------------------------------------------------------------

def _append_new_features(row: List[float], process_type: str, bend_count: int, thickness: float) -> None:
    """Append the new feature values (GAP 7) to a synthetic training row.
    
    New features: rib_count, boss_count, chamfer_count, counterbore_count,
    countersink_count, surface_step_count, hole_pattern_count, bend_radius_ratio,
    edge_sharpness_ratio, face_revolution_count, draft_angle_avg, undercut_major_count
    """
    import random
    
    if process_type == "sheet_metal":
        row.extend([
            0,                              # rib_count (none in sheet metal)
            0,                              # boss_count (none)
            random.randint(0, 2),           # chamfer_count (few)
            0,                              # counterbore_count (rare)
            0,                              # countersink_count (rare)
            random.randint(1, 3),           # surface_step_count (few steps)
            random.randint(0, 2),           # hole_pattern_count
            random.uniform(1.0, 3.0) if bend_count > 0 else 0,  # bend_radius_ratio (typical 1-3x thickness)
            random.uniform(0.5, 0.9),       # edge_sharpness_ratio (many sharp edges)
            0,                              # face_revolution_count (none)
            0.0,                            # draft_angle_avg (none)
            0,                              # undercut_major_count (none)
        ])
    elif process_type == "cnc_milling":
        row.extend([
            random.randint(0, 5),           # rib_count
            random.randint(0, 8),           # boss_count
            random.randint(2, 15),          # chamfer_count (many)
            random.randint(0, 6),           # counterbore_count
            random.randint(0, 4),           # countersink_count
            random.randint(2, 10),          # surface_step_count (many levels)
            random.randint(1, 5),           # hole_pattern_count
            0.0,                            # bend_radius_ratio (no bends)
            random.uniform(0.1, 0.5),       # edge_sharpness_ratio (fewer sharp, more filleted)
            random.randint(0, 2),           # face_revolution_count (few)
            random.uniform(0, 3),           # draft_angle_avg (some draft for tooling)
            random.randint(0, 2),           # undercut_major_count
        ])
    else:  # cnc_turning
        row.extend([
            0,                              # rib_count
            random.randint(1, 6),           # boss_count (common in turned parts)
            random.randint(2, 10),          # chamfer_count
            random.randint(0, 3),           # counterbore_count
            random.randint(0, 2),           # countersink_count
            random.randint(1, 4),           # surface_step_count
            random.randint(0, 2),           # hole_pattern_count
            0.0,                            # bend_radius_ratio (no bends)
            random.uniform(0.1, 0.4),       # edge_sharpness_ratio (rounded edges)
            random.randint(4, 15),          # face_revolution_count (many - key signal)
            0.0,                            # draft_angle_avg
            0,                              # undercut_major_count
        ])


def _generate_synthetic_dataset(n_per_class: int = 500) -> Tuple[List[List[float]], List[int]]:
    """
    Generate synthetic training data from manufacturing heuristics.
    Each sample is a realistic feature vector for a known process type.
    
    IMPROVED: Better representation of edge cases:
    - Flat sheet metal (high vol_eff, no bends) - laser-cut parts
    - Bent sheet metal (lower vol_eff, multiple bends)
    - Sheet metal with many holes (higher cylinder_ratio)
    - Precision machined plates (thin but CNC)
    - 3D machined parts with complex features
    """
    import random
    random.seed(42)

    X: List[List[float]] = []
    y: List[int] = []

    # Distribute sheet metal samples across subcategories
    n_flat_sheet = n_per_class // 3
    n_bent_sheet = n_per_class // 3
    n_holey_sheet = n_per_class - n_flat_sheet - n_bent_sheet

    # --- FLAT SHEET METAL (laser-cut, punched, no bends) ---
    for _ in range(n_flat_sheet):
        t = random.uniform(0.5, 6.0)
        min_d = t
        mid_d = random.uniform(80, 400)
        max_d = random.uniform(mid_d * 1.0, mid_d * 3)
        # CRITICAL: Flat sheets have HIGH volume efficiency (~0.85-1.0)
        vol = min_d * mid_d * max_d * random.uniform(0.85, 1.0)
        sa = 2 * (min_d * mid_d + mid_d * max_d + min_d * max_d) * random.uniform(0.9, 1.1)
        aspect = max_d / max(min_d, 0.1)
        vol_eff = vol / (min_d * mid_d * max_d + 1e-9)
        sa_vol = sa / max(vol / 1000, 1e-9)
        bends = 0  # No bends - flat sheet
        sms = random.uniform(60, 95)
        hole_count = random.randint(0, 15)
        # Flat sheets can have some formed pockets
        pocket_count = random.randint(0, 2) if random.random() < 0.2 else 0

        row = [
            vol, sa, min_d, mid_d, max_d, aspect, vol_eff, sa_vol,
            t, random.uniform(0.7, 0.98),
            t / max(min_d, 0.1),
            bends, 0.0, 0.0,  # No bends
            sms,
            random.uniform(0.3, 0.95),
            hole_count, pocket_count, 0,  # No threads typically
            0, random.randint(0, 3), 0,  # Few fillets, no slots
            random.randint(500, 5000),
            random.uniform(0.5, 0.95), random.uniform(2.0, 10.0),
            random.uniform(0.6, 0.98), random.uniform(0.7, 0.98),
            random.uniform(0.1, 0.35),
            # Face classification: flat sheet metal profile
            random.uniform(0.80, 0.98),   # plane_ratio (very high)
            random.uniform(0.0, 0.10),    # cylinder_ratio (low, few holes)
            random.uniform(0.0, 0.03),    # freeform_ratio (very low)
            random.randint(1, 3),          # paired_plane_count (just top/bottom)
            random.uniform(0.5, 6.0),      # dominant_thickness (thin)
            random.uniform(5, 30),         # cnc_score (low)
            random.uniform(65, 95),        # sheet_metal_score (high)
        ]
        _append_new_features(row, "sheet_metal", bends, t)
        X.append(row)
        y.append(LABEL_MAP["sheet_metal"])

    # --- BENT SHEET METAL (formed, multiple bends) ---
    for _ in range(n_bent_sheet):
        t = random.uniform(0.5, 5.0)
        min_d = t
        mid_d = random.uniform(40, 300)
        max_d = random.uniform(mid_d, mid_d * 3)
        # Bent parts have LOWER volume efficiency (box-like, L-shaped, etc.)
        vol = min_d * mid_d * max_d * random.uniform(0.15, 0.55)
        sa = 2 * (min_d * mid_d + mid_d * max_d + min_d * max_d) * random.uniform(0.8, 1.3)
        aspect = max_d / max(min_d, 0.1)
        vol_eff = vol / (min_d * mid_d * max_d + 1e-9)
        sa_vol = sa / max(vol / 1000, 1e-9)
        bends = random.randint(2, 12)
        sms = random.uniform(60, 98)

        row = [
            vol, sa, min_d, mid_d, max_d, aspect, vol_eff, sa_vol,
            t, random.uniform(0.6, 0.95),
            t / max(min_d, 0.1),
            bends, random.uniform(0.5, 0.95), bends * random.uniform(5, 15),
            sms,
            random.uniform(0.3, 0.95),
            random.randint(0, 10), random.randint(0, 2), 0,
            0, random.randint(0, 4), 0,
            random.randint(500, 8000),
            random.uniform(0.35, 0.85), random.uniform(2.0, 8.0),
            random.uniform(0.55, 0.95), random.uniform(0.6, 0.98),
            random.uniform(0.1, 0.4),
            # Face classification: bent sheet metal profile
            random.uniform(0.70, 0.92),   # plane_ratio (high but varies with bends)
            random.uniform(0.02, 0.15),   # cylinder_ratio (bend radii + holes)
            random.uniform(0.0, 0.05),    # freeform_ratio (very low)
            random.randint(2, 8),          # paired_plane_count (several due to bends)
            random.uniform(0.5, 5.0),      # dominant_thickness (thin)
            random.uniform(8, 40),         # cnc_score (low-moderate)
            random.uniform(55, 92),        # sheet_metal_score (high)
        ]
        _append_new_features(row, "sheet_metal", bends, t)
        X.append(row)
        y.append(LABEL_MAP["sheet_metal"])

    # --- SHEET METAL WITH MANY HOLES (punched patterns) ---
    for _ in range(n_holey_sheet):
        t = random.uniform(0.8, 4.0)
        min_d = t
        mid_d = random.uniform(60, 350)
        max_d = random.uniform(mid_d, mid_d * 2.5)
        vol = min_d * mid_d * max_d * random.uniform(0.60, 0.90)
        sa = 2 * (min_d * mid_d + mid_d * max_d + min_d * max_d) * random.uniform(0.9, 1.2)
        aspect = max_d / max(min_d, 0.1)
        vol_eff = vol / (min_d * mid_d * max_d + 1e-9)
        sa_vol = sa / max(vol / 1000, 1e-9)
        bends = random.randint(0, 4)
        sms = random.uniform(50, 90)
        hole_count = random.randint(8, 50)  # Many holes!

        row = [
            vol, sa, min_d, mid_d, max_d, aspect, vol_eff, sa_vol,
            t, random.uniform(0.6, 0.95),
            t / max(min_d, 0.1),
            bends, random.uniform(0.3, 0.8) if bends > 0 else 0, bends * random.uniform(5, 12),
            sms,
            random.uniform(0.3, 0.90),
            hole_count, 0, 0,  # Many holes, no pockets/threads
            0, random.randint(0, 2), 0,
            random.randint(1000, 12000),
            random.uniform(0.4, 0.85), random.uniform(2.0, 6.0),
            random.uniform(0.5, 0.90), random.uniform(0.6, 0.95),
            random.uniform(0.15, 0.45),
            # Face classification: CRITICAL - higher cylinder ratio due to hole surfaces
            random.uniform(0.55, 0.82),   # plane_ratio (moderate - area reduced by holes)
            random.uniform(0.12, 0.35),   # cylinder_ratio (HIGH - many hole inner surfaces!)
            random.uniform(0.0, 0.05),    # freeform_ratio (very low)
            random.randint(1, 4),          # paired_plane_count
            random.uniform(0.8, 4.0),      # dominant_thickness (thin)
            random.uniform(15, 50),        # cnc_score (moderate due to cylinders)
            random.uniform(45, 85),        # sheet_metal_score (moderate-high)
        ]
        _append_new_features(row, "sheet_metal", bends, t)
        X.append(row)
        y.append(LABEL_MAP["sheet_metal"])

    # Distribute CNC milling samples across subcategories
    n_3d_milled = n_per_class // 2
    n_precision_plate = n_per_class - n_3d_milled

    # --- CNC MILLING: 3D Machined Parts ---
    for _ in range(n_3d_milled):
        min_d = random.uniform(8, 80)
        mid_d = random.uniform(min_d, min_d * 3)
        max_d = random.uniform(mid_d, mid_d * 2)
        vol = min_d * mid_d * max_d * random.uniform(0.4, 0.85)
        sa = 2 * (min_d * mid_d + mid_d * max_d + min_d * max_d) * random.uniform(0.7, 1.1)
        aspect = max_d / max(min_d, 0.1)
        vol_eff = vol / (min_d * mid_d * max_d + 1e-9)
        sa_vol = sa / max(vol / 1000, 1e-9)
        sms = random.uniform(5, 40)

        row = [
            vol, sa, min_d, mid_d, max_d, aspect, vol_eff, sa_vol,
            random.uniform(5, 60), random.uniform(0.2, 0.6),
            random.uniform(0.5, 1.0),
            0, 0, 0,
            sms,
            random.uniform(0.05, 0.7),
            random.randint(0, 30), random.randint(1, 15), random.randint(0, 6),
            random.randint(0, 4), random.randint(0, 10), random.randint(0, 5),
            random.randint(1000, 50000),
            random.uniform(0.05, 0.35), random.uniform(0.5, 2.0),
            random.uniform(0.1, 0.5), random.uniform(0.1, 0.5),
            random.uniform(0.5, 0.9),
            # Face classification: CNC milling profile
            random.uniform(0.30, 0.70),   # plane_ratio (moderate)
            random.uniform(0.15, 0.45),   # cylinder_ratio (higher)
            random.uniform(0.05, 0.25),   # freeform_ratio (some)
            random.randint(0, 3),          # paired_plane_count (few)
            random.uniform(8, 60),         # dominant_thickness (thick)
            random.uniform(55, 90),        # cnc_score (high)
            random.uniform(5, 35),         # sheet_metal_score (low)
        ]
        _append_new_features(row, "cnc_milling", 0, min_d)
        X.append(row)
        y.append(LABEL_MAP["cnc_milling"])

    # --- CNC MILLING: Precision Machined Plates (TRAP CASES - look like sheet metal!) ---
    for _ in range(n_precision_plate):
        # These are THIN flat plates that are MACHINED, not sheet metal
        # Key discriminators: threads, precision pockets, undercuts, low aspect ratio
        t = random.uniform(4, 15)  # Thicker than typical sheet, but still flat
        min_d = t
        mid_d = random.uniform(40, 200)
        max_d = random.uniform(mid_d, mid_d * 2)
        vol = min_d * mid_d * max_d * random.uniform(0.70, 0.95)
        sa = 2 * (min_d * mid_d + mid_d * max_d + min_d * max_d) * random.uniform(0.8, 1.1)
        aspect = max_d / max(min_d, 0.1)  # Lower aspect ratio than true sheet metal
        vol_eff = vol / (min_d * mid_d * max_d + 1e-9)
        sa_vol = sa / max(vol / 1000, 1e-9)
        sms = random.uniform(20, 55)  # Moderate sheet metal score (the trap!)

        # Key CNC features that distinguish from sheet metal
        thread_count = random.randint(1, 8)  # Threads are CNC indicator!
        pocket_count = random.randint(2, 10)  # Multiple pockets
        undercut_count = random.randint(0, 3)

        row = [
            vol, sa, min_d, mid_d, max_d, aspect, vol_eff, sa_vol,
            random.uniform(4, 20), random.uniform(0.3, 0.7),
            random.uniform(0.3, 0.8),
            0, 0, 0,  # No bends
            sms,
            random.uniform(0.2, 0.8),
            random.randint(2, 20), pocket_count, thread_count,
            undercut_count, random.randint(2, 8), random.randint(1, 6),
            random.randint(2000, 30000),
            random.uniform(0.3, 0.6), random.uniform(1.0, 3.0),
            random.uniform(0.3, 0.6), random.uniform(0.3, 0.6),
            random.uniform(0.45, 0.75),
            # Face classification: looks somewhat like sheet metal!
            random.uniform(0.60, 0.85),   # plane_ratio (high - flat plate!)
            random.uniform(0.10, 0.30),   # cylinder_ratio (holes, bosses)
            random.uniform(0.02, 0.12),   # freeform_ratio (some)
            random.randint(1, 4),          # paired_plane_count (has pairs!)
            random.uniform(4, 15),         # dominant_thickness (borderline)
            random.uniform(45, 75),        # cnc_score (moderate-high)
            random.uniform(30, 60),        # sheet_metal_score (moderate - the trap!)
        ]
        _append_new_features(row, "cnc_milling", 0, t)
        X.append(row)
        y.append(LABEL_MAP["cnc_milling"])

    # --- CNC TURNING ---
    for _ in range(n_per_class):
        diameter = random.uniform(10, 120)
        length = random.uniform(diameter * 0.5, diameter * 5)
        min_d = diameter
        mid_d = diameter * random.uniform(0.95, 1.05)
        max_d = length
        vol = math.pi * (diameter / 2) ** 2 * length * random.uniform(0.5, 0.9)
        sa = 2 * math.pi * (diameter / 2) * length + 2 * math.pi * (diameter / 2) ** 2
        aspect = max_d / max(min_d, 0.1)
        vol_eff = vol / (min_d * mid_d * max_d + 1e-9)
        sa_vol = sa / max(vol / 1000, 1e-9)
        xy_sim = random.uniform(0.0, 0.12)
        sms = random.uniform(5, 30)

        row = [
            vol, sa, min_d, mid_d, max_d, aspect, vol_eff, sa_vol,
            random.uniform(5, 60), random.uniform(0.15, 0.5),
            random.uniform(0.3, 1.0),
            0, 0, 0,
            sms,
            xy_sim,
            random.randint(0, 15), random.randint(0, 5), random.randint(0, 8),
            random.randint(0, 3), random.randint(0, 6), 0,
            random.randint(500, 20000),
            random.uniform(0.05, 0.3), random.uniform(0.5, 2.0),
            random.uniform(0.1, 0.5), random.uniform(0.1, 0.5),
            random.uniform(0.4, 0.85),
            # Face classification: CNC turning profile
            random.uniform(0.10, 0.40),   # plane_ratio (low)
            random.uniform(0.40, 0.80),   # cylinder_ratio (high - cylindrical body)
            random.uniform(0.0, 0.15),    # freeform_ratio (low)
            random.randint(0, 2),          # paired_plane_count (few)
            random.uniform(8, 60),         # dominant_thickness (thick)
            random.uniform(45, 85),        # cnc_score (moderate-high)
            random.uniform(5, 25),         # sheet_metal_score (low)
        ]
        _append_new_features(row, "cnc_turning", 0, diameter)
        X.append(row)
        y.append(LABEL_MAP["cnc_turning"])

    return X, y


# ---------------------------------------------------------------------------
# Model wrapper
# ---------------------------------------------------------------------------

_MODEL_DIR = Path(__file__).parent.parent / "ml_models"
_MODEL_PATH = _MODEL_DIR / "process_classifier.pkl"
_FEEDBACK_PATH = _MODEL_DIR / "feedback_log.jsonl"
_MODEL_VERSION = "1.0.0"

_cached_model = None


class MLProcessClassifier:
    """Wrapper around a GradientBoosting classifier for process type prediction."""

    def __init__(self):
        self.model = None
        self.is_ready = False
        self._load_or_train()

    # ------------------------------------------------------------------
    def _load_or_train(self):
        global _cached_model
        if _cached_model is not None:
            self.model = _cached_model
            self.is_ready = True
            return

        # Try loading cached model
        if _MODEL_PATH.exists():
            try:
                with open(_MODEL_PATH, "rb") as f:
                    self.model = pickle.load(f)
                _cached_model = self.model
                self.is_ready = True
                logger.info("Loaded cached ML process classifier from %s", _MODEL_PATH)
                return
            except Exception as exc:
                logger.warning("Failed loading cached model: %s", exc)

        # Train on synthetic data
        try:
            self._train_model()
        except ImportError:
            logger.warning("scikit-learn not available – ML classification disabled")
        except Exception as exc:
            logger.error("ML model training failed: %s", exc)

    # ------------------------------------------------------------------
    def _train_model(self):
        from sklearn.ensemble import GradientBoostingClassifier
        from sklearn.preprocessing import StandardScaler
        from sklearn.pipeline import Pipeline
        from sklearn.model_selection import cross_val_score
        import numpy as np

        logger.info("Training ML process classifier on synthetic dataset ...")
        X, y = _generate_synthetic_dataset(n_per_class=600)

        pipe = Pipeline([
            ("scaler", StandardScaler()),
            ("clf", GradientBoostingClassifier(
                n_estimators=200,
                max_depth=5,
                learning_rate=0.1,
                subsample=0.8,
                min_samples_leaf=5,
                random_state=42,
            )),
        ])
        pipe.fit(X, y)

        # Quick cross-val to log quality
        scores = cross_val_score(pipe, X, y, cv=5, scoring="accuracy")
        logger.info("ML classifier CV accuracy: %.3f ± %.3f", scores.mean(), scores.std())

        # Save
        _MODEL_DIR.mkdir(parents=True, exist_ok=True)
        with open(_MODEL_PATH, "wb") as f:
            pickle.dump(pipe, f)
        logger.info("Saved ML model to %s", _MODEL_PATH)

        self.model = pipe
        global _cached_model
        _cached_model = pipe
        self.is_ready = True

    # ------------------------------------------------------------------
    def predict(self, features: Dict[str, float]) -> Optional[MLClassificationResult]:
        if not self.is_ready or self.model is None:
            return None

        try:
            import numpy as np

            vec = [features.get(name, 0.0) for name in FEATURE_NAMES]
            X = np.array([vec])
            proba = self.model.predict_proba(X)[0]
            pred_idx = int(np.argmax(proba))
            pred_label = IDX_MAP[pred_idx]

            probs = {PROCESS_LABELS[i]: float(proba[i]) for i in range(len(PROCESS_LABELS))}
            sorted_probs = sorted(proba, reverse=True)
            is_borderline = (sorted_probs[0] - sorted_probs[1]) < 0.15

            # Feature importances (from the GBC inside the pipeline)
            try:
                gbc = self.model.named_steps["clf"]
                importances = gbc.feature_importances_
                top_indices = np.argsort(importances)[::-1][:5]
                feat_imp = {FEATURE_NAMES[i]: float(importances[i]) for i in top_indices}
            except Exception:
                feat_imp = {}

            return MLClassificationResult(
                predicted_process=pred_label,
                probabilities=probs,
                confidence=float(sorted_probs[0]),
                is_borderline=is_borderline,
                feature_importances=feat_imp,
                model_version=_MODEL_VERSION,
            )
        except Exception as exc:
            logger.error("ML prediction failed: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Feedback loop: record confirmed classifications for future retraining
    # ------------------------------------------------------------------
    def record_feedback(self, features: Dict[str, float], confirmed_process: str):
        """Log a confirmed classification for future model retraining."""
        try:
            _MODEL_DIR.mkdir(parents=True, exist_ok=True)
            entry = {
                "features": {k: features.get(k, 0.0) for k in FEATURE_NAMES},
                "confirmed_process": confirmed_process,
            }
            with open(_FEEDBACK_PATH, "a") as f:
                f.write(json.dumps(entry) + "\n")
            logger.debug("Recorded feedback for %s", confirmed_process)
        except Exception as exc:
            logger.warning("Failed to record feedback: %s", exc)

    # ------------------------------------------------------------------
    def retrain_with_feedback(self, min_samples: int = 50):
        """
        Retrain model incorporating production feedback data.
        Called periodically (e.g. weekly cron or admin trigger).
        """
        if not _FEEDBACK_PATH.exists():
            logger.info("No feedback data to train on")
            return

        try:
            import numpy as np

            feedback_X = []
            feedback_y = []
            with open(_FEEDBACK_PATH) as f:
                for line in f:
                    entry = json.loads(line.strip())
                    vec = [entry["features"].get(name, 0.0) for name in FEATURE_NAMES]
                    label = LABEL_MAP.get(entry["confirmed_process"])
                    if label is not None:
                        feedback_X.append(vec)
                        feedback_y.append(label)

            if len(feedback_X) < min_samples:
                logger.info("Only %d feedback samples (need %d) – skipping retrain",
                            len(feedback_X), min_samples)
                return

            # Combine synthetic + feedback
            syn_X, syn_y = _generate_synthetic_dataset(n_per_class=400)
            combined_X = syn_X + feedback_X
            combined_y = syn_y + feedback_y

            # Weight feedback samples 3x higher than synthetic
            sample_weight = np.array(
                [1.0] * len(syn_X) + [3.0] * len(feedback_X)
            )

            from sklearn.ensemble import GradientBoostingClassifier
            from sklearn.preprocessing import StandardScaler
            from sklearn.pipeline import Pipeline

            pipe = Pipeline([
                ("scaler", StandardScaler()),
                ("clf", GradientBoostingClassifier(
                    n_estimators=250,
                    max_depth=6,
                    learning_rate=0.08,
                    subsample=0.8,
                    min_samples_leaf=4,
                    random_state=42,
                )),
            ])
            X_arr = np.array(combined_X)
            y_arr = np.array(combined_y)
            pipe.fit(X_arr, y_arr, clf__sample_weight=sample_weight)

            # Save
            with open(_MODEL_PATH, "wb") as f:
                pickle.dump(pipe, f)

            self.model = pipe
            global _cached_model
            _cached_model = pipe
            logger.info("Retrained with %d feedback samples", len(feedback_X))

        except Exception as exc:
            logger.error("Retrain failed: %s", exc)


# ---------------------------------------------------------------------------
# Module-level helper: build feature vector from analysis data
# ---------------------------------------------------------------------------

def build_feature_vector(
    bbox_dims: List[float],
    volume_mm3: float,
    surface_area_mm2: float,
    detected_thickness: Optional[float],
    thickness_confidence: float,
    bend_count: int,
    bend_confidence: float,
    bend_complexity: float,
    sheet_metal_score: float,
    hole_count: int = 0,
    pocket_count: int = 0,
    thread_count: int = 0,
    undercut_count: int = 0,
    fillet_count: int = 0,
    slot_count: int = 0,
    triangle_count: int = 0,
    advanced_metrics: Optional[Dict] = None,
    face_classification: Optional[Dict] = None,
    # Feature analysis signals (GAP 7)
    feature_signals: Optional[Dict] = None,
    bends: Optional[List] = None,
    undercuts: Optional[List] = None,
    draft_analysis: Optional[Any] = None,
    # NEW: Extended analysis inputs
    surface_finish_analysis: Optional[Any] = None,
    tolerance_analysis: Optional[Any] = None,
    machining_complexity: Optional[Any] = None,
    casting_analysis: Optional[Any] = None,
    weldment_analysis: Optional[Any] = None,
    body_count: int = 1,
) -> Dict[str, float]:
    """Build the feature vector dict matching FEATURE_NAMES."""
    dims = sorted(bbox_dims)
    min_d = dims[0] if len(dims) >= 1 else 1.0
    mid_d = dims[1] if len(dims) >= 2 else min_d
    max_d = dims[2] if len(dims) >= 3 else mid_d

    envelope = min_d * mid_d * max_d if min_d * mid_d * max_d > 0 else 1.0
    aspect = max_d / max(min_d, 0.01)
    vol_eff = volume_mm3 / envelope
    sa_vol = surface_area_mm2 / max(volume_mm3 / 1000, 1e-9)
    thickness = detected_thickness or min_d
    xy_sim = abs(min_d - mid_d) / max(min_d, mid_d) if max(min_d, mid_d) > 0 else 0

    am = advanced_metrics or {}
    uniform_ratio = am.get("thickness_analysis", {}).get("uniform_ratio", 0.0)
    cluster_dom = am.get("thickness_analysis", {}).get("cluster_dominance", 1.0)
    planarity = am.get("planarity_score", 0.0)
    wall_cons = am.get("wall_thickness_consistency", 0.0)
    cnc_like = am.get("cnc_likelihood", 0.5)

    # Face classification features
    fc = face_classification or {}
    fc_hist = fc.get("histogram", {})
    # FIX: face_plane_ratio etc. are in fc directly, not in fc_hist
    face_plane_ratio = fc.get("plane_ratio", 0.0)
    face_cylinder_ratio = fc.get("cylinder_ratio", 0.0)
    face_freeform_ratio = fc.get("freeform_ratio", 0.0)
    face_paired_count = fc.get("paired_plane_count", 0)
    face_dom_thick = fc.get("dominant_pair_thickness", 0.0) or 0.0
    face_cnc = fc.get("cnc_face_score", 0.0)
    face_sm = fc.get("sheet_metal_face_score", 0.0)
    # Revolution count from histogram, but also get revolution_ratio for turning
    face_revolution_count = fc_hist.get("revolution", 0)
    face_revolution_ratio = fc.get("revolution_ratio", 0.0)
    
    # NEW: Feature signals extraction (GAP 7)
    fs = feature_signals or {}
    rib_count = fs.get("rib_analysis", {}).get("total_count", 0)
    boss_count = fs.get("boss_analysis", {}).get("total_count", 0)
    chamfer_count = fs.get("chamfer_analysis", {}).get("total_count", 0)
    
    # FIX: counterbore/countersink are in hole_pattern_analysis, NOT hole_analysis
    hole_pattern_analysis = fs.get("hole_pattern_analysis", {})
    counterbore_count = hole_pattern_analysis.get("counterbore_count", 0)
    countersink_count = hole_pattern_analysis.get("countersink_count", 0)
    
    # Surface steps and hole patterns
    surface_step_count = fs.get("surface_step_analysis", {}).get("distinct_levels", 0)
    # FIX: Use total_count for hole patterns, not missing "pattern_count"
    hole_pattern_count = hole_pattern_analysis.get("total_count", 0)
    
    # Bend radius ratio
    bend_radius_analysis = fs.get("bend_radius_analysis", {})
    avg_bend_radius = bend_radius_analysis.get("avg_radius_mm", 0.0)
    bend_radius_ratio = avg_bend_radius / max(thickness, 0.1) if thickness > 0 else 0.0
    
    # Edge sharpness
    edge_sharpness = fs.get("edge_sharpness_analysis", {})
    sharp_edge_count = edge_sharpness.get("sharp_edge_count", 0)
    total_edge_count = edge_sharpness.get("total_edge_count", 1)
    edge_sharpness_ratio = sharp_edge_count / max(total_edge_count, 1)
    
    # Draft analysis for injection molding
    draft_angle_avg = 0.0
    if draft_analysis:
        if isinstance(draft_analysis, dict):
            draft_angle_avg = draft_analysis.get("avg_draft_angle", 0.0)
        elif isinstance(draft_analysis, list) and len(draft_analysis) > 0:
            draft_angles = [getattr(d, 'draft_angle', 0) for d in draft_analysis]
            draft_angle_avg = sum(draft_angles) / len(draft_angles) if draft_angles else 0.0
    
    # Undercut severity count
    undercut_major_count = 0
    if undercuts:
        undercut_major_count = sum(1 for u in undercuts 
                                   if getattr(u, 'severity', 'minor') == 'major')

    # NEW: Surface finish features
    min_ra_required = 3.2  # Default standard finish
    precision_face_count_finish = 0
    finish_complexity_score = 0.0
    if surface_finish_analysis:
        min_ra_required = getattr(surface_finish_analysis, 'min_ra_required', 3.2)
        precision_face_count_finish = getattr(surface_finish_analysis, 'precision_face_count', 0)
        finish_complexity_score = getattr(surface_finish_analysis, 'finish_complexity_score', 0.0)
    
    # NEW: Tolerance features
    tightest_tolerance_mm = 0.1  # Default IT8
    precision_feature_count_tol = 0
    datum_count = 0
    tolerance_complexity_val = 0.0
    if tolerance_analysis:
        tightest_tolerance_mm = getattr(tolerance_analysis, 'min_tolerance_mm', 0.1)
        precision_feature_count_tol = getattr(tolerance_analysis, 'precision_feature_count', 0)
        datum_count = getattr(tolerance_analysis, 'datum_count', 0)
        tolerance_complexity_val = getattr(tolerance_analysis, 'tolerance_complexity_score', 0.0)
    
    # NEW: Machining complexity features
    requires_5axis_flag = 0.0
    requires_4axis_flag = 0.0
    is_turn_mill_flag = 0.0
    access_direction_count = 1
    setup_count_estimate = 1
    machining_complexity_score = 0.0
    if machining_complexity:
        requires_5axis_flag = 1.0 if getattr(machining_complexity, 'requires_5axis', False) else 0.0
        requires_4axis_flag = 1.0 if getattr(machining_complexity, 'requires_4axis', False) else 0.0
        is_turn_mill_flag = 1.0 if getattr(machining_complexity, 'is_turn_mill', False) else 0.0
        mc_milling = getattr(machining_complexity, 'milling_complexity', None)
        if mc_milling:
            access_direction_count = getattr(mc_milling, 'access_direction_count', 1)
        setup_count_estimate = getattr(machining_complexity, 'estimated_setup_count', 1)
        machining_complexity_score = getattr(machining_complexity, 'complexity_score', 0.0)
    
    # NEW: Process detection features
    is_likely_cast_flag = 0.0
    casting_confidence_val = 0.0
    if casting_analysis:
        is_likely_cast_flag = 1.0 if getattr(casting_analysis, 'is_likely_cast', False) else 0.0
        casting_confidence_val = getattr(casting_analysis, 'confidence', 0.0)
    
    is_weldment_flag = 0.0
    weld_joint_count_val = 0
    if weldment_analysis:
        is_weldment_flag = 1.0 if getattr(weldment_analysis, 'is_weldment', False) else 0.0
        weld_joint_count_val = getattr(weldment_analysis, 'joint_count', 0)

    return {
        "volume_mm3": volume_mm3,
        "surface_area_mm2": surface_area_mm2,
        "min_dim": min_d,
        "mid_dim": mid_d,
        "max_dim": max_d,
        "aspect_ratio": aspect,
        "volume_efficiency": vol_eff,
        "sa_to_vol_ratio": sa_vol,
        "detected_thickness": thickness,
        "thickness_confidence": thickness_confidence,
        "thickness_to_min_dim_ratio": thickness / max(min_d, 0.01),
        "bend_count": bend_count,
        "bend_confidence": bend_confidence,
        "bend_complexity": bend_complexity,
        "sheet_metal_score": sheet_metal_score,
        "xy_similarity": xy_sim,
        "hole_count": hole_count,
        "pocket_count": pocket_count,
        "thread_count": thread_count,
        "undercut_count": undercut_count,
        "fillet_count": fillet_count,
        "slot_count": slot_count,
        "triangle_count": triangle_count,
        "uniform_ratio": uniform_ratio,
        "cluster_dominance": cluster_dom,
        "planarity_score": planarity,
        "wall_consistency": wall_cons,
        "cnc_likelihood": cnc_like,
        "face_plane_ratio": face_plane_ratio,
        "face_cylinder_ratio": face_cylinder_ratio,
        "face_freeform_ratio": face_freeform_ratio,
        "face_paired_plane_count": face_paired_count,
        "face_dominant_thickness": face_dom_thick,
        "face_cnc_score": face_cnc,
        "face_sheet_metal_score": face_sm,
        # Feature analysis signals
        "rib_count": rib_count,
        "boss_count": boss_count,
        "chamfer_count": chamfer_count,
        "counterbore_count": counterbore_count,
        "countersink_count": countersink_count,
        "surface_step_count": surface_step_count,
        "hole_pattern_count": hole_pattern_count,
        "bend_radius_ratio": bend_radius_ratio,
        "edge_sharpness_ratio": edge_sharpness_ratio,
        "face_revolution_count": face_revolution_count,
        "draft_angle_avg": draft_angle_avg,
        "undercut_major_count": undercut_major_count,
        # NEW: Surface finish features
        "min_ra_required": min_ra_required,
        "precision_face_count": precision_face_count_finish,
        "finish_complexity_score": finish_complexity_score,
        # NEW: Tolerance features
        "tightest_tolerance_mm": tightest_tolerance_mm,
        "precision_feature_count": precision_feature_count_tol,
        "datum_count": datum_count,
        "tolerance_complexity": tolerance_complexity_val,
        # NEW: Machining complexity features
        "requires_5axis": requires_5axis_flag,
        "requires_4axis": requires_4axis_flag,
        "is_turn_mill": is_turn_mill_flag,
        "access_direction_count": access_direction_count,
        "setup_count_estimate": setup_count_estimate,
        "machining_complexity": machining_complexity_score,
        # NEW: Process detection features
        "is_likely_cast": is_likely_cast_flag,
        "casting_confidence": casting_confidence_val,
        "is_weldment": is_weldment_flag,
        "weld_joint_count": weld_joint_count_val,
        "body_count": body_count,
    }
