# Part Identification & Process Classification

**Version:** 1.0  
**Date:** February 2026  
**Classification:** Technical Reference

---

## 1. Overview

The FFP (Frigate Fast Parts) Part Identification System automatically determines the optimal manufacturing process for any uploaded CAD part. This document details the classification algorithms, decision logic, and confidence scoring.

### 1.1 Supported Manufacturing Processes

| Process | Description | Typical Parts |
|---------|-------------|---------------|
| **sheet_metal** | Flat or bent sheet parts | Enclosures, brackets, panels |
| **cnc_milling** | 3-axis+ material removal | Blocks, housings, complex parts |
| **cnc_turning** | Rotational symmetric parts | Shafts, cylinders, bushings |
| **cnc_5axis** | Multi-directional access required | Aerospace, impellers |
| **turn_mill** | Turned parts with milling features | Shafts with cross-holes, flats |
| **weldment** | Multi-body welded assembly | Frames, structures |
| **casting** | Investment or die cast parts | Complex shapes, thin walls with draft |

---

## 2. Classification Architecture

### 2.1 Hybrid Engine

The system uses a **hybrid rule-based + ML classification** approach:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CLASSIFICATION ENGINE                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐     ┌──────────────────┐                      │
│  │   11-Tier Rule  │────▶│   Confidence    │                      │
│  │     Cascade     │     │    Assessment    │                      │
│  └─────────────────┘     └──────────────────┘                      │
│           │                       │                                │
│           │                       ▼                                │
│           │              ┌──────────────────┐                      │
│           │              │  Confidence < 80%│──────┐               │
│           │              └──────────────────┘      │               │
│           │                       │                ▼               │
│           │                       │      ┌──────────────────┐      │
│           │                       │      │   ML Classifier  │      │
│           │                       │      │   (Ensemble)     │      │
│           ▼                       │      └──────────────────┘      │
│  ┌─────────────────┐              │                │               │
│  │  Final Process  │◀────────────┴────────────────┘               │
│  │  + Confidence   │                                               │
│  └─────────────────┘                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 The 11-Tier Classification Cascade

Classification proceeds through tiers in order; first definitive match wins:

| Tier | Method | Target Process | Signals Used |
|------|--------|----------------|--------------|
| **0** | Flat Sheet Detection | sheet_metal | Thin profile + high aspect ratio |
| **1** | Face Type Classification | sheet_metal / cnc_milling | B-Rep face histogram |
| **2** | Advanced Thickness Analysis | sheet_metal | Ray-cast paired walls |
| **3** | Legacy Thickness Detection | sheet_metal | Simple thickness check |
| **4** | Bend Detection | sheet_metal | STEP/mesh bend angles |
| **5** | Dimension Analysis | sheet_metal / cnc | Profile + aspect ratio |
| **6** | Turning Detection | cnc_turning | Cylinder ratio, revolution faces |
| **7** | Weldment Detection | weldment | Multi-body + joint geometry |
| **8** | Casting Detection | casting | Draft angles + thin walls |
| **9** | 5-Axis Detection | cnc_5axis | Undercuts + access directions |
| **10** | Turn-Mill Detection | turn_mill | Turned body + milling features |
| **11** | Score + ML Fallback | * | Ensemble decision |

---

## 3. Sheet Metal Identification

### 3.1 Primary Indicators

Sheet metal parts are identified by these characteristics:

```
SHEET METAL SIGNATURE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. UNIFORM WALL THICKNESS
   ┌──────────────────────────────────────────────────────┐
   │                                                       │
   │   ─────────────────────────────────────────────       │
   │   =====================================thickness      │
   │   ─────────────────────────────────────────────       │
   │                                                       │
   └──────────────────────────────────────────────────────┘
   Range: 0.4mm - 6.0mm (material dependent)

2. PAIRED PARALLEL PLANES (top/bottom surfaces)
   ┌───────────────────────────────────┐
   │  ┌─────────────────────────────┐  │  ◄─ Top plane
   │  │                             │  │
   │  │                             │  │  ◄─ Uniform gap
   │  │                             │  │
   │  └─────────────────────────────┘  │  ◄─ Bottom plane
   └───────────────────────────────────┘

3. BEND RADII (inside radius = material thickness)
   ┌────────────┐
   │            │
   │    ┌───────┤
   │    │       │
   │    │   ╭───╯
   │    │   │      ◄─ Bend radius = ~1-3× thickness
   └────┴───┘
```

### 3.2 Thickness Detection Algorithm

```python
# Material-specific thickness ranges (mm)
MATERIAL_THICKNESS_RANGES = {
    'steel':     (0.4, 6.0),   # Cold-rolled steel
    'stainless': (0.4, 6.0),   # Stainless steel
    'aluminum':  (0.5, 6.0),   # Aluminum alloys
    'copper':    (0.3, 4.0),   # Copper
    'brass':     (0.3, 4.0),   # Brass
    'titanium':  (0.5, 6.0),   # Titanium
    'default':   (0.4, 6.0),   # Fallback
}
```

### 3.3 Thickness Detection Methods

| Method | Source Data | Confidence | Best For |
|--------|-------------|------------|----------|
| **Paired Plane Distance** | B-Rep faces | 95% | STEP files |
| **Ray-Cast Wall Detection** | Mesh | 85% | STL files |
| **Bounding Box Min-Dim** | Any | 70% | Fallback |

### 3.4 Bend Detection

Bends are detected via:

1. **STEP-Based** (preferred): Cylindrical face pairs with adjacent planar faces
2. **Mesh-Based**: Normal vector clustering analysis

```
STEP Bend Detection Algorithm:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Identify cylindrical faces
2. Check adjacent planar faces
3. Compute dihedral angle between planes
4. Validate bend radius (2mm - 30mm typical)
5. Extract bend angle (90°, 120°, etc.)
```

**Bend Classification Criteria:**
- Min bend radius: 2mm
- Max bend radius: 30mm (beyond = likely fillet, not bend)
- Valid angles: 30° - 170°

---

## 4. CNC Part Identification

### 4.1 CNC Milling Indicators

```
CNC MILLING SIGNATURE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. DEEP POCKETS (depth/width ratio > 4)
   ┌──────────────────────────────┐
   │ ╔════════════════════════╗  │
   │ ║////////////////////////║  │  depth
   │ ║////////////////////////║  │   │
   │ ║////////////////////////║  │   │
   │ ╚════════════════════════╝  │   ▼
   │          │width│             │
   └──────────────────────────────┘

2. TOOL-RADIUS FILLETS (R3-R6mm = endmill radius)
   ┌───────┐
   │       │
   │    ╭──┘ ◄─ R5mm = 10mm endmill
   │    │
   └────┘

3. THREADED HOLES
   ┌───────────────────┐
   │  ╱╲  ╱╲  ╱╲  ╱╲   │
   │ ╱  ╲╱  ╲╱  ╲╱  ╲  │  ◄─ Internal threads
   │╱    ╲    ╲    ╲  │
   └───────────────────┘

4. MULTIPLE DISTINCT THICKNESSES
   ┌─────┬─────┬───────────┐
   │  8mm│  5mm│    3mm    │
   ├─────┴─────┴───────────┤
   │                       │
   └───────────────────────┘
```

### 4.2 CNC Feature Score Calculation

```python
def compute_machining_feature_score():
    score = 0.0
    
    # Thread features (strong CNC indicator)
    if thread_count > 0:
        score += min(25, 15 + thread_count * 5)
    
    # Pocket features
    if pocket_count >= 3:
        score += min(20, 10 + pocket_count * 3)
    
    # Undercut features (definitely CNC)
    if undercut_count > 0:
        score += min(35, 15 + undercut_count * 5)
    
    # Tool-radius fillets (R3-R6mm)
    if tool_radius_fillet_count >= 3:
        score += 20
    
    return min(100.0, score)
```

### 4.3 CNC Turning Identification

Turned parts are identified by:

| Signal | Threshold | Weight |
|--------|-----------|--------|
| Cylinder Area Ratio | > 40% | High |
| Revolution Face Count | > 0 | High |
| Torus Faces (grooves) | > 0 | Medium |
| XY Symmetry (min ≈ mid) | < 10% delta | Medium |
| Elongated Aspect Ratio | > 1.5:1 | Low |

```
CNC TURNING SIGNATURE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        ┌───────────────────────────┐
        │                           │
    ════╪═══════════════════════════╪════  ◄─ Cylindrical body
        │                           │
        └───────────────────────────┘
        
    Cross-section is circular:
    
           ╭────────╮
          ╱          ╲
         │     ⊙      │  ◄─ XY dimensions equal
          ╲          ╱
           ╰────────╯
```

---

## 5. Advanced Process Detection

### 5.1 5-Axis CNC Detection

5-axis is triggered when:
- **Undercuts present** with severity > minor
- **Access directions > 3** required (computed by machining complexity analyzer)
- **Deep pockets + angular features** in multiple orientations

### 5.2 Turn-Mill Detection

Turn-mill combines turning + milling:
- Base geometry is cylindrical (turned)
- **Cross-holes** perpendicular to rotation axis
- **Flats/D-cuts** requiring milling
- **Pockets** on cylindrical surface

### 5.3 Weldment Detection

Weldments are multi-body assemblies:
- **Body count > 1**
- **Joint geometry** detected between bodies
- **Linear profiles** (tubes, beams, plates)

### 5.4 Casting Detection

Casting candidates show:
- **Draft angles > 1°** on most surfaces (>70% coverage)
- **Uniform thin walls** without undercuts
- **Smooth fillets** for mold flow

---

## 6. Confidence Scoring

### 6.1 Confidence Levels

| Level | Range | Interpretation |
|-------|-------|----------------|
| **High** | 90-100% | Clear classification, no manual review |
| **Good** | 80-89% | High confidence, proceed |
| **Moderate** | 70-79% | Consider review for critical orders |
| **Low** | 60-69% | Manual review recommended |
| **Uncertain** | <60% | Requires manual quote |

### 6.2 Confidence Boosters

| Factor | Boost | Condition |
|--------|-------|-----------|
| STEP vs STL | +5% | STEP files have B-Rep data |
| Multiple signals agree | +10% | Face type + thickness both indicate same |
| Known material | +3% | Material-specific thresholds applied |
| Feature count high | +5% | Many features = clearer signal |

### 6.3 Confidence Penalties

| Factor | Penalty | Condition |
|--------|---------|-----------|
| Conflicting signals | -10% | Face type ≠ thickness analysis |
| Complex geometry | -5% | Many face types, many features |
| Low mesh quality | -15% | STL with few triangles |

---

## 7. Classification Flowchart

```
┌─────────────────────────────────────────────────────────────┐
│                    PART CLASSIFICATION                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                  ┌─────────────────┐
                  │ Is flat sheet?  │
                  │ (thin + AR > 8) │
                  └────────┬────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
             YES                        NO
              │                         │
              ▼                         ▼
    ┌─────────────────┐     ┌─────────────────┐
    │  SHEET_METAL    │     │ Has bends +     │
    │  (flat, laser)  │     │ thin profile?   │
    │  Conf: 92%      │     └────────┬────────┘
    └─────────────────┘              │
                          ┌──────────┴──────────┐
                          │                     │
                         YES                    NO
                          │                     │
                          ▼                     ▼
              ┌─────────────────┐   ┌─────────────────┐
              │  SHEET_METAL    │   │ High cylinder   │
              │  (bent)         │   │ ratio (>40%)?   │
              │  Conf: 85-95%   │   └────────┬────────┘
              └─────────────────┘            │
                                   ┌─────────┴─────────┐
                                   │                   │
                                  YES                  NO
                                   │                   │
                                   ▼                   ▼
                       ┌─────────────────┐   ┌─────────────────┐
                       │  CNC_TURNING    │   │  CNC_MILLING    │
                       │  Conf: 85%      │   │  (default)      │
                       └─────────────────┘   └─────────────────┘
```

---

## 8. Edge Cases & Guards

### 8.1 False Positive Prevention

| Scenario | Risk | Guard |
|----------|------|-------|
| Thin internal walls in CNC block | Misclassify as sheet metal | Check paired plane thickness > 8mm |
| Sheet with many holes | Misclassify as CNC | Check for bends first |
| Bent enclosures with high vol efficiency | Misclassify as solid CNC | Check for STEP bends |
| Turned shaft with D-cut | Miss turning | Allow xy_sim up to 0.35 |

### 8.2 Material-Specific Adjustments

Sheet metal max thickness varies by material:
- **Steel/Stainless**: 6mm (practical press brake limit)
- **Aluminum**: 6mm (was 10mm, reduced for accuracy)
- **Copper/Brass**: 4mm (softer, thinner gauges)

---

## 9. Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Classification Accuracy | > 95% | 97.2% |
| Average Confidence | > 85% | 88.5% |
| False Positive Rate | < 3% | 1.8% |
| Processing Time | < 2s | ~1.2s |

---

*Document maintained by FFP Tech Team*
