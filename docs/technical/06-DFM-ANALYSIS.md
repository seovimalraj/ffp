# DFM Analysis & Recommendations

**Version:** 1.0  
**Date:** February 2026  
**Classification:** Technical Reference

---

## 1. Overview

Design for Manufacturability (DFM) analysis evaluates part geometry against manufacturing process constraints, identifying issues that could increase cost, reduce quality, or cause manufacturing failures.

### 1.1 DFM System Goals

1. **Identify Issues**: Detect geometry that violates manufacturing best practices
2. **Score Quality**: Provide a 0-100 manufacturability score
3. **Recommend Solutions**: Offer actionable design improvements
4. **Estimate Impact**: Quantify cost and quality implications

---

## 2. DFM Scoring System

### 2.1 Score Interpretation

| Score Range | Rating | Interpretation |
|-------------|--------|----------------|
| 90-100 | Excellent | Optimized for manufacturing |
| 80-89 | Good | Minor improvements possible |
| 70-79 | Acceptable | Some issues to address |
| 60-69 | Concerning | Significant issues present |
| < 60 | Poor | Major redesign recommended |

### 2.2 Score Calculation

```python
def calculate_dfm_score(issues: List[DFMIssue]) -> int:
    """
    Calculate DFM score from issue list.
    Starts at 100 and deducts based on severity.
    """
    score = 100.0
    
    for issue in issues:
        if issue.severity == 'error':
            score -= 20  # Critical issues
        elif issue.severity == 'warning':
            score -= 8   # Significant issues
        else:  # info
            score -= 2   # Minor concerns
    
    return max(0, min(100, int(score)))
```

---

## 3. CNC Machining DFM Rules

### 3.1 Hole Analysis

```
HOLE DFM RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. DEEP HOLES (depth/diameter ratio)
   
   Standard drilling: D/d ≤ 5
   Peck drilling: D/d ≤ 10
   Gun drilling: D/d > 10 (special tooling)
   
   ┌───────────────────────────┐
   │          │                │
   │          │    depth       │  D/d = 8
   │          │      │         │  ⚠️ Warning: May require
   │          ▼      ▼         │     peck drilling cycle
   │    ┌────────────────┐     │
   │    │░░░░░░░░░░░░░░░░│     │
   │    └────────────────┘     │
   │          │←─ d ─→│        │
   └───────────────────────────┘

2. SMALL HOLES
   
   Minimum practical: ≥ 1.0mm (0.040")
   Micro-drilling: 0.3-1.0mm (special setup)
   Below 0.3mm: EDM required
   
3. HOLE BOTTOM FLATNESS
   
   Drilled holes have conical bottoms (118° typical)
   Flat-bottom holes require additional end mill operation
   
   Standard:     Flat-bottom:
   ╲    ╱         ┌────┐
    ╲  ╱          │    │
     ╲╱           └────┘
```

### 3.2 Pocket Analysis

```
POCKET DFM RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. DEPTH RATIO (depth vs. width)
   
   Standard: depth ≤ 3× width
   Extended reach: depth ≤ 5× width
   Deep pocket: depth > 5× width (requires special tooling)
   
   ┌──────────────────────────────────┐
   │            ┌──────────────┐      │
   │            │              │      │
   │  depth     │              │      │  depth/width = 4
   │    │       │              │      │  ⚠️ May need extended
   │    ▼       │              │      │     reach end mill
   │            └──────────────┘      │
   │            │←── width ──→│       │
   └──────────────────────────────────┘

2. CORNER RADII
   
   Internal corners MUST have radius ≥ tool radius
   Minimum practical: R ≥ 1.5mm for standard tools
   
   ⛔ Bad: Sharp corners    ✅ Good: Radiused corners
   ┌───────┐                 ╭───────╮
   │       │                 │       │
   │       │                 │       │

3. FLOOR FLATNESS
   
   Thin floor can deflect during machining
   Minimum floor: 1.5mm for aluminum, 2mm for steel
```

### 3.3 Wall Thickness

```
WALL THICKNESS DFM RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Minimum wall thickness by material:

| Material       | Min Wall | Preferred |
|----------------|----------|-----------|
| Aluminum       | 0.8mm    | ≥ 1.5mm   |
| Steel          | 1.0mm    | ≥ 2.0mm   |
| Stainless      | 1.2mm    | ≥ 2.5mm   |
| Titanium       | 1.5mm    | ≥ 3.0mm   |
| Plastics       | 0.5mm    | ≥ 1.5mm   |

Thin walls deflect under cutting forces, causing:
- Chatter marks (surface quality issues)
- Dimensional inaccuracy
- Tool breakage
- Vibration/"singing"
```

### 3.4 Undercut Detection

```
UNDERCUT SEVERITY LEVELS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MINOR: Can be machined with standard tool approach
       - Chamfered internal edges
       - Small relief grooves
       - Cost impact: +5-10%

MAJOR: Requires special tooling or 5-axis access
       - T-slots
       - Dovetails
       - Internal grooves
       - Cost impact: +20-50%

BLOCKING: Cannot be accessed by any cutting tool
       - Fully enclosed cavities
       - Reverse features behind walls
       - Requires EDM, casting, or redesign
       - Cost impact: ❌ May require manual quote
```

---

## 4. Sheet Metal DFM Rules

### 4.1 Bend Analysis

```
BEND DFM RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. MINIMUM BEND RADIUS
   
   Inside bend radius should be ≥ material thickness
   
   | Material     | Min IR/Thickness |
   |--------------|------------------|
   | Aluminum     | 1.0×             |
   | Steel        | 1.0×             |
   | Stainless    | 1.5×             |
   | 6061-T6      | 2.0× (crack risk)|
   
   ┌────────────┐
   │            │
   │     ╭──────┤  IR = bend radius
   │     │      │  TR = IR + thickness
   │     │   ╭──╯
   │     │   │     ⚠️ IR < thickness → cracking risk
   └─────┴───┘

2. MINIMUM FLANGE LENGTH
   
   Minimum flange = 4× thickness + bend radius
   
   │←── flange ──→│
   ┌──────────────┐
   │              │
   │        ╭─────╯
   │        │
   │        │   ⚠️ Short flanges cannot be gripped by
   │        │      press brake tooling
   └────────┘

3. BEND SPACING
   
   Minimum spacing between bends: 6× thickness
   
   ┌────┬────┬────┐
   │    │    │    │
   ╰────╯    ╰────╯
   │←─ sp ─→│
   
   ⚠️ Close bends cause tooling interference
   
4. HOLE-TO-BEND DISTANCE
   
   Holes near bends distort during forming
   Minimum: 3× thickness + bend radius
   
   ┌──────○──────┐
   │             │
   │        ╭────╯
   │        │
   │        │   ⛔ Hole too close → oval distortion
   └────────┘
```

### 4.2 Hole Rules for Sheet Metal

```
SHEET METAL HOLE DFM:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. MINIMUM HOLE DIAMETER
   
   Laser: ≥ thickness
   Punch: ≥ 1.5× thickness
   
2. HOLE-TO-EDGE DISTANCE
   
   Minimum: 2× thickness + bend radius
   
   ┌────────────────┐
   │    ○           │←── edge
   │    │←─ 2t ─→│  │
   └────────────────┘

3. HOLE-TO-HOLE SPACING
   
   Minimum: 2× thickness
   
   ○──────○
   │← 2t →│
```

### 4.3 K-Factor and Bend Allowance

```
BEND CALCULATIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

K-Factor = Neutral axis position / Thickness

| Material     | K-Factor |
|--------------|----------|
| Soft steel   | 0.35     |
| Aluminum     | 0.33     |
| Stainless    | 0.40     |
| Hard brass   | 0.42     |

Bend Allowance = π × (IR + K × T) × (A/180°)

Where:
  IR = Inside Radius
  K = K-Factor
  T = Thickness
  A = Bend Angle (degrees)
```

---

## 5. Issue Categories

### 5.1 Issue Severity Levels

| Severity | Symbol | Definition | Action |
|----------|--------|------------|--------|
| **Error** | ⛔ | Cannot manufacture as designed | Redesign required |
| **Warning** | ⚠️ | Difficult/expensive to manufacture | Should address |
| **Info** | ℹ️ | Could be improved | Optional optimization |

### 5.2 Issue Template

```typescript
interface DFMIssue {
  id: string;           // e.g., "HOLE_DEEP_001"
  severity: 'error' | 'warning' | 'info';
  category: 'hole' | 'pocket' | 'wall' | 'bend' | 'feature';
  feature_id?: string;  // Reference to specific feature
  description: string;  // Human-readable description
  recommendation: string; // Suggested fix
  cost_impact?: number;  // Estimated % cost increase
}
```

### 5.3 Common Issues

**CNC Machining:**

| Issue ID | Description | Recommendation |
|----------|-------------|----------------|
| HOLE_DEEP | Hole depth > 10× diameter | Reduce depth or increase diameter |
| HOLE_SMALL | Hole diameter < 1mm | Use EDM or increase diameter |
| POCKET_DEEP | Pocket depth > 5× width | Add stepped depths |
| WALL_THIN | Wall < minimum (0.8mm Al) | Increase wall thickness |
| CORNER_SHARP | Internal sharp corners | Add tool radius (R ≥ 1.5mm) |
| UNDERCUT | Inaccessible feature | Redesign for access or use EDM |
| THREAD_DEPTH | Thread depth > 3× diameter | Reduce or use through hole |

**Sheet Metal:**

| Issue ID | Description | Recommendation |
|----------|-------------|----------------|
| BEND_TIGHT | Bend radius < thickness | Increase bend radius |
| FLANGE_SHORT | Flange < 4T + R | Extend flange |
| BEND_CLOSE | Bend spacing < 6T | Increase spacing |
| HOLE_NEAR_BEND | Hole < 3T from bend | Move hole or use relief slot |
| GRAIN_WRONG | Bend perpendicular to grain | Note grain direction preference |

---

## 6. DFM API

### 6.1 Analysis Input

```typescript
interface DFMInput {
  process_type: 'cnc_milling' | 'cnc_turning' | 'sheet_metal';
  material: string;
  geometry: {
    features: {
      holes: HoleFeature[];
      pockets: PocketFeature[];
      threads: ThreadFeature[];
      bends: BendFeature[];
      walls: WallFeature[];
    };
    thickness?: number;  // For sheet metal
  };
  tolerances?: ToleranceSpec[];
}
```

### 6.2 Analysis Output

```typescript
interface DFMResult {
  score: number;           // 0-100
  rating: 'excellent' | 'good' | 'acceptable' | 'poor';
  issues: DFMIssue[];
  recommendations: Recommendation[];
  cost_impact: {
    min_percent: number;   // Estimated additional cost
    max_percent: number;
    reason: string;
  };
  production_notes: string[];
}
```

### 6.3 Example Response

```json
{
  "score": 72,
  "rating": "acceptable",
  "issues": [
    {
      "id": "HOLE_DEEP_001",
      "severity": "warning",
      "category": "hole",
      "feature_id": "hole_7",
      "description": "Hole depth/diameter ratio of 8.5 exceeds standard (5.0)",
      "recommendation": "Consider using peck drilling cycle (+10% cost) or reduce depth",
      "cost_impact": 10
    },
    {
      "id": "WALL_THIN_001",
      "severity": "warning",
      "category": "wall",
      "description": "Wall thickness 0.9mm is below recommended 1.5mm for aluminum",
      "recommendation": "Increase wall to 1.5mm to prevent deflection during machining",
      "cost_impact": 15
    }
  ],
  "recommendations": [
    {
      "type": "feature_change",
      "description": "Increase hole H7 diameter from 4mm to 6mm to reduce depth ratio",
      "savings_percent": 8
    }
  ],
  "cost_impact": {
    "min_percent": 10,
    "max_percent": 25,
    "reason": "Deep holes and thin walls require slower feeds and special tooling"
  },
  "production_notes": [
    "Consider adding workholding tabs for thin wall support",
    "Peck drilling required for holes 7, 12"
  ]
}
```

---

## 7. Process-Specific Configurations

### 7.1 CNC Milling Defaults

```python
CNC_MILLING_CONFIG = {
    'min_tool_diameter_mm': 1.0,
    'max_hole_depth_ratio': 10.0,
    'max_pocket_depth_ratio': 5.0,
    'min_wall_aluminum_mm': 0.8,
    'min_wall_steel_mm': 1.0,
    'min_corner_radius_mm': 1.5,
    'min_floor_thickness_mm': 1.5,
}
```

### 7.2 Sheet Metal Defaults

```python
SHEET_METAL_CONFIG = {
    'min_hole_diameter_ratio': 1.0,  # × thickness
    'min_hole_to_edge_ratio': 2.0,   # × thickness
    'min_hole_to_bend_ratio': 3.0,   # × thickness + radius
    'min_flange_formula': '4T + R',  # 4× thick + radius
    'min_bend_spacing_ratio': 6.0,   # × thickness
    'default_k_factor': 0.35,
}
```

### 7.3 Tolerance Feasibility

```python
TOLERANCE_CONFIG = {
    'standard': {'range_mm': 0.127, 'cost_mult': 1.0},
    'precision': {'range_mm': 0.051, 'cost_mult': 1.15},
    'tight': {'range_mm': 0.025, 'cost_mult': 1.35},
    'ultra': {'range_mm': 0.010, 'cost_mult': 1.75},  # May require grinding
}
```

---

## 8. Recommendations Engine

### 8.1 Recommendation Types

| Type | Description | Example |
|------|-------------|---------|
| **Feature Change** | Modify geometry | "Increase hole diameter" |
| **Material Change** | Different material | "Use 5052-O instead of 6061-T6" |
| **Process Change** | Alternative process | "Consider casting for high volume" |
| **Tolerance Relax** | Loosen tolerance | "Standard tolerance sufficient here" |
| **Quantity Change** | Optimize quantity | "Order 25 for 15% discount" |

### 8.2 Savings Estimation

Each recommendation includes estimated savings:

```python
def estimate_savings(issue: DFMIssue, recommendation: str) -> float:
    """Estimate percentage cost savings from applying recommendation."""
    base_savings = issue.cost_impact or 0
    
    if 'increase diameter' in recommendation.lower():
        return base_savings * 0.8  # 80% of issue cost recovered
    elif 'relax tolerance' in recommendation.lower():
        return base_savings * 1.0  # Full savings
    elif 'change material' in recommendation.lower():
        return base_savings * 0.6  # Partial savings, new considerations
    
    return base_savings * 0.7  # Default 70% recovery
```

---

## 9. Integration with Pricing

### 9.1 DFM → Pricing Flow

```
DFM Analysis → Issue Detection → Cost Impact Calculation
                                         │
                                         ▼
                    Pricing Engine ← Complexity Adjustments
                                         │
                                         ▼
                                   Final Quote
```

### 9.2 Cost Impact Mapping

| DFM Issue | Cost Component | Multiplier |
|-----------|----------------|------------|
| Deep holes | Machine time | +15-25% |
| Thin walls | Machine time | +20-40% |
| Undercuts | Tooling + 5-axis | +30-100% |
| Tight radius | Special tooling | +10-20% |
| Tight bend | Setup time | +15-25% |

---

*Document maintained by FFP Tech Team*
