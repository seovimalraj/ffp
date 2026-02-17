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
from typing import Dict, List, Optional, Tuple

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
]

PROCESS_LABELS = ["sheet_metal", "cnc_milling", "cnc_turning"]
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

def _generate_synthetic_dataset(n_per_class: int = 500) -> Tuple[List[List[float]], List[int]]:
    """
    Generate synthetic training data from manufacturing heuristics.
    Each sample is a realistic feature vector for a known process type.
    """
    import random
    random.seed(42)

    X: List[List[float]] = []
    y: List[int] = []

    for _ in range(n_per_class):
        # --- SHEET METAL ---
        t = random.uniform(0.5, 6.0)
        min_d = t
        mid_d = random.uniform(50, 400)
        max_d = random.uniform(mid_d, mid_d * 3)
        vol = min_d * mid_d * max_d * random.uniform(0.15, 0.55)
        sa = 2 * (min_d * mid_d + mid_d * max_d + min_d * max_d) * random.uniform(0.8, 1.3)
        aspect = max_d / max(min_d, 0.1)
        vol_eff = vol / (min_d * mid_d * max_d + 1e-9)
        sa_vol = sa / max(vol / 1000, 1e-9)
        bends = random.randint(0, 12)
        sms = random.uniform(55, 98)

        row = [
            vol, sa, min_d, mid_d, max_d, aspect, vol_eff, sa_vol,
            t, random.uniform(0.6, 0.98),
            t / max(min_d, 0.1),
            bends, random.uniform(0.4, 0.95), bends * random.uniform(5, 15),
            sms,
            random.uniform(0.3, 0.95),
            random.randint(0, 8), 0, random.randint(0, 2),
            0, random.randint(0, 4), 0,
            random.randint(500, 8000),
            random.uniform(0.3, 0.9), random.uniform(1.5, 8.0),
            random.uniform(0.5, 0.95), random.uniform(0.6, 0.98),
            random.uniform(0.1, 0.4),
            # Face classification: sheet metal profile
            random.uniform(0.75, 0.98),   # plane_ratio (high)
            random.uniform(0.0, 0.15),    # cylinder_ratio (low)
            random.uniform(0.0, 0.05),    # freeform_ratio (very low)
            random.randint(2, 8),          # paired_plane_count (several)
            random.uniform(0.5, 6.0),      # dominant_thickness (thin)
            random.uniform(5, 35),         # cnc_score (low)
            random.uniform(55, 95),        # sheet_metal_score (high)
        ]
        X.append(row)
        y.append(LABEL_MAP["sheet_metal"])

        # --- CNC MILLING ---
        min_d = random.uniform(5, 80)
        mid_d = random.uniform(min_d, min_d * 3)
        max_d = random.uniform(mid_d, mid_d * 2)
        vol = min_d * mid_d * max_d * random.uniform(0.4, 0.85)
        sa = 2 * (min_d * mid_d + mid_d * max_d + min_d * max_d) * random.uniform(0.7, 1.1)
        aspect = max_d / max(min_d, 0.1)
        vol_eff = vol / (min_d * mid_d * max_d + 1e-9)
        sa_vol = sa / max(vol / 1000, 1e-9)
        sms = random.uniform(5, 45)

        row = [
            vol, sa, min_d, mid_d, max_d, aspect, vol_eff, sa_vol,
            random.uniform(3, 60), random.uniform(0.2, 0.6),
            random.uniform(0.5, 1.0),
            0, 0, 0,
            sms,
            random.uniform(0.05, 0.7),
            random.randint(0, 30), random.randint(0, 15), random.randint(0, 6),
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
            random.uniform(5, 60),         # dominant_thickness (thick)
            random.uniform(50, 90),        # cnc_score (high)
            random.uniform(5, 40),         # sheet_metal_score (low)
        ]
        X.append(row)
        y.append(LABEL_MAP["cnc_milling"])

        # --- CNC TURNING ---
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
    face_plane_ratio = fc_hist.get("plane_ratio", 0.0)
    face_cylinder_ratio = fc_hist.get("cylinder_ratio", 0.0)
    face_freeform_ratio = fc_hist.get("freeform_ratio", 0.0)
    face_paired_count = fc.get("paired_plane_count", 0)
    face_dom_thick = fc.get("dominant_pair_thickness", 0.0)
    face_cnc = fc.get("cnc_face_score", 0.0)
    face_sm = fc.get("sheet_metal_face_score", 0.0)

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
    }
