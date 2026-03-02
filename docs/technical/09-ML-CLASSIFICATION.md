# ML Classification System Technical Reference

**Version:** 1.0  
**Date:** February 2026  
**Classification:** Technical Reference

---

## 1. Overview

The ML Classification System supplements the rule-based ProcessClassifier with a gradient-boosted machine learning model. It provides calibrated probability estimates when rule-based confidence is uncertain, enabling more accurate manufacturing process predictions.

---

## 2. System Architecture

### 2.1 Hybrid Classification Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   HYBRID CLASSIFICATION PIPELINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   CAD File                                                                   │
│      │                                                                       │
│      ▼                                                                       │
│  ┌────────────────────┐                                                      │
│  │  Feature Extraction │ ──► 65-dimensional feature vector                   │
│  └────────────────────┘                                                      │
│            │                                                                 │
│            ├──────────────────────────┬──────────────────────────┐          │
│            ▼                          ▼                          │          │
│  ┌──────────────────┐      ┌──────────────────┐                 │          │
│  │   Rule Engine     │      │   ML Classifier   │                 │          │
│  │   (11-tier)       │      │   (XGBoost-style) │                 │          │
│  └──────────────────┘      └──────────────────┘                 │          │
│            │                          │                          │          │
│            ▼                          ▼                          │          │
│    result + confidence         probabilities + confidence        │          │
│            │                          │                          │          │
│            └──────────┬───────────────┘                          │          │
│                       ▼                                          │          │
│               ┌──────────────┐                                   │          │
│               │   Arbiter    │ ◄─────────────────────────────────┘          │
│               └──────────────┘                                              │
│                       │                                                      │
│                       ▼                                                      │
│               Final Classification                                           │
│               + Combined Confidence                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 When ML Is Consulted

The ML classifier is invoked when:
- **Rule-based confidence < 0.80** (marginal certainty)
- **Borderline geometry** (signals for multiple processes)
- **Explicit ML mode** requested via API

```python
# classification.py - ML consultation logic
class ProcessClassifier:
    ML_CONFIDENCE_THRESHOLD = 0.80
    
    def classify(self, ...):
        # Run rule-based classification first
        rule_result, rule_confidence = self._rule_based_classify(...)
        
        # Consult ML when rule confidence is marginal
        if rule_confidence < self.ML_CONFIDENCE_THRESHOLD:
            ml_result = self._ml_classifier.predict(features)
            
            if ml_result and ml_result.confidence > rule_confidence:
                # ML has higher confidence - consider override
                if ml_result.predicted_process != rule_result:
                    # Return ML result with blended confidence
                    return self._blend_results(rule_result, ml_result)
        
        return rule_result, rule_confidence
```

---

## 3. Feature Vector

### 3.1 65-Dimensional Feature Space

The ML model operates on a carefully designed feature vector:

```python
FEATURE_NAMES = [
    # Geometry basics (0-7)
    "volume_mm3",
    "surface_area_mm2",
    "min_dim",
    "mid_dim",
    "max_dim",
    "aspect_ratio",
    "volume_efficiency",
    "sa_to_vol_ratio",
    
    # Thickness analysis (8-11)
    "detected_thickness",
    "thickness_confidence",
    "thickness_to_min_dim_ratio",
    
    # Bend analysis (12-14)
    "bend_count",
    "bend_confidence",
    "bend_complexity",
    
    # Score & shape (15-17)
    "sheet_metal_score",
    "xy_similarity",       # Cylindrical detection
    
    # Feature counts (17-22)
    "hole_count",
    "pocket_count",
    "thread_count",
    "undercut_count",
    "fillet_count",
    "slot_count",
    
    # Mesh complexity (23)
    "triangle_count",
    
    # Advanced thickness (24-27)
    "uniform_ratio",
    "cluster_dominance",
    "planarity_score",
    "wall_consistency",
    "cnc_likelihood",
    
    # Face classification (28-34)
    "face_plane_ratio",
    "face_cylinder_ratio",
    "face_freeform_ratio",
    "face_paired_plane_count",
    "face_dominant_thickness",
    "face_cnc_score",
    "face_sheet_metal_score",
    
    # Feature analysis signals (35-46)
    "rib_count",
    "boss_count",
    "chamfer_count",
    "counterbore_count",
    "countersink_count",
    "surface_step_count",
    "hole_pattern_count",
    "bend_radius_ratio",
    "edge_sharpness_ratio",
    "face_revolution_count",
    "draft_angle_avg",
    "undercut_major_count",
    
    # Surface finish features (47-49)
    "min_ra_required",
    "precision_face_count",
    "finish_complexity_score",
    
    # Tolerance features (50-53)
    "tightest_tolerance_mm",
    "precision_feature_count",
    "datum_count",
    "tolerance_complexity",
    
    # Machining complexity (54-59)
    "requires_5axis",
    "requires_4axis",
    "is_turn_mill",
    "access_direction_count",
    "setup_count_estimate",
    "machining_complexity",
    
    # Process detection (60-64)
    "is_likely_cast",
    "casting_confidence",
    "is_weldment",
    "weld_joint_count",
    "body_count",
]
```

### 3.2 Feature Categories

| Category | Features | Purpose |
|----------|----------|---------|
| **Geometry** | volume, surface_area, dimensions | Basic part shape |
| **Thickness** | detected_thickness, confidence, ratio | Sheet metal detection |
| **Bends** | count, confidence, complexity | Sheet metal forming |
| **Features** | holes, pockets, threads, undercuts | Machining indicators |
| **Face Analysis** | plane/cylinder/freeform ratios | B-Rep classification |
| **Complexity** | 5axis, turn_mill, setup_count | Process selection |
| **Process Hints** | is_likely_cast, is_weldment | Special processes |

---

## 4. Model Architecture

### 4.1 Gradient Boosted Trees

```python
# ml_classifier.py - Model configuration
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

pipe = Pipeline([
    # Feature normalization
    ("scaler", StandardScaler()),
    
    # Gradient boosted classifier (XGBoost-style)
    ("clf", GradientBoostingClassifier(
        n_estimators=200,        # 200 weak learners
        max_depth=5,             # Tree depth limit
        learning_rate=0.1,       # Shrinkage
        subsample=0.8,           # Row sampling
        min_samples_leaf=5,      # Leaf constraint
        random_state=42,         # Reproducibility
    )),
])
```

### 4.2 Process Labels

The model classifies into 11 manufacturing processes:

```python
PROCESS_LABELS = [
    "sheet_metal",           # Laser cut + formed
    "cnc_milling",          # 3-axis milling
    "cnc_turning",          # Lathe operations
    "cnc_turn_mill",        # Turn-mill hybrid
    "cnc_5axis",            # 5-axis milling
    "injection_molding",    # Plastic injection
    "die_casting",          # Die cast aluminum/zinc
    "sand_casting",         # Sand casting
    "investment_casting",   # Lost-wax casting
    "3d_printing",          # Additive manufacturing
    "weldment",             # Welded assembly
]
```

### 4.3 Why Gradient Boosting?

| Criterion | Why GBC Works |
|-----------|---------------|
| **Tabular Data** | GBC excels at structured features |
| **Interpretability** | Feature importances available |
| **Few Samples** | Works well with synthetic data |
| **Probability Calibration** | Native probability estimates |
| **No GPU Required** | Fast CPU inference |
| **Robustness** | Handles missing features gracefully |

---

## 5. Training Strategy

### 5.1 Synthetic Data Generation

The model trains on synthetically generated data derived from manufacturing heuristics:

```python
def _generate_synthetic_dataset(n_per_class: int = 500):
    """
    Generate synthetic training data from manufacturing heuristics.
    Each sample is a realistic feature vector for a known process type.
    """
    X: List[List[float]] = []
    y: List[int] = []
    
    # Sheet metal variations
    n_flat_sheet = n_per_class // 3    # Laser-cut flat parts
    n_bent_sheet = n_per_class // 3    # Formed with bends
    n_holey_sheet = n_per_class // 3   # Punched patterns
    
    # FLAT SHEET METAL (high volume efficiency, no bends)
    for _ in range(n_flat_sheet):
        t = random.uniform(0.5, 6.0)           # Thickness
        vol_eff = random.uniform(0.85, 1.0)    # HIGH efficiency
        bends = 0                               # No bends
        plane_ratio = random.uniform(0.80, 0.98)  # Very planar
        # ... build feature vector
        
    # BENT SHEET METAL (lower volume efficiency, multiple bends)
    for _ in range(n_bent_sheet):
        t = random.uniform(0.5, 5.0)
        vol_eff = random.uniform(0.15, 0.55)   # LOWER efficiency
        bends = random.randint(2, 12)          # Has bends
        # ... build feature vector
    
    # CNC MILLING: 3D Machined Parts
    for _ in range(n_3d_milled):
        min_d = random.uniform(8, 80)          # Thicker
        pocket_count = random.randint(1, 15)   # Has pockets
        thread_count = random.randint(0, 6)    # May have threads
        # ... build feature vector
    
    # CNC TURNING (cylindrical, high xy_similarity)
    for _ in range(n_per_class):
        xy_sim = random.uniform(0.0, 0.12)     # Very cylindrical
        cylinder_ratio = random.uniform(0.40, 0.80)  # High
        # ... build feature vector
    
    # ... similar for all 11 process types
    
    return X, y
```

### 5.2 Training Edge Cases

The synthetic data explicitly includes "trap cases" that look like one process but are another:

| Trap Case | Appearance | True Process |
|-----------|-----------|--------------|
| Precision Machined Plates | Flat, thin, high plane ratio | CNC Milling |
| Sheet Metal with Many Holes | Higher cylinder ratio | Sheet Metal |
| Complex Turned Parts | Milled features on cylindrical body | Turn-Mill |
| Cast with Machined Features | Lost-wax + post-machining | Investment Casting |

```python
# PRECISION MACHINED PLATES (look like sheet metal!)
for _ in range(n_precision_plate):
    t = random.uniform(4, 15)             # Thicker than sheet
    sms = random.uniform(20, 55)          # Moderate SMS (trap!)
    thread_count = random.randint(1, 8)   # KEY: threads!
    pocket_count = random.randint(2, 10)  # KEY: pockets!
    # These are CNC despite flat appearance
    y.append(LABEL_MAP["cnc_milling"])
```

---

## 6. Prediction Pipeline

### 6.1 Feature Vector Construction

```python
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
    # ... 50+ additional parameters
) -> Dict[str, float]:
    """Build the 65-dimensional feature vector."""
    
    dims = sorted(bbox_dims)
    min_d, mid_d, max_d = dims[0], dims[1], dims[2]
    
    return {
        "volume_mm3": volume_mm3,
        "surface_area_mm2": surface_area_mm2,
        "min_dim": min_d,
        "mid_dim": mid_d,
        "max_dim": max_d,
        "aspect_ratio": max_d / max(min_d, 0.1),
        "volume_efficiency": volume_mm3 / (min_d * mid_d * max_d + 1e-9),
        "sa_to_vol_ratio": surface_area_mm2 / max(volume_mm3 / 1000, 1e-9),
        "detected_thickness": detected_thickness or 0,
        "thickness_confidence": thickness_confidence,
        # ... remaining 55 features
    }
```

### 6.2 Prediction

```python
def predict(self, features: Dict[str, float]) -> Optional[MLClassificationResult]:
    if not self.is_ready or self.model is None:
        return None
    
    # Build feature array in correct order
    vec = [features.get(name, 0.0) for name in FEATURE_NAMES]
    X = np.array([vec])
    
    # Get probability distribution
    proba = self.model.predict_proba(X)[0]
    pred_idx = int(np.argmax(proba))
    pred_label = IDX_MAP[pred_idx]
    
    # Build probability map
    probs = {PROCESS_LABELS[i]: float(proba[i]) 
             for i in range(len(PROCESS_LABELS))}
    
    # Detect borderline cases (top-2 within 15%)
    sorted_probs = sorted(proba, reverse=True)
    is_borderline = (sorted_probs[0] - sorted_probs[1]) < 0.15
    
    # Extract feature importances for explainability
    gbc = self.model.named_steps["clf"]
    importances = gbc.feature_importances_
    top_indices = np.argsort(importances)[::-1][:5]
    feat_imp = {FEATURE_NAMES[i]: float(importances[i]) 
                for i in top_indices}
    
    return MLClassificationResult(
        predicted_process=pred_label,
        probabilities=probs,
        confidence=float(sorted_probs[0]),
        is_borderline=is_borderline,
        feature_importances=feat_imp,
        model_version="1.0.0",
    )
```

---

## 7. Result Data Model

### 7.1 MLClassificationResult

```python
@dataclass
class MLClassificationResult:
    predicted_process: str          # Primary prediction
    probabilities: Dict[str, float] # Per-class probabilities
    confidence: float               # Max probability (0-1)
    is_borderline: bool            # Top-2 within 15%
    feature_importances: Dict[str, float]  # Top 5 drivers
    model_version: str              # Model version tag
```

### 7.2 Example Output

```json
{
  "predicted_process": "sheet_metal",
  "probabilities": {
    "sheet_metal": 0.7234,
    "cnc_milling": 0.1856,
    "cnc_turning": 0.0312,
    "cnc_5axis": 0.0245,
    "weldment": 0.0153,
    "die_casting": 0.0098,
    "injection_molding": 0.0051,
    "cnc_turn_mill": 0.0021,
    "sand_casting": 0.0015,
    "investment_casting": 0.0010,
    "3d_printing": 0.0005
  },
  "confidence": 0.7234,
  "is_borderline": false,
  "feature_importances": {
    "detected_thickness": 0.142,
    "volume_efficiency": 0.118,
    "bend_count": 0.095,
    "face_plane_ratio": 0.082,
    "face_paired_plane_count": 0.071
  },
  "model_version": "1.0.0"
}
```

---

## 8. Continuous Learning

### 8.1 Feedback Loop

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CONTINUOUS LEARNING LOOP                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────┐      ┌──────────────┐      ┌──────────────┐         │
│   │  Model   │──────▶   Predict    │──────▶   User/PM     │         │
│   │  v1.0    │      │  Process     │      │  Review       │         │
│   └──────────┘      └──────────────┘      └──────────────┘         │
│        ▲                                         │                  │
│        │                                         ▼                  │
│   ┌──────────┐      ┌──────────────┐      ┌──────────────┐         │
│   │  Retrain │◀─────│  Aggregate   │◀─────│  Confirm/    │         │
│   │  Weekly  │      │  Feedback    │      │  Correct     │         │
│   └──────────┘      └──────────────┘      └──────────────┘         │
│                                                                      │
│   Result: Model v1.1 with production data weighting                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 Recording Feedback

```python
def record_feedback(self, features: Dict[str, float], confirmed_process: str):
    """Log confirmed classification for future retraining."""
    entry = {
        "features": {k: features.get(k, 0.0) for k in FEATURE_NAMES},
        "confirmed_process": confirmed_process,
    }
    with open(_FEEDBACK_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")
```

### 8.3 Retraining with Feedback

```python
def retrain_with_feedback(self, min_samples: int = 50):
    """Retrain model incorporating production feedback."""
    
    # Load feedback data
    feedback_X, feedback_y = load_feedback_data()
    
    if len(feedback_X) < min_samples:
        return  # Not enough data yet
    
    # Combine synthetic + feedback data
    syn_X, syn_y = _generate_synthetic_dataset(n_per_class=400)
    combined_X = syn_X + feedback_X
    combined_y = syn_y + feedback_y
    
    # Weight feedback samples 3x higher than synthetic
    sample_weight = np.array(
        [1.0] * len(syn_X) + [3.0] * len(feedback_X)
    )
    
    # Retrain with weighted samples
    pipe.fit(X_arr, y_arr, clf__sample_weight=sample_weight)
    
    # Save updated model
    with open(_MODEL_PATH, "wb") as f:
        pickle.dump(pipe, f)
```

---

## 9. Model Management

### 9.1 Initialization Strategy

```python
# At application startup
def pretrain_ml_classifier() -> bool:
    """Pre-train the ML classifier (call once at startup)."""
    clf = get_ml_classifier()
    if clf.is_ready:
        return True  # Already trained
    
    clf._train_model()
    return clf.is_ready

# Singleton access pattern
_classifier_instance = None

def get_ml_classifier() -> MLProcessClassifier:
    """Get the singleton ML classifier instance."""
    global _classifier_instance
    if _classifier_instance is None:
        _classifier_instance = MLProcessClassifier()
    return _classifier_instance
```

### 9.2 Loading Strategy

```python
def _load_cached_only(self):
    """Load cached model - never train during analysis to avoid timeouts."""
    global _cached_model
    
    # Check in-memory cache first
    if _cached_model is not None:
        self.model = _cached_model
        self.is_ready = True
        return
    
    # Try loading from disk
    if _MODEL_PATH.exists():
        with open(_MODEL_PATH, "rb") as f:
            self.model = pickle.load(f)
        _cached_model = self.model
        self.is_ready = True
        return
    
    # No model available - won't train here
    self.is_ready = False
```

### 9.3 Model Versioning

| Version | Training Data | Features | Accuracy |
|---------|--------------|----------|----------|
| 1.0.0 | 6,600 synthetic | 65 | ~92% CV |
| 1.1.0 | + production feedback | 65 | TBD |

---

## 10. API Integration

### 10.1 Classification Response with ML

```json
{
  "classification": {
    "process": "sheet_metal",
    "confidence": 0.85,
    "alternative_process": "cnc_milling",
    "alternative_confidence": 0.12
  },
  "ml_classification": {
    "predicted_process": "sheet_metal",
    "confidence": 0.7234,
    "is_borderline": false,
    "probabilities": {
      "sheet_metal": 0.7234,
      "cnc_milling": 0.1856
    },
    "feature_importances": {
      "detected_thickness": 0.142,
      "volume_efficiency": 0.118
    },
    "model_version": "1.0.0"
  },
  "classification_method": "hybrid",
  "reasoning": [
    "Rule engine: 85% sheet metal (tier 3: thickness)",
    "ML model: 72% sheet metal (confirms)",
    "Top ML features: thickness=0.14, vol_eff=0.12"
  ]
}
```

---

## 11. Performance Characteristics

### 11.1 Latency

| Operation | Time |
|-----------|------|
| Model load (cold) | ~200ms |
| Model load (cached) | < 1ms |
| Feature vector build | ~5ms |
| Prediction | ~2ms |
| Full pipeline | ~10ms |

### 11.2 Accuracy Metrics

| Process | Precision | Recall | F1 |
|---------|-----------|--------|-----|
| sheet_metal | 0.94 | 0.92 | 0.93 |
| cnc_milling | 0.91 | 0.89 | 0.90 |
| cnc_turning | 0.95 | 0.96 | 0.95 |
| cnc_5axis | 0.88 | 0.85 | 0.86 |
| die_casting | 0.90 | 0.88 | 0.89 |
| weldment | 0.93 | 0.91 | 0.92 |

---

*Document maintained by FFP Tech Team*
