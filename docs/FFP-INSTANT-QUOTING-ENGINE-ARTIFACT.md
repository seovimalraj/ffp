# FFP Instant Quoting Engine — Product & Technical Artifact

**Version:** 1.0  
**Date:** February 27, 2026  
**Classification:** Internal / Confidential  
**Maintainer:** FFP Tech Team

---

## Table of Contents

1. [Product Scope & Current Status](#1-product-scope--current-status)
2. [Architecture Overview](#2-architecture-overview)
3. [Pricing / Rules Engine Description](#3-pricing--rules-engine-description)
4. [Data Model (Entity Level)](#4-data-model-entity-level)
5. [Tenancy Model & Isolation](#5-tenancy-model--isolation)
6. [Environments & Deployment](#6-environments--deployment)
7. [Integrations & Extensibility](#7-integrations--extensibility)
8. [Quality & Performance Targets](#8-quality--performance-targets)
9. [Current Exclusions & Roadmap Gaps](#9-current-exclusions--roadmap-gaps)

---

## 1. Product Scope & Current Status

### 1.1 What the Instant Quoting Engine Does Today

The FFP (Frigate Fast Parts) Instant Quoting Engine is an end-to-end manufacturing intelligence platform that lets customers upload CAD files and receive accurate, instant price quotes for custom parts. The core user flows are:

| # | Flow | Description |
|---|------|-------------|
| 1 | **CAD Upload & Analysis** | Customer uploads STEP, IGES, STL, or DXF files via the web UI. The system extracts volume, surface area, bounding box, holes, pockets, threads, bends, undercuts, fillets, and more. |
| 2 | **Automatic Process Classification** | An 11-tier rule cascade + ML fall-back determines the manufacturing process: sheet metal, CNC milling, CNC turning, 5-axis, turn-mill, weldment, or casting. Classification confidence is scored (target > 95 %). |
| 3 | **DFM Feedback** | A real-time Design-for-Manufacturability check scores the part 0–100 and surfaces issues (deep holes, tight tolerances, thin walls, etc.) with actionable recommendations. |
| 4 | **Instant Pricing** | A multi-factor pricing engine computes material, machining, setup, finish, inspection, overhead, margin, lead-time, and quantity-break costs and returns a line-item price breakdown in < 5 s. |
| 5 | **Configuration & Selection** | Customers choose material, finish, tolerance, quantity, and lead-time option. Pricing updates in real time for each combination. |
| 6 | **Quote Lifecycle** | A quote moves through `draft → processing → ready → sent → accepted / rejected → expired → converted`. Quotes have expiry dates, notes, terms, and email-send timestamps. |
| 7 | **Order Conversion** | An accepted quote converts into an Order with order code (`FRI_ORD_00000001`), payment status, shipping address, estimated delivery dates, and line-item detail. |
| 8 | **Manual Quote Approval** | Parts that exceed the automated threshold ($5 000+) or have low classification confidence (< 60 %) route to an admin approval queue (`manual_quote_approval` table). |
| 9 | **Admin Work Center** | Admins manage users, organizations, roles, quotas, audit events, pricing overrides, and supplier allocation. |
| 10 | **Supplier Portal** | Suppliers see allocated orders, update statuses, and communicate via internal notes. |
| 11 | **Workflow Orchestration** | Inngest + Temporal workflows drive email notifications (quote created, order confirmed, payment received, etc.) and async processing. |

### 1.2 What It Does **Not** Do Yet (Clear Exclusions)

| Area | Current State |
|------|---------------|
| **Multi-currency pricing** | Default currency is USD; multi-currency support is schema-ready (`default_currency` on Organization) but not wired end-to-end. |
| **Injection molding quoting** | Schema exists (`InjectionMoldingPriceRequestSchema`) but the pricing pipeline is not production-ready. |
| **Nesting optimization** | Waste factors are static lookup tables; no dynamic nesting solver. |
| **Real-time inventory / stock-aware pricing** | Material costs are table-driven; no ERP / stock feed integration. |
| **Multi-region pricing rules** | Pricing profiles are per-machine, not per-region. Region-based cost variation is a planned extension. |
| **Automated payment collection** | PayPal sandbox integration exists; Stripe and production PayPal are not live. |
| **Full ITAR / DFARS enforcement** | Flags exist on Organization (`itar_mode`, `dfars_only`) but enforcement logic is partial. |
| **White-label widget** | `widget_origins` field is defined; embeddable quoting widget is not yet shipped. |
| **Assembly quoting** | Multi-body / assembly uploads are flagged for manual quote; automated assembly pricing is not implemented. |

### 1.3 Release Information

| Field | Value |
|-------|-------|
| **Monorepo name** | `cnc-quote` (root `package.json`) |
| **Current version** | `0.0.1` (pre-1.0 iteration) |
| **Last documentation version** | Technical docs v1.0 — February 2026 |
| **Deployment method** | Docker Compose → Dokploy (Traefik reverse proxy, Let's Encrypt TLS) |
| **Production domain** | `app.frigate.ai` (web), `ffp-api.frigate.ai` (API), `ffp-cad.frigate.ai` (CAD), `ffp-workflow.frigate.ai` (workflows) |
| **Branch strategy** | `main` branch deploys to production via Docker build context |

---

## 2. Architecture Overview

### 2.1 High-Level System Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          FFP PLATFORM ARCHITECTURE                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌───────────────┐      ┌─────────────────┐      ┌───────────────────────┐ │
│   │    Web UI      │─────▶│   API Server    │─────▶│     CAD Service       │ │
│   │  (Next.js)     │      │   (NestJS)      │      │   (FastAPI / Python)  │ │
│   │  Port 3000     │      │   Port 3001     │      │    Port 10001         │ │
│   └───────┬────────┘      └────────┬────────┘      └──────────┬────────────┘ │
│           │                        │                           │              │
│           │                        │                           │              │
│   ┌───────▼────────┐      ┌───────▼─────────┐      ┌─────────▼────────────┐ │
│   │  Traefik /     │      │   Supabase      │      │  OpenCASCADE (OCC)   │ │
│   │  Nginx LB      │      │  (PostgreSQL +  │      │  + Trimesh + ezdxf   │ │
│   │                │      │   Storage)      │      │  (geometry engines)  │ │
│   └────────────────┘      └───────┬─────────┘      └──────────────────────┘ │
│                                   │                                          │
│   ┌────────────────┐      ┌───────▼─────────┐      ┌──────────────────────┐ │
│   │  Workflow Svc   │      │   Redis         │      │  Pricing Engine      │ │
│   │  (Hono + TS)   │      │  (Upstash /     │      │  (TypeScript, in-    │ │
│   │  Port 3004     │      │   self-hosted)  │      │   API-Server proc)   │ │
│   └───────┬────────┘      └─────────────────┘      └──────────────────────┘ │
│           │                                                                  │
│   ┌───────▼────────┐      ┌─────────────────┐                               │
│   │  Inngest       │      │  Temporal        │                               │
│   │  (event-driven │      │  (durable        │                               │
│   │   functions)   │      │   workflows)     │                               │
│   └────────────────┘      └─────────────────┘                               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Summary

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| **Web UI** | Next.js 14+, React, Tailwind | Upload UX, quote builder, dashboards, admin & supplier portals |
| **API Server** | NestJS (Node 20) | Auth, RBAC, business logic, pricing engine, order management, file orchestration |
| **CAD Service** | FastAPI (Python 3.11+), OpenCASCADE, Trimesh | STEP/IGES/STL/DXF loading, geometry extraction, process classification, DFM analysis |
| **Workflow Service** | Hono server + Inngest SDK + Temporal client | Email notifications, async workflows (quote created, order confirmed, manual review, etc.) |
| **Database** | Supabase (PostgreSQL 15) | Relational storage for users, orgs, RFQs, orders, quotes, pricing profiles, audit events |
| **File Storage** | Supabase Storage (S3-compatible, CDN-backed) | CAD file storage with signed URLs, 2D snapshots |
| **Redis** | Upstash (prod) / self-hosted (dev) | Job queue, caching, rate-limit counters |
| **Reverse Proxy** | Traefik (Dokploy) + Nginx | TLS termination, routing (`app.frigate.ai` → web; `/api/` → API), gzip, rate limiting |

### 2.3 Key Design Choices & Modularity Boundaries

| Decision | Rationale |
|----------|-----------|
| **Pricing engine inside the API Server** | Avoids an extra network hop; shares DB connection pool. Exposed through typed Zod-validated schemas (`PricingProfileSchema`, `PriceRequestSchema`, `PriceResponseSchema`) for future extraction. |
| **CAD Service as a separate Python micro-service** | Python is required for OpenCASCADE / Trimesh bindings. Stateless design allows independent horizontal scaling (up to 100+ concurrent analyses). |
| **Workflow orchestration split: Inngest + Temporal** | Inngest handles event-driven, branch-able serverless functions (email, webhooks). Temporal handles long-running durable workflows (manual review, supplier allocation). |
| **Monorepo with shared package** | `packages/shared` contains Zod schemas, TypeScript interfaces, and pricing types consumed by both API and Web, enforcing contract alignment at compile time. |
| **Supabase as unified backend** | Single managed service for auth helpers, PostgreSQL, Row-Level Security, file storage, and real-time subscriptions. |

### 2.4 Request Data Flow (Happy Path — Instant Quote)

```
1. Customer uploads CAD  →  Web UI (Next.js)
                              │
2. File stored             →  Supabase Storage (signed URL)
                              │
3. Analysis request         →  API Server (NestJS) → POST /analyze → CAD Service (FastAPI)
                              │
4. Geometry extraction     →  OpenCASCADE / Trimesh  (volume, SA, bbox, features)
                              │
5. Classification          →  11-tier rule cascade + ML ensemble  →  process_type + confidence
                              │
6. DFM check               →  DFM Analyzer → score 0-100, issues[], recommendations[]
                              │
7. Pricing calculation     →  Pricing Engine (TS in API) → PriceResponse { unit_price, breakdown }
                              │
8. Quote returned          →  Web UI renders quote with breakdown, DFM card, 3D viewer
                              │
9. Order conversion        →  Customer accepts → Order record + Inngest "order.confirmed" event
                              │
10. Workflow triggered     →  Email notifications, supplier allocation, Temporal workflows
```

---

## 3. Pricing / Rules Engine Description

### 3.1 Inputs Consumed

The pricing engine accepts a typed request per process type. Common inputs:

| Input | Source | Example |
|-------|--------|---------|
| **Process type** | CAD classification | `milling`, `turning`, `sheet_metal` |
| **Machine ID** | Pricing profile lookup | Links to `PricingProfile` |
| **Material ID** | Customer selection | Aluminum 6061, SS 304, Titanium 6Al-4V, etc. |
| **Quantity** | Customer selection | 1–1 000+ |
| **Finish IDs** | Customer selection | Anodized, powder coat, etc. |
| **Tolerance class** | Customer selection | Standard / Precision / Tight |
| **Lead-time option** | Customer selection | Economy / Standard / Expedited / Rush |
| **Is Rush** | Boolean flag | Triggers `rush_surcharge` multiplier |
| **Geometry metrics** | CAD Service output | `volume_cc`, `surface_area_cm2`, `removed_material_cc`, `cut_length_mm`, `bends`, `pierces`, `thickness_mm` |
| **Feature counts** | CAD Service output | holes, pockets, slots, faces, threads, undercuts |
| **Complexity score** | CAD Service output | 0–100 (SV ratio derived) |

### 3.2 How Pricing Is Computed (Pipeline Stages)

#### CNC Machining Pipeline

```
Stage 1 — Material Cost
  Volume × Density × $/kg × Waste Factor

Stage 2 — Machining Cost
  (Material Removal Time + Feature Time) × Machine $/hr × Complexity Multiplier

Stage 3 — Setup Cost
  Fixed Setup ÷ Quantity

Stage 4 — Finish Cost
  Base Finish $ + Surface Area × $/cm²

Stage 5 — Inspection Cost
  Base QA $/part × Tolerance Multiplier (1.0× → 1.35×)

Stage 6 — Overhead
  (Material + Machining + Setup) × Overhead %  (typ. 12–15 %)

Stage 7 — Margin
  Subtotal × Margin %  (typ. 25–35 %)

Stage 8 — Lead-Time Multiplier
  × 0.95 (economy) … 1.00 (standard) … 1.25 (expedited) … 1.50 (rush)

Stage 9 — Quantity Discount
  Tiered: 5 % @ 5 qty → 30 % @ 250+ qty
```

#### Sheet Metal Pipeline

```
Stage 1 — Material Cost
  Flat Area × Thickness × Density × $/kg × Thickness Multiplier × Waste Factor

Stage 2 — Cutting Cost
  Cut Length × $/m (by method: fiber laser, plasma, waterjet) + Pierce Count × $/pierce

Stage 3 — Bending Cost
  Bend Count × $/bend × Material Factor × Complexity Factor + Setup

Stage 4 — Hardware Cost
  Σ (PEM / rivet / standoff qty × unit + install cost)

Stage 5 — Finish Cost
  Surface Area × $/m² (powder coat, anodize, zinc plate, etc.)

Stage 6–9 — Overhead, Margin, Lead-Time, Quantity Discount
  Same structure as CNC
```

### 3.3 Rule Types Supported

| Rule Type | Example | Enforcement |
|-----------|---------|-------------|
| **Margin floor** | Min margin 25 % | `PricingProfile.margin` — cannot be overridden below floor |
| **Min unit price** | $15 per part | `PricingProfile.min_price_per_part` — covers handling cost |
| **Min order value** | $50 per order | `PricingProfile.min_order_value` — covers transaction costs |
| **Max complexity premium** | 2.5× cap | `complexity_multiplier()` returns `min(computed, 2.5)` |
| **Quantity-break discounts** | Tiered % off | `PricingProfile.quantity_breaks[]` — `{ min_qty, discount }` |
| **Rush surcharge** | +25 % to +50 % | `PricingProfile.rush_surcharge` |
| **Tolerance multiplier** | 1.0× standard → 1.35× tight | Applied in inspection cost stage |
| **Manual-quote threshold** | > $5 000 unit price | Routes to `manual_quote_approval` |
| **Lead-time multiplier** | 0.90× economy … 2.00× same-day | Per-profile configurable |

### 3.4 Versioning — Rule Sets & Effective Dating

| Mechanism | Implementation |
|-----------|----------------|
| **Pricing Profile per machine** | Each `PricingProfile` record is keyed by `machine_id`. Different machines (3-axis VMC, 5-axis VMC, CNC lathe, press brake, etc.) carry independent cost models. |
| **Organization plan tier** | `Organization.plan` (`free`, `pro`, `enterprise`) can drive future per-tier margin or discount overrides. |
| **Schema timestamps** | Every `PricingProfile`, `PriceBreakdown`, and `QuoteLine` carries `created_at` / `updated_at` for temporal traceability. |
| **Quote-line snapshot** | The `pricing` JSONB column on `rfq_parts` and the `breakdown` object in `QuoteLinePricingVNext` freeze the full cost breakdown at quote time so it can be reproduced later regardless of subsequent rule changes. |
| **Overrides** | `QuoteLineOverridesVNext` allows per-line `unitPrice`, `leadTimeDays`, and `marginPercent` overrides with audit trail (`QuoteLineAuditVNext`). |

### 3.5 Auditability — Reproducing a Quote Exactly

| Artifact | Where Stored | Purpose |
|----------|--------------|---------|
| **Geometry snapshot** | `rfq_parts.geometry` (JSONB) | Exact volume, SA, bbox, features at analysis time |
| **Pricing snapshot** | `rfq_parts.pricing` (JSONB) + `QuoteLinePricingVNext.matrix[]` | Full cost breakdown per quantity tier |
| **DFM snapshot** | `QuoteLineDfmVNext { status, issues[] }` | DFM score and issue list frozen at quote time |
| **Selection snapshot** | `QuoteLineSelectionVNext` | Material, finish, tolerance, lead-time, quantities selected |
| **Override snapshot** | `QuoteLineOverridesVNext` | Any manual price / lead-time adjustments |
| **Audit events** | `AuditEvent` table (+ `AdminRecentEvent` contracts) | Actor, IP, action, before/after diff, timestamp for every mutation |
| **Order address snapshot** | `orders.address_snapshot` (JSONB) | Shipping address at order time |
| **Classification metadata** | CAD Service response `classification_metadata { method, reasoning }` | Which tier, which algorithm, which signals drove the classification |

Together these snapshots mean any historical quote can be fully reconstructed: same geometry → same rules → same price.

---

## 4. Data Model (Entity Level)

### 4.1 Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────────┐
│    User       │──────▶│   Membership     │◀──────│  Organization    │
│               │  1:N  │ (role per org)   │  N:1  │                  │
│ id            │       │ user_id          │       │ id               │
│ email         │       │ organization_id  │       │ name             │
│ role (global) │       │ role (org-level) │       │ plan             │
│ org_id        │       │                  │       │ billing_status   │
└──────┬───────┘       └──────────────────┘       │ itar_mode        │
       │                                           │ default_currency │
       │ creates                                   └────────┬─────────┘
       ▼                                                    │ has
┌──────────────┐       ┌──────────────────┐       ┌────────▼─────────┐
│    RFQ        │──────▶│   RFQ Part       │       │     Quota        │
│               │  1:N  │  (line item)     │       │                  │
│ id            │       │ id               │       │ storage_gb       │
│ rfq_code      │       │ rfq_id           │       │ cad_jobs_month   │
│ user_id       │       │ file_name        │       │ quotes_month     │
│ status        │       │ material         │       │ orders_month     │
│ rfq_type      │       │ process          │       │ api_calls_hour   │
│ final_price   │       │ quantity         │       └──────────────────┘
│ order_id      │       │ tolerance        │
│ org_id        │       │ finish           │
└──────┬───────┘       │ geometry (JSONB) │
       │                │ pricing  (JSONB) │
       │ converts to    │ thickness        │
       ▼                └──────────────────┘
┌──────────────┐
│    Order      │       ┌──────────────────┐
│               │──────▶│   Order Part     │
│ id            │  1:N  │                  │
│ order_code    │       │ order_id         │
│ rfq_id        │       │ rfq_part_id      │
│ status        │       │ quantity         │
│ payment_status│       │ unit_price       │
│ subtotal      │       │ total_price      │
│ shipping_cost │       └──────────────────┘
│ tax_amount    │
│ total_amount  │       ┌──────────────────┐
│ address_snap  │       │ ManualQuote      │
│ confirmed_at  │       │ Approval         │
└──────────────┘       │                  │
                        │ rfq_id           │
┌──────────────┐       │ rfq_part_id      │
│  Quote (vNext)│       │ is_approved      │
│               │       │ approved_at      │
│ id            │       │ approved_by      │
│ org_id        │       └──────────────────┘
│ customer_id   │
│ status (lifecycle) │  ┌──────────────────┐
│ totals        │       │   AuditEvent     │
│ notes / terms │       │                  │
│ lines[]       │────▶  │ actor_user_id    │
│ meta          │       │ actor_ip         │
└──────────────┘       │ org_id           │
                        │ target_type      │
┌──────────────┐       │ target_id        │
│ PricingProfile│       │ action           │
│               │       │ before / after   │
│ id            │       │ ts               │
│ machine_id    │       └──────────────────┘
│ setup_cost    │
│ machine_rate  │       ┌──────────────────┐
│ margin        │       │    Invite        │
│ overhead      │       │                  │
│ rush_surcharge│       │ email            │
│ quantity_breaks│      │ org_id           │
│ feature_times │       │ role             │
│ lead times    │       │ status           │
└──────────────┘       └──────────────────┘
```

### 4.2 Key Entities Reference

| Entity | Table / Schema | Key Fields |
|--------|---------------|------------|
| **User** | `users` | `id`, `email`, `password_hash`, `role` (admin/supplier/customer), `organization_id`, `verified` |
| **Organization** | `organizations` | `id`, `name`, `plan` (free/pro/enterprise), `billing_status`, `country`, `itar_mode`, `dfars_only`, `widget_origins`, `default_currency` |
| **Membership** | shared Zod schema | `user_id`, `organization_id`, `role` (buyer/org_admin/reviewer/operator/finance/admin) |
| **RFQ** | `rfq` | `id`, `rfq_code`, `user_id`, `organization_id`, `order_id`, `rfq_type` (general/manual), `status`, `final_price` |
| **RFQ Part** (Line Item) | `rfq_parts` | `id`, `rfq_id`, `file_name`, `cad_file_url`, `material`, `process`, `quantity`, `tolerance`, `finish`, `threads`, `inspection`, `geometry` (JSONB), `pricing` (JSONB), `thickness`, `sheet_thickness_mm` |
| **Order** | `orders` | `id`, `order_code`, `organization_id`, `rfq_id`, `status`, `payment_status`, `subtotal`, `shipping_cost`, `tax_amount`, `total_amount`, `address_snapshot` (JSONB), `confirmed_at` |
| **Quote (vNext)** | Zod contract `QuoteSummaryVNext` | `id`, `orgId`, `customerId`, `status` (9-state lifecycle), `totals { subtotal, total, currency }`, `lines[]`, `meta { expiresAt, acceptedAt, … }` |
| **Quote Line (vNext)** | `QuoteLineVNext` | `id`, `quoteId`, `fileId`, `selection` (material, finish, tolerance, quantities), `pricing.matrix[]` (per-qty breakdown), `dfm { issues[] }`, `overrides`, `audit` |
| **PricingProfile** | pricing config | `id`, `machine_id`, `setup_cost`, `machine_rate_per_hour`, `margin`, `overhead`, `rush_surcharge`, `quantity_breaks[]`, `feature_times`, per-process parameters |
| **ManualQuoteApproval** | `manual_quote_approval` | `id`, `rfq_id`, `rfq_part_id`, `is_approved`, `approved_at`, `approved_by` |
| **AuditEvent** | audit table | `id`, `actor_user_id`, `actor_ip`, `org_id`, `target_type`, `target_id`, `action`, `before`, `after`, `ts` |
| **Quota** | per-org limits | `organization_id`, `limit { storage_gb, cad_jobs_month, quotes_month, … }`, `usage { … }`, `period_start/end` |
| **Invite** | org invitations | `id`, `email`, `organization_id`, `role`, `status` (pending/accepted/expired/revoked), `expires_at` |

---

## 5. Tenancy Model & Isolation

| Dimension | Design |
|-----------|--------|
| **Architecture** | **Multi-tenant, shared-infrastructure**. All organizations share the same database, API, and CAD service instances. |
| **Tenant identifier** | `organization_id` (UUID) on every data row (rfq, rfq_parts, orders, quotes, audit events). |
| **Row-Level Security (RLS)** | Supabase RLS policies enforce that queries are scoped to the authenticated user's `organization_id`. Service-role key bypasses RLS for admin operations. |
| **RBAC** | Two-tier role model: (a) global `user.role` (admin / supplier / customer), (b) org-level `Membership.role` (buyer / org_admin / reviewer / operator / finance / admin). |
| **Data isolation** | File uploads are stored under org-scoped paths in Supabase Storage buckets. Signed URLs prevent cross-tenant file access. |
| **Plan-based quotas** | Each organization has a `Quota` record with `limit` and `usage` counters (storage GB, CAD jobs/month, quotes/month, orders/month, API calls/hour). |
| **Compliance flags** | `itar_mode` and `dfars_only` flags on Organization for future export-control enforcement. |

---

## 6. Environments & Deployment

### 6.1 Environments

| Environment | Domain / URL | Purpose | Notes |
|-------------|-------------|---------|-------|
| **Development** | `localhost:3000` (web), `localhost:4001` (API) | Local dev via `pnpm dev` (Turborepo) | Uses Upstash Redis, remote Supabase (dev project), sandbox PayPal |
| **Production** | `app.frigate.ai` (web + combined), `ffp-api.frigate.ai`, `ffp-cad.frigate.ai`, `ffp-workflow.frigate.ai` | Live customer traffic | Docker Compose on Dokploy, Traefik LB, Let's Encrypt TLS |

> **Note:** A formal staging environment is not yet separate from production; the current path is local dev → `main` branch → production deploy. This is a known gap.

### 6.2 Deployment Topology

```
┌───────────────────────────────────────────────────────────────────────┐
│                         Dokploy Host                                  │
│                                                                       │
│   ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐ │
│   │ ffp-web    │   │ ffp-api    │   │ ffp-cad-   │   │ ffp-       │ │
│   │ (Next.js)  │   │ (NestJS)   │   │ service    │   │ workflow   │ │
│   │ :3000      │   │ :3001      │   │ (FastAPI)  │   │ (Hono)     │ │
│   │            │   │            │   │ :10001     │   │ :3004      │ │
│   └─────┬──────┘   └─────┬──────┘   └──────┬─────┘   └─────┬──────┘ │
│         │                │                  │               │        │
│         └────────────────┼──────────────────┼───────────────┘        │
│                          │                  │                        │
│                   ┌──────▼──────┐           │                        │
│                   │   Traefik   │           │                        │
│                   │  (TLS + LB) │           │                        │
│                   └──────┬──────┘           │                        │
│                          │                  │                        │
└──────────────────────────┼──────────────────┼────────────────────────┘
                           │                  │
                   ┌───────▼──────────────────▼─────┐
                   │      External Services          │
                   │                                 │
                   │  • Supabase (PostgreSQL +        │
                   │    Storage + Auth)               │
                   │  • Redis (Upstash / self-hosted) │
                   │  • Inngest Cloud / self-hosted   │
                   │  • Temporal (self-hosted)         │
                   │  • SMTP (smtp-pulse.com)          │
                   │  • PayPal Sandbox                 │
                   └─────────────────────────────────┘
```

### 6.3 Container Resources

| Service | CPU | RAM | Storage |
|---------|-----|-----|---------|
| CAD Service | 2+ cores | 4 GB+ | 10 GB |
| API Server | 1+ core | 1 GB | 5 GB |
| Web Frontend | 0.5 core | 512 MB | 1 GB |
| Workflow Service | 0.5 core | 512 MB | 1 GB |

### 6.4 Build & Tooling

| Tool | Purpose |
|------|---------|
| **pnpm** (workspace) | Package management, monorepo linking |
| **Turborepo** | Task runner — `pnpm build`, `pnpm dev`, `pnpm lint`, `pnpm test` |
| **tsup** | Shared package bundler |
| **Docker** | Container images per service |
| **Husky** | Git hooks (pre-commit) |
| **ESLint + Prettier** | Linting & formatting |

---

## 7. Integrations & Extensibility

| Integration | Protocol | Status |
|-------------|----------|--------|
| **Supabase Auth** | JWT (HS256), 7-day expiry | Active |
| **Supabase Storage** | S3-compatible, signed URLs, 80 MB max upload | Active |
| **Inngest** | Event-based serverless functions | Active (email workflows) |
| **Temporal** | gRPC durable workflows | Active (quote-created, manual-review) |
| **PayPal** | REST API, sandbox | Sandbox only |
| **SMTP (SendPulse)** | SMTP 465/TLS | Active (transactional email) |
| **ERP** | REST API + Webhooks + CSV/Excel export | Planned |
| **CAD Formats** | STEP, IGES, STL, DXF | Active |
| **Observability** | OpenTelemetry (CAD Service `otel.py`), SonarQube (sonar-project.properties) | Partial |

---

## 8. Quality & Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| STEP analysis (< 10 MB) | < 5 s | ~2–4 s |
| STL analysis (< 5 MB) | < 3 s | ~1–2 s |
| DXF analysis | < 2 s | ~0.5 s |
| Concurrent CAD analyses | 50+ | 100+ |
| Classification accuracy | > 95 % | 97.2 % |
| Average classification confidence | > 85 % | 88.5 % |
| False positive rate | < 3 % | 1.8 % |
| Classification processing time | < 2 s | ~1.2 s |

---

## 9. Current Exclusions & Roadmap Gaps

| # | Gap | Impact | Priority |
|---|-----|--------|----------|
| 1 | **No dedicated staging environment** | Risk of regressions reaching production without pre-prod validation | High |
| 2 | **Injection molding pricing not wired** | Cannot auto-quote IM parts despite schema readiness | Medium |
| 3 | **Static nesting / waste factors** | Suboptimal sheet metal material cost for large batches | Medium |
| 4 | **No real-time stock feed** | Material pricing may drift from market | Medium |
| 5 | **Payment processing sandbox only** | Cannot collect real payments | High |
| 6 | **ITAR/DFARS enforcement partial** | Compliance-sensitive orgs cannot yet rely on platform controls | High (for regulated customers) |
| 7 | **White-label quoting widget** | Cannot embed quoting in third-party sites | Low |
| 8 | **Assembly auto-pricing** | Multi-body assemblies always route to manual quote | Medium |
| 9 | **Region-based pricing rules** | Single pricing profile set; no per-region overrides | Low |
| 10 | **Semantic versioning & changelog** | Version is `0.0.1`; no automated release notes | Medium |

---

*Document generated from codebase analysis — FFP Tech Team, February 2026*
