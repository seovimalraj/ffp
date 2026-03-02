# FFP Technical Documentation

**Version:** 1.0  
**Last Updated:** February 2026  
**Classification:** Internal Technical Reference

---

## Overview

This documentation suite provides comprehensive technical information about the FFP (Frigate Fast Parts) CAD Analysis and Pricing System. It is intended for:

- **Engineering Team**: System architecture, algorithms, implementation details
- **Leadership**: Business logic, capabilities overview, competitive positioning  
- **Investors**: Technology differentiation, IP value, scalability

---

## Document Index

### Core Technical Documents

| # | Document | Description | Audience |
|---|----------|-------------|----------|
| 01 | [System Architecture](01-SYSTEM-ARCHITECTURE.md) | Overall platform architecture, components, data flow | Engineering, Leadership |
| 02 | [Part Identification](02-PART-IDENTIFICATION.md) | Process classification algorithms, sheet metal vs CNC detection | Engineering, Investors |
| 03 | [CNC Pricing Calculation](03-CNC-PRICING-CALCULATION.md) | Cost breakdown, machine rates, material costs | Engineering, Finance |
| 04 | [Sheet Metal Pricing](04-SHEET-METAL-PRICING.md) | Cutting, bending, hardware, finish costs | Engineering, Finance |
| 05 | [CAD File Processing](05-CAD-FILE-PROCESSING.md) | STEP, STL, DXF parsing and feature extraction | Engineering |
| 06 | [DFM Analysis](06-DFM-ANALYSIS.md) | Design for Manufacturability rules and recommendations | Engineering, Sales |
| 07 | [Feature Extraction](07-FEATURE-EXTRACTION.md) | Hole, pocket, bend, and thread detection algorithms | Engineering |
| 08 | [Secure File Handling](08-SECURE-FILE-HANDLING.md) | File upload security, validation, and cleanup | Engineering, Security |
| 09 | [ML Classification](09-ML-CLASSIFICATION.md) | Machine learning model for process classification | Engineering, Data Science |
| 10 | [Advanced Algorithms](10-ADVANCED-ALGORITHMS.md) | Deep technical implementation details and optimizations | Senior Engineering |

---

## Quick Reference

### Supported File Formats

| Format | Extensions | Analysis Level |
|--------|------------|----------------|
| STEP (preferred) | .step, .stp | Full (B-Rep + features) |
| IGES | .iges, .igs | Full (B-Rep + features) |
| STL | .stl | Geometric (mesh-based) |
| DXF | .dxf | 2D flat pattern only |

### Manufacturing Processes

| Process | Key Indicators |
|---------|----------------|
| **Sheet Metal** | Uniform wall (0.4-6mm), paired planes, bends |
| **CNC Milling** | Pockets, threads, variable thickness |
| **CNC Turning** | High cylinder ratio, rotational symmetry |
| **5-Axis CNC** | Undercuts, multi-directional access |
| **Turn-Mill** | Turned body + cross-holes/flats |

### Pricing Components

**CNC Machining:**
```
Material + Machining Time + Setup (÷qty) + Finish + Inspection + Overhead
× Margin × Lead Time Multiplier = Unit Price
```

**Sheet Metal:**
```
Material (area) + Cutting (perimeter) + Bending (count) + Hardware + Finish + Setup
× Margin × Lead Time Multiplier = Unit Price
```

---

## Key Differentiators (For Investors)

### 1. Intelligent Part Recognition
- **11-tier classification cascade** with 97%+ accuracy
- **Hybrid ML + rule engine** for edge cases
- **Material-aware** thickness detection

### 2. Instant Quoting
- **< 5 seconds** for STEP files under 10MB
- **Feature-based pricing** (holes, pockets, bends)
- **DFM feedback** with cost impact

### 3. Competitive Positioning
- **30% more competitive** than Xometry/Protolabs
- **Lower overhead** via automation
- **Process optimization** recommendations

### 4. Technology Stack

| Layer | Technology | Why |
|-------|------------|-----|
| CAD Analysis | Python + OpenCASCADE | Industry-standard B-Rep |
| Pricing Engine | TypeScript | Type safety, fast calculations |
| API | FastAPI + NestJS | High performance, scalable |
| Frontend | Next.js | Modern, responsive UX |

---

## Contact & Ownership

| Role | Contact |
|------|---------|
| Engineering Lead | [engineering@ffp.com] |
| Product Owner | [product@ffp.com] |
| Documentation | [docs@ffp.com] |

---

## Document Maintenance

These documents should be updated when:
- Classification algorithms change
- Pricing factors are updated
- New file formats are supported
- DFM rules are added/modified

**Last Audit:** February 2026  
**Next Review:** May 2026

---

## Appendix: Glossary

| Term | Definition |
|------|------------|
| **B-Rep** | Boundary Representation - 3D model defined by surfaces |
| **Mesh** | 3D model defined by triangular facets |
| **Face** | Single surface on a 3D model |
| **PMI** | Product Manufacturing Information (tolerances, GD&T) |
| **K-Factor** | Ratio for sheet metal bend calculations |
| **Machinability** | Ease of cutting a material (1.0 = aluminum baseline) |
| **Setup** | One-time cost for fixturing and programming |
| **Cycle Time** | Machine time per part |

---

*© 2026 FFP - Confidential*
