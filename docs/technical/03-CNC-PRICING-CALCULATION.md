# CNC Machining Pricing Calculation

**Version:** 1.0  
**Date:** February 2026  
**Classification:** Technical Reference | Confidential

---

## 1. Overview

The FFP (Frigate Fast Parts) CNC pricing engine calculates accurate machining costs using a multi-factor model that considers geometry complexity, material, tolerances, features, and production volume.

### 1.1 Pricing Formula Overview

```
TOTAL PRICE = (Material Cost + Machining Cost + Setup Cost + Finish Cost + 
               Inspection Cost + Overhead) × Margin × Lead Time Factor
```

---

## 2. Cost Components

### 2.1 Component Breakdown

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CNC PRICING COMPONENTS                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐                                               │
│  │  MATERIAL COST  │                                               │
│  │  (per part)     │   = Volume × Density × $/kg × Waste Factor   │
│  └─────────────────┘                                               │
│           +                                                         │
│  ┌─────────────────┐                                               │
│  │ MACHINING COST  │   = Cycle Time × Machine Rate × Complexity   │
│  │  (per part)     │                                               │
│  └─────────────────┘                                               │
│           +                                                         │
│  ┌─────────────────┐                                               │
│  │   SETUP COST    │   = Fixed Setup / Quantity                   │
│  │ (amortized)     │                                               │
│  └─────────────────┘                                               │
│           +                                                         │
│  ┌─────────────────┐                                               │
│  │  FINISH COST    │   = Base + (Surface Area × Per-Area Rate)    │
│  │  (per part)     │                                               │
│  └─────────────────┘                                               │
│           +                                                         │
│  ┌─────────────────┐                                               │
│  │ INSPECTION COST │   = Base × Tolerance Multiplier              │
│  │  (per part)     │                                               │
│  └─────────────────┘                                               │
│           +                                                         │
│  ┌─────────────────┐                                               │
│  │   OVERHEAD      │   = (Material + Machine + Setup) × %         │
│  │                 │                                               │
│  └─────────────────┘                                               │
│                                                                     │
│  ═══════════════════════════════════════════════════════════════   │
│           ×                                                         │
│  ┌─────────────────┐                                               │
│  │     MARGIN      │   = Base Margin % (typically 25-35%)         │
│  └─────────────────┘                                               │
│           ×                                                         │
│  ┌─────────────────┐                                               │
│  │  LEAD TIME      │   = 1.0 (standard) to 1.5 (expedited)        │
│  │  MULTIPLIER     │                                               │
│  └─────────────────┘                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Material Cost Calculation

### 3.1 Formula

```
Material Cost = Part Volume (mm³) × Material Density (kg/mm³) × 
                Cost per kg ($) × Waste Factor
```

### 3.2 Material Database

| Material | Density (g/cm³) | Cost/kg ($) | Machinability Factor |
|----------|-----------------|-------------|---------------------|
| **Aluminum 6061-T6** | 2.70 | $7.50 | 1.00 |
| **Aluminum 7075-T6** | 2.81 | $14.00 | 1.15 |
| **Steel 1018** | 7.87 | $3.80 | 1.00 |
| **Steel 4140** | 7.85 | $5.50 | 1.25 |
| **Stainless 304** | 8.00 | $12.00 | 1.40 |
| **Stainless 316** | 8.00 | $18.00 | 1.50 |
| **Titanium 6Al-4V** | 4.43 | $85.00 | 4.00 |
| **Brass 360** | 8.50 | $8.50 | 0.80 |
| **Delrin (Acetal)** | 1.41 | $12.00 | 0.60 |
| **PEEK** | 1.32 | $85.00 | 1.20 |

### 3.3 Waste Factor

```
Waste Factor = 1 + (Bounding Box Volume - Part Volume) / Part Volume
             = Typically 1.2 - 1.5 (20-50% waste)
```

For prototype quantities (1-5):
- Simple parts: 1.3×
- Complex parts: 1.5×

For production (50+):
- Optimized nesting: 1.15×

---

## 4. Machining Time Calculation

### 4.1 Cycle Time Components

```
Total Cycle Time = Material Removal Time + Feature Time + 
                   Finishing Time + Tool Change Time
```

### 4.2 Material Removal Time

```
Removal Time (min) = Volume to Remove (cc) / Removal Rate (cc/min)
```

**Default Removal Rates (cc/min):**

| Material Category | Roughing | Finishing |
|-------------------|----------|-----------|
| Aluminum | 15.0 | 8.0 |
| Mild Steel | 8.0 | 4.0 |
| Stainless Steel | 4.0 | 2.0 |
| Titanium | 2.0 | 1.0 |
| Engineering Plastics | 20.0 | 12.0 |

### 4.3 Feature-Based Time

Each feature adds machining time:

| Feature Type | Time (min/feature) | Notes |
|--------------|-------------------|-------|
| **Holes (standard)** | 0.35 | Drill + spot + chamfer |
| **Holes (deep D/d>5)** | 0.75 | Peck drilling cycle |
| **Pockets** | 1.2 | Roughing + finishing |
| **Slots** | 0.6 | Multiple passes |
| **Threads** | 0.75 | Tapping or thread milling |
| **Undercuts** | 1.5 | Special tooling required |
| **Faces** | 0.25 | Face milling |
| **Chamfers/Fillets** | 0.08 | Edge breaks |
| **Ribs** | 0.4 | Thin wall machining |
| **Bosses** | 0.5 | Raised features |

### 4.4 Complexity Multiplier

Based on surface area to volume ratio:

```python
def complexity_multiplier(surface_area_cm2, volume_cc):
    sv_ratio = surface_area_cm2 / (volume_cc ** (2/3))
    return min(1 + sv_ratio / 100, 2.5)
```

| SV Ratio | Multiplier | Interpretation |
|----------|------------|----------------|
| < 20 | 1.2× | Simple block |
| 20-50 | 1.5× | Moderate complexity |
| 50-100 | 2.0× | Complex |
| > 100 | 2.5× | Very complex (thin walls, many features) |

---

## 5. Machine Rates

### 5.1 Hourly Rates by Machine Type

| Machine Type | Rate ($/hr) | Typical Use |
|--------------|-------------|-------------|
| **3-Axis VMC** | $65 | Standard milling |
| **4-Axis VMC** | $85 | Rotary work |
| **5-Axis VMC** | $125 | Complex geometry |
| **CNC Lathe** | $55 | Turning |
| **Turn-Mill** | $95 | Combined ops |
| **Swiss Lathe** | $110 | Small precision |

### 5.2 Setup Costs

| Setup Type | Cost | Description |
|------------|------|-------------|
| **Simple (3-axis)** | $45 | Standard vise setup |
| **Moderate** | $75 | Custom fixturing |
| **Complex (5-axis)** | $150 | Multi-side access |
| **Prototype (multi-op)** | $200+ | Development time |

---

## 6. Tolerance Pricing

### 6.1 Tolerance Multipliers

| Tolerance Level | Range | Multiplier | Inspection |
|-----------------|-------|------------|------------|
| **Standard** | ±0.127mm (±0.005") | 1.00× | Visual |
| **Precision** | ±0.051mm (±0.002") | 1.15× | CMM sampling |
| **Tight** | ±0.025mm (±0.001") | 1.35× | 100% CMM |

### 6.2 Tolerance Impact on Cycle Time

Tighter tolerances require:
- Slower feed rates
- Additional finishing passes
- In-process measurement
- Climate-controlled environment

---

## 7. Surface Finish Pricing

### 7.1 Finish Options

| Finish | Base Cost | Per cm² | Typical Use |
|--------|-----------|---------|-------------|
| **As-Machined** | $0 | $0 | Internal parts |
| **Bead Blasted** | $12 | $0.03 | Matte cosmetic |
| **Anodized (Clear)** | $18 | $0.05 | Aluminum protection |
| **Anodized (Color)** | $25 | $0.07 | Cosmetic |
| **Powder Coated** | $22 | $0.05 | Steel protection |
| **Electropolished** | $35 | $0.09 | Medical/food |
| **Zinc Plated** | $15 | $0.04 | Corrosion protection |
| **Chrome Plated** | $45 | $0.12 | Decorative |
| **Nickel Plated** | $35 | $0.10 | Wear resistance |

---

## 8. Volume Discounts

### 8.1 Quantity Breaks

| Quantity | Discount | Unit Price Impact |
|----------|----------|-------------------|
| 1-4 | 0% | Full price |
| 5-9 | 5% | -5% |
| 10-24 | 10% | -10% |
| 25-49 | 15% | -15% |
| 50-99 | 20% | -20% |
| 100-249 | 25% | -25% |
| 250+ | 30% | -30% |

### 8.2 Setup Amortization

Setup costs are spread across quantity:

```
Setup Per Part = Total Setup Cost / Quantity

Example:
- Setup Cost: $150
- Qty 1: $150/part
- Qty 10: $15/part
- Qty 100: $1.50/part
```

---

## 9. Lead Time Multipliers

### 9.1 Standard Lead Times

| Lead Time | Days | Multiplier |
|-----------|------|------------|
| **Economy** | 10-15 | 0.95× |
| **Standard** | 5-7 | 1.00× |
| **Expedited** | 3-4 | 1.25× |
| **Rush** | 1-2 | 1.50× |

### 9.2 Lead Time Components

```
Total Lead Time = Production Days + Shipping Days + Buffer Days
```

| Component | Standard | Expedited |
|-----------|----------|-----------|
| Production | 3-5 days | 1-2 days |
| Shipping | 2-3 days | 1 day |
| Buffer | 1 day | 0 days |

---

## 10. Example Calculations

### 10.1 Example: Aluminum Bracket

**Part Specifications:**
- Material: Aluminum 6061-T6
- Volume: 50,000 mm³ (50 cc)
- Surface Area: 25,000 mm² (250 cm²)
- Features: 8 holes, 2 pockets, 4 threads
- Tolerance: Standard
- Finish: Anodized Clear
- Quantity: 10

**Calculation:**

```
MATERIAL COST:
  Volume: 50 cc
  Density: 2.7 g/cc = 0.0000027 kg/mm³
  Mass: 50 cc × 2.7 g/cc = 135g = 0.135 kg
  Cost: 0.135 kg × $7.50/kg × 1.3 (waste) = $1.32/part

MACHINING COST:
  Removal time: (50 cc × 0.4) / 12 cc/min = 1.67 min
  Feature time: 8×0.35 + 2×1.2 + 4×0.75 = 8.2 min
  Total time: (1.67 + 8.2) × 1.15 (overhead) = 11.35 min
  Rate: $65/hr = $1.08/min
  Cost: 11.35 min × $1.08/min = $12.26/part

SETUP COST:
  Base: $75
  Per part: $75 / 10 = $7.50/part

FINISH COST:
  Anodized: $18 + (250 cm² × $0.05) = $30.50
  Per part: $30.50/part

INSPECTION:
  Standard: $5/part

OVERHEAD (15%):
  ($1.32 + $12.26 + $7.50) × 0.15 = $3.16/part

SUBTOTAL:
  $1.32 + $12.26 + $7.50 + $30.50 + $5.00 + $3.16 = $59.74/part

MARGIN (30%):
  $59.74 × 1.30 = $77.66/part

QUANTITY DISCOUNT (10%):
  $77.66 × 0.90 = $69.89/part

FINAL UNIT PRICE: $69.89
TOTAL ORDER: $698.90
```

---

## 11. API Parameters

### 11.1 Cost Factors Input

```typescript
interface CostFactorsV1 {
  machine_rate_per_hour: number;   // $/hr
  setup_cost: number;              // $ fixed
  material_price_per_kg: number;   // $/kg
  material_id?: string;            // Material lookup key
  overhead_percent: number;        // 0.15 = 15%
  base_margin_percent: number;     // 0.30 = 30%
  inspection_cost_per_part: number;
  rush_multiplier?: number;        // 1.25 for expedited
  finish_cost_adders?: Record<string, number>;
  quantity_breaks?: {
    min_qty: number;
    discount_percent: number;
  }[];
}
```

### 11.2 Pricing Output

```typescript
interface PricingBreakdownV1 {
  material: number;
  machining: number;
  setup: number;
  finish: number;
  inspection: number;
  overhead: number;
  unit_cost_before_margin: number;
  margin: number;
  unit_price: number;
  total_price: number;
  cycle_time_min: number;
  lead_time_days: number;
}
```

---

## 12. Competitive Positioning

### 12.1 Market Comparison

FFP targets **30% more competitive** than major competitors:

| Approach | Description |
|----------|-------------|
| Lower Overhead | Automated quoting reduces labor |
| Efficient Routing | Right-size machine selection |
| Volume Efficiency | Better material nesting |
| Process Optimization | DFM recommendations reduce complexity |

### 12.2 Price Guardrails

| Guardrail | Value | Purpose |
|-----------|-------|---------|
| Min Unit Price | $15 | Cover handling |
| Min Order | $50 | Transaction costs |
| Max Complexity Premium | 2.5× | Prevent over-quoting |
| Manual Quote Threshold | >$5000 | High-value review |

---

*Document maintained by FFP Tech Team*
*Confidential - Not for external distribution*
