# Sheet Metal Pricing Calculation

**Version:** 1.0  
**Date:** February 2026  
**Classification:** Technical Reference | Confidential

---

## 1. Overview

Sheet metal pricing differs fundamentally from CNC machining. It's based on cutting perimeter, bend count, material area, and secondary operations rather than volumetric material removal.

### 1.1 Pricing Formula Overview

```
TOTAL PRICE = (Material Cost + Cutting Cost + Bending Cost + Hardware Cost + 
               Finish Cost + Setup Cost + Overhead) × Margin × Lead Time Factor
```

---

## 2. Cost Components

### 2.1 Sheet Metal Cost Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                  SHEET METAL PRICING MODEL                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐                                               │
│  │  MATERIAL COST  │ = Flat Area × Thickness × Density × $/kg     │
│  │                 │   + Nesting Waste Factor                      │
│  └─────────────────┘                                               │
│           +                                                         │
│  ┌─────────────────┐                                               │
│  │  CUTTING COST   │ = Cut Length × $/meter (by method)           │
│  │                 │   + Piercing Count × $/pierce                │
│  └─────────────────┘                                               │
│           +                                                         │
│  ┌─────────────────┐                                               │
│  │  BENDING COST   │ = Bend Count × $/bend × Complexity Factor    │
│  │                 │   + Setup per unique bend                     │
│  └─────────────────┘                                               │
│           +                                                         │
│  ┌─────────────────┐                                               │
│  │ HARDWARE COST   │ = Hardware Count × Unit Cost × Install Time  │
│  │ (PEM, rivets)   │                                               │
│  └─────────────────┘                                               │
│           +                                                         │
│  ┌─────────────────┐                                               │
│  │  FINISH COST    │ = Surface Area × $/m² (by finish type)      │
│  │                 │                                               │
│  └─────────────────┘                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Material Cost Calculation

### 3.1 Sheet Metal Material Database

| Material | Gauge/Thickness | Density (g/cm³) | Cost/kg ($) | Bendability |
|----------|-----------------|-----------------|-------------|-------------|
| **Steel CR** 0.5mm | 26 ga | 7.85 | $3.50 | 1.00 |
| **Steel CR** 1.0mm | 20 ga | 7.85 | $3.50 | 1.00 |
| **Steel CR** 2.0mm | 14 ga | 7.85 | $3.80 | 1.05 |
| **Steel CR** 3.0mm | 11 ga | 7.85 | $4.00 | 1.15 |
| **Steel CR** 4.0mm | | 7.85 | $4.20 | 1.25 |
| **Steel CR** 5.0mm | | 7.85 | $4.50 | 1.40 |
| **Steel CR** 6.0mm | | 7.85 | $4.80 | 1.60 |
| **Aluminum 5052** 1.0mm | | 2.68 | $8.00 | 0.90 |
| **Aluminum 5052** 2.0mm | | 2.68 | $8.00 | 0.95 |
| **Aluminum 5052** 3.0mm | | 2.68 | $8.50 | 1.05 |
| **Stainless 304** 1.0mm | | 8.00 | $12.00 | 1.20 |
| **Stainless 304** 2.0mm | | 8.00 | $12.50 | 1.30 |
| **Stainless 304** 3.0mm | | 8.00 | $13.00 | 1.45 |

### 3.2 Thickness Cost Multipliers

| Thickness (mm) | Cost Multiplier |
|----------------|-----------------|
| 0.5 | 1.00× |
| 0.8 | 1.00× |
| 1.0 | 1.00× |
| 1.2 | 1.05× |
| 1.5 | 1.10× |
| 2.0 | 1.15× |
| 2.5 | 1.20× |
| 3.0 | 1.25× |
| 4.0 | 1.35× |
| 5.0 | 1.50× |
| 6.0 | 1.65× |

### 3.3 Material Formula

```
Material Cost = Flat Area (m²) × Thickness (mm) × Density (kg/m³) × 
                Cost/kg × Waste Factor × Thickness Multiplier
```

**Waste Factors (Nesting Efficiency):**
| Quantity | Waste Factor | Notes |
|----------|--------------|-------|
| 1-5 | 1.35 | Prototype, poor nesting |
| 6-25 | 1.25 | Small batch |
| 26-100 | 1.18 | Production batch |
| 100+ | 1.12 | Volume production |

---

## 4. Cutting Cost Calculation

### 4.1 Cutting Methods

| Method | Cost/meter | Speed (mm/min) | Min Thick | Max Thick | Best For |
|--------|------------|----------------|-----------|-----------|----------|
| **Fiber Laser** | $0.25 | 8000 | 0.3mm | 20mm | Steel, stainless |
| **CO2 Laser** | $0.35 | 5000 | 0.5mm | 25mm | Thick steel |
| **Plasma** | $0.18 | 4000 | 3mm | 50mm | Thick steel |
| **Waterjet** | $0.60 | 500 | Any | Any | Exotic materials |
| **Turret Punch** | $0.15 | N/A | 0.5mm | 6mm | High volume holes |

### 4.2 Piercing Costs

Each hole requires a pierce:

| Cutting Method | Pierce Cost | Time (sec) |
|----------------|-------------|------------|
| Fiber Laser (thin <3mm) | $0.05 | 0.2 |
| Fiber Laser (thick >3mm) | $0.15 | 0.8 |
| Plasma | $0.10 | 0.5 |
| Waterjet | $0.25 | 1.5 |

### 4.3 Cutting Formula

```
Cutting Cost = (Cut Length (m) × Cost/meter) + 
               (Pierce Count × Pierce Cost) +
               (Setup × Method Setup Cost)
```

### 4.4 Complexity Adjustments

| Feature | Adjustment | Reason |
|---------|------------|--------|
| Sharp corners (<2mm radius) | +20% cutting time | Deceleration |
| Intricate profiles | +15% | Path complexity |
| Very small holes (<3mm) | Special punch | Laser limitations |
| Close spacing (<material thickness) | +25% | Heat distortion |

---

## 5. Bending Cost Calculation

### 5.1 Base Bend Costs

```
Bending Cost = (Bend Count × Base Cost/Bend) × Material Factor × 
               Complexity Factor + Setup Cost
```

### 5.2 Bend Pricing Factors

| Bend Type | Cost/Bend | Notes |
|-----------|-----------|-------|
| **Standard 90°** | $2.50 | Simple press brake |
| **Acute (<90°)** | $4.00 | Two-hit, goose-neck |
| **Obtuse (>90°)** | $3.00 | Standard die |
| **Hem (180°)** | $5.00 | Multi-step |
| **Z-bend** | $4.50 | Two bends, single setup |
| **Box/Channel** | $6.00 | Multiple coordinated bends |

### 5.3 Material Bend Factors

| Material | Bend Factor | Min Inside Radius |
|----------|-------------|-------------------|
| Steel CR | 1.00× | 1× thickness |
| Stainless 304 | 1.30× | 1.5× thickness |
| Aluminum 5052 | 0.90× | 1× thickness |
| Aluminum 6061-T6 | 1.20× | 2× thickness (risk cracking) |
| Copper | 0.85× | 0.5× thickness |

### 5.4 Complexity Factors

| Condition | Factor | Description |
|-----------|--------|-------------|
| Short flange (<10mm) | 1.4× | Difficult to hold |
| Long bend (>1000mm) | 1.3× | Requires beam |
| Close spacing | 1.5× | Tooling interference |
| Tight radius | 1.25× | Special tooling |
| Many unique bends | +$10/unique | Setup time |

### 5.5 Setup Costs

| Bend Setup | Cost | Notes |
|------------|------|-------|
| First bend line | $15 | Die setup |
| Each additional unique angle | $8 | Die change or rotation |
| Custom tooling required | $75+ | One-time |

---

## 6. Hardware Installation

### 6.1 Hardware Types & Costs

| Hardware Type | Unit Cost | Install Cost | Total/Unit |
|---------------|-----------|--------------|------------|
| **PEM Nut (press-in)** | $0.15-0.50 | $0.50 | $0.65-1.00 |
| **Rivet Nut** | $0.20-0.40 | $0.75 | $0.95-1.15 |
| **Standoff** | $0.25-0.75 | $0.60 | $0.85-1.35 |
| **Captive Screw** | $0.50-1.00 | $0.75 | $1.25-1.75 |
| **Weld Nut** | $0.10-0.25 | $1.00 | $1.10-1.25 |
| **Clinch Stud** | $0.15-0.35 | $0.50 | $0.65-0.85 |

### 6.2 Hardware Formula

```
Hardware Cost = Σ (Quantity × (Unit Cost + Installation Cost))
```

---

## 7. Surface Finish Costs

### 7.1 Sheet Metal Finishes

| Finish | Base Cost | Per m² | Min Order | Lead Time |
|--------|-----------|--------|-----------|-----------|
| **As-Cut (deburr)** | $0 | $2/m² | N/A | 0 days |
| **Powder Coat (1 color)** | $25 | $15/m² | $50 | +1 day |
| **Powder Coat (2+ colors)** | $45 | $20/m² | $75 | +2 days |
| **Wet Paint** | $35 | $25/m² | $75 | +2 days |
| **Zinc Plating** | $20 | $10/m² | $50 | +1 day |
| **Anodize (aluminum)** | $30 | $18/m² | $60 | +2 days |
| **Passivation (stainless)** | $15 | $8/m² | $40 | +1 day |
| **Electropolish** | $40 | $35/m² | $100 | +3 days |
| **Black Oxide (steel)** | $15 | $8/m² | $40 | +1 day |

### 7.2 Surface Preparation

| Preparation | Cost/m² | Required For |
|-------------|---------|--------------|
| Chemical clean | $3 | All finishes |
| Sandblast | $8 | Paint, powder coat |
| Hand deburr | $5 | All parts |
| Tumble deburr | $3 | High volume |

---

## 8. Volume Pricing

### 8.1 Quantity Discounts

| Quantity | Discount | Unit Impact |
|----------|----------|-------------|
| 1-4 | 0% | Full price |
| 5-10 | 10% | -10% |
| 11-25 | 15% | -15% |
| 26-50 | 20% | -20% |
| 51-100 | 25% | -25% |
| 100+ | 30%+ | Custom quote |

### 8.2 Setup Amortization

```
Setup Per Part = (Cutting Setup + Bending Setup) / Quantity

Example (10 parts with 4 unique bends):
- Cutting Setup: $25
- Bending Setup: $15 + (3 × $8) = $39
- Total Setup: $64
- Per Part (Qty 10): $6.40
- Per Part (Qty 100): $0.64
```

---

## 9. Lead Time Pricing

### 9.1 Standard Lead Times

| Production Phase | Economy | Standard | Expedited | Rush |
|------------------|---------|----------|-----------|------|
| Cutting | 2-3 days | 1-2 days | Same day | 4 hrs |
| Bending | 2-3 days | 1-2 days | Same day | 4 hrs |
| Hardware | 1 day | Same day | Same day | 2 hrs |
| Finishing | 3-5 days | 2-3 days | 1-2 days | 1 day |
| **Total** | 8-12 days | 5-7 days | 3-4 days | 1-2 days |

### 9.2 Lead Time Multipliers

| Lead Time | Multiplier | Notes |
|-----------|------------|-------|
| Economy (10-15 days) | 0.90× | Batch with other orders |
| Standard (5-7 days) | 1.00× | Base pricing |
| Expedited (3-4 days) | 1.25× | Priority queue |
| Rush (1-2 days) | 1.50× | Dedicated resources |
| Same Day | 2.00× | Emergency only |

---

## 10. Example Calculation

### 10.1 Example: Aluminum Enclosure

**Part Specifications:**
- Material: Aluminum 5052, 2.0mm
- Flat Pattern: 300mm × 400mm (0.12 m²)
- Cut Perimeter: 1.4m + 20 holes (40 pierces)
- Bends: 8 standard 90° bends
- Hardware: 4 PEM nuts
- Finish: Powder coat (white)
- Quantity: 25

**Calculation:**

```
MATERIAL COST:
  Area: 0.12 m²
  Thickness: 2.0mm
  Density: 2.68 g/cm³ = 2680 kg/m³
  Mass: 0.12 m² × 0.002m × 2680 kg/m³ = 0.644 kg
  Cost: 0.644 kg × $8.00/kg × 1.15 (mult) × 1.18 (waste)
  Material: $6.98/part

CUTTING COST:
  Cut Length: 1.4m × $0.25/m = $0.35
  Pierces: 40 × $0.05 = $2.00
  Cutting: $2.35/part

BENDING COST:
  Bends: 8 × $2.50 × 0.90 (aluminum) = $18.00
  Setup: ($15 + $8) / 25 = $0.92
  Bending: $18.92/part

HARDWARE COST:
  PEM Nuts: 4 × ($0.25 + $0.50) = $3.00
  Hardware: $3.00/part

FINISH COST:
  Powder Coat: $25 base + (0.12 m² × 2 sides × $15/m²) = $28.60
  Finish: $28.60/part

SETUP AMORTIZATION:
  Cutting Setup: $25 / 25 = $1.00/part
  (Bending included above)
  Setup: $1.00/part

OVERHEAD (12%):
  ($6.98 + $2.35 + $18.92 + $3.00 + $28.60 + $1.00) × 0.12 = $7.30/part

SUBTOTAL:
  $6.98 + $2.35 + $18.92 + $3.00 + $28.60 + $1.00 + $7.30 = $68.15/part

MARGIN (28%):
  $68.15 × 1.28 = $87.23/part

QUANTITY DISCOUNT (15%):
  $87.23 × 0.85 = $74.15/part

FINAL UNIT PRICE: $74.15
TOTAL ORDER (25 pcs): $1,853.75
```

---

## 11. DFM Cost Impact

### 11.1 Design Optimizations

| Optimization | Savings | Complexity Reduction |
|--------------|---------|---------------------|
| Standardize bend radii | 5-10% | Fewer die changes |
| Reduce bend count | $2-5/bend | Less labor |
| Simplify cut profile | 5-15% | Faster cutting |
| Use standard hole sizes | 3-8% | Standard tooling |
| Design for nesting | 10-20% | Material efficiency |

### 11.2 Common Cost Drivers

| Issue | Cost Impact | Recommendation |
|-------|-------------|----------------|
| Very tight tolerances (<±0.1mm) | +30-50% | Relax where possible |
| Non-standard bend angles | +$4-8/bend | Use 90° when possible |
| Exotic materials | +50-200% | Consider alternatives |
| Very thin (<0.5mm) | +20% | Handling difficulty |
| Very thick (>4mm) | +40-60% | Forming limits |

---

## 12. API Integration

### 12.1 Sheet Metal Geometry Input

```typescript
interface SheetMetalFeatures {
  flatArea: number;           // mm²
  cutPerimeter: number;       // mm
  bendCount: number;          // count
  bendAngles: number[];       // degrees
  holeCount: number;          // count
  thickness: number;          // mm (detected)
  material: SheetMetalMaterial;
}
```

### 12.2 Pricing Output

```typescript
interface SheetMetalPricing {
  materialCost: number;
  cuttingCost: number;
  bendingCost: number;
  hardwareCost: number;
  finishCost: number;
  setupCost: number;
  overheadCost: number;
  unitPrice: number;
  totalPrice: number;
  leadTimeDays: number;
  quantityDiscount: number;
}
```

---

*Document maintained by FFP Tech Team*
*Confidential - Not for external distribution*
