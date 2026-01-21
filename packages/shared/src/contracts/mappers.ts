import { ContractsV1, ContractsVNext } from './index';

type PartConfigV1 = ContractsV1.PartConfigV1;
type QuoteSummaryV1 = ContractsV1.QuoteSummaryV1;

type QuoteLineVNext = ContractsVNext.QuoteLineVNext;
type QuoteSummaryVNext = ContractsVNext.QuoteSummaryVNext;

type ProcessTypeV1 = PartConfigV1['process_type'];
type LeadTimeOptionV1 = PartConfigV1['lead_time_option'];
type ToleranceClassV1 = PartConfigV1['tolerance_class'];
type InspectionLevelV1 = PartConfigV1['inspection_level'];
type SurfaceFinishV1 = PartConfigV1['surface_finish'];
type MachiningComplexityV1 = PartConfigV1['machining_complexity'];

const DEFAULT_PROCESS: ProcessTypeV1 = 'cnc_milling';
const DEFAULT_LEAD: LeadTimeOptionV1 = 'standard';
const DEFAULT_TOLERANCE: ToleranceClassV1 = 'standard';
const DEFAULT_INSPECTION: InspectionLevelV1 = 'basic';
const FALLBACK_BREAKDOWN: ContractsV1.PricingBreakdownV1 = {
  material: 0,
  machining: 0,
  setup: 0,
  finish: 0,
  inspection: 0,
  overhead: 0,
  margin: 0,
};

function coerceProcessType(value?: string | null): ProcessTypeV1 {
  if (!value) return DEFAULT_PROCESS;
  const normalized = value as ProcessTypeV1;
  return normalized;
}

function coerceLeadTimeOption(value?: string | null): LeadTimeOptionV1 {
  if (!value) return DEFAULT_LEAD;
  const normalized = value as LeadTimeOptionV1;
  return normalized;
}

function coerceToleranceClass(value?: string | null): ToleranceClassV1 {
  if (!value) return DEFAULT_TOLERANCE;
  const normalized = value as ToleranceClassV1;
  return normalized;
}

function coerceInspectionLevel(value?: string | null): InspectionLevelV1 {
  if (!value) return DEFAULT_INSPECTION;
  const normalized = value as InspectionLevelV1;
  return normalized;
}

function coerceSurfaceFinish(value?: string | null): SurfaceFinishV1 | undefined {
  if (!value) return undefined;
  return value === 'standard' || value === 'improved' || value === 'fine' ? value : undefined;
}

function coerceMachiningComplexity(value?: string | null): MachiningComplexityV1 | undefined {
  if (!value) return undefined;
  return value === 'low' || value === 'medium' || value === 'high' ? value : undefined;
}

function coerceDfmSeverity(severity?: string): ContractsV1.DfmIssueV1['severity'] {
  if (!severity) return 'info';
  const normalized = severity.toLowerCase();
  if (normalized === 'critical') return 'critical';
  if (normalized === 'warn' || normalized === 'warning') return 'warn';
  return 'info';
}

function mapPricingMatrixV1ToVNext(part: PartConfigV1): ContractsVNext.QuoteLineVNext['pricing'] {
  const matrix = (part.pricing.matrix || []).map((row) => ({
    quantity: row.quantity,
    unitPrice: row.unit_price ?? null,
    totalPrice: row.total_price ?? null,
    leadTimeDays: row.lead_time_days ?? null,
    currency: part.pricing.currency ?? undefined,
    status: row.status,
    breakdown: row.breakdown ? { ...row.breakdown } : undefined,
  }));

  return {
    status: part.pricing.status ?? 'pending',
    currency: part.pricing.currency ?? undefined,
    matrix,
  };
}

function mapPricingMatrixVNextToV1(line: QuoteLineVNext): PartConfigV1['pricing'] {
  const matrix = (line.pricing.matrix || []).map((row) => ({
    quantity: row.quantity,
    unit_price: row.unitPrice ?? 0,
    total_price: row.totalPrice ?? 0,
    lead_time_days: row.leadTimeDays ?? 0,
    // Cast via unknown to satisfy stricter TS where Record<string, unknown> is not assignable to typed breakdown
    breakdown: (row.breakdown as unknown as ContractsV1.PricingBreakdownV1 | undefined) ?? FALLBACK_BREAKDOWN,
    status: row.status ?? 'ready',
  }));

  return {
    status: (line.pricing.status as PartConfigV1['pricing']['status']) ?? 'pending',
    matrix,
    currency: line.pricing.currency ?? 'USD',
  };
}

function mapDfmV1ToVNext(part: PartConfigV1): ContractsVNext.QuoteLineVNext['dfm'] {
  return {
    status: part.dfm.status,
    issues: (part.dfm.issues || []).map((issue) => ({
      id: issue.id,
      severity: issue.severity === 'warn' ? 'warn' : issue.severity === 'critical' ? 'critical' : 'info',
      category: issue.category,
      message: issue.message,
      recommendation: issue.recommendation,
      refs: issue.refs ? { ...issue.refs } : undefined,
    })),
  };
}

function mapDfmVNextToV1(line: QuoteLineVNext): PartConfigV1['dfm'] {
  return {
    status: (line.dfm.status as PartConfigV1['dfm']['status']) ?? 'pending',
    issues: (line.dfm.issues || []).map((issue) => ({
      id: issue.id,
      severity: coerceDfmSeverity(issue.severity),
      category: (issue.category as ContractsV1.DfmIssueV1['category']) ?? 'geometry_complexity',
      message: issue.message,
      recommendation: issue.recommendation,
      refs: issue.refs as ContractsV1.DfmIssueV1['refs'] | undefined,
      auto_fixable: undefined,
    })),
  };
}

function mapPartConfigV1ToVNext(part: PartConfigV1): QuoteLineVNext {
  const selection = {
    processType: part.process_type ?? null,
    materialId: part.material_id ?? null,
    materialSpec: part.material_spec ?? null,
    finishIds: [...(part.finish_ids || [])],
    toleranceClass: part.tolerance_class ?? null,
    tolerances: part.tolerances ? [...part.tolerances] : undefined,
    inspectionLevel: part.inspection_level ?? null,
    leadTimeOption: part.lead_time_option ?? null,
    secondaryOperations: [...(part.secondary_operations || [])],
    surfaceFinish: part.surface_finish ?? null,
    machiningComplexity: part.machining_complexity ?? null,
    selectedQuantity: part.selected_quantity ?? null,
    quantities: [...(part.quantities || [])],
    // Sheet metal fields
    sheetThicknessMm: part.sheet_thickness_mm ?? null,
    bendCount: part.bend_count ?? null,
    materialGauge: part.material_gauge ?? null,
  };

  const quoteLine: ContractsVNext.QuoteLineVNext = {
    id: part.id,
    quoteId: part.quote_id,
    fileId: part.file_id,
    selection,
    geometry: part.geometry ? { metrics: { ...part.geometry.metrics } } : undefined,
    pricing: mapPricingMatrixV1ToVNext(part),
    dfm: mapDfmV1ToVNext(part),
    overrides: part.overrides
      ? {
          unitPrice: part.overrides.unit_price ?? null,
          leadTimeDays: part.overrides.lead_time_days ?? null,
          marginPercent: part.overrides.margin_percent ?? null,
        }
      : undefined,
    audit: {
      createdAt: part.audit.created_at,
      updatedAt: part.audit.updated_at,
    },
  };

  return ContractsVNext.QuoteLineSchema.parse(quoteLine);
}

function mapPartConfigVNextToV1(line: QuoteLineVNext): PartConfigV1 {
  const quantities = line.selection.quantities && line.selection.quantities.length > 0 ? line.selection.quantities : [line.selection.selectedQuantity ?? 1];

  return {
    id: line.id,
    quote_id: line.quoteId,
    file_id: line.fileId ?? line.id,
  process_type: coerceProcessType(line.selection.processType),
  material_id: line.selection.materialId ?? 'unknown',
  material_spec: line.selection.materialSpec ?? undefined,
  finish_ids: [...(line.selection.finishIds || [])],
  tolerance_class: coerceToleranceClass(line.selection.toleranceClass),
    tolerances: line.selection.tolerances ? [...line.selection.tolerances] : undefined,
    quantities,
    selected_quantity: line.selection.selectedQuantity ?? quantities[0] ?? 1,
  lead_time_option: coerceLeadTimeOption(line.selection.leadTimeOption),
    secondary_operations: [...(line.selection.secondaryOperations || [])],
  inspection_level: coerceInspectionLevel(line.selection.inspectionLevel),
  surface_finish: coerceSurfaceFinish(line.selection.surfaceFinish),
  machining_complexity: coerceMachiningComplexity(line.selection.machiningComplexity),
    sheet_thickness_mm: line.selection.sheetThicknessMm ?? undefined,
    bend_count: line.selection.bendCount ?? undefined,
    material_gauge: line.selection.materialGauge ?? undefined,
    geometry: {
      metrics: line.geometry?.metrics ? { ...line.geometry.metrics } : {},
    },
    dfm: mapDfmVNextToV1(line),
    pricing: mapPricingMatrixVNextToV1(line),
    overrides: line.overrides
      ? {
          unit_price: line.overrides.unitPrice ?? undefined,
          lead_time_days: line.overrides.leadTimeDays ?? undefined,
          margin_percent: line.overrides.marginPercent ?? undefined,
        }
      : undefined,
    audit: {
      created_at: line.audit.createdAt,
      updated_at: line.audit.updatedAt,
    },
  };
}

export function toQuoteSummaryVNext(summary: QuoteSummaryV1, extras?: {
  orgId?: string | null;
  customerId?: string | null;
  notes?: string | null;
  terms?: string | null;
}): QuoteSummaryVNext {
  const quote: ContractsVNext.QuoteSummaryVNext = {
    id: summary.id,
    orgId: extras?.orgId ?? null,
    customerId: extras?.customerId ?? null,
    status: summary.status as ContractsVNext.QuoteSummaryVNext['status'],
    totals: {
      subtotal: summary.subtotal,
      total: summary.total,
      currency: summary.currency,
    },
    notes: extras?.notes ?? null,
    terms: extras?.terms ?? null,
    lines: summary.parts.map(mapPartConfigV1ToVNext),
    meta: {
      expiresAt: summary.expires_at ?? null,
      createdAt: summary.created_at,
      updatedAt: summary.updated_at,
      acceptedAt: undefined,
      rejectedAt: undefined,
      emailSentAt: undefined,
    },
  };

  return ContractsVNext.QuoteSummarySchema.parse(quote);
}

export function toQuoteSummaryV1(quote: QuoteSummaryVNext): QuoteSummaryV1 {
  const parts = quote.lines.map(mapPartConfigVNextToV1);
  return {
    id: quote.id,
    status: quote.status as QuoteSummaryV1['status'],
    currency: quote.totals.currency ?? 'USD',
    parts,
    subtotal: quote.totals.subtotal ?? parts.reduce((acc, part) => {
      const selected = part.pricing.matrix.find((point) => point.quantity === part.selected_quantity);
      return acc + (selected?.total_price ?? 0);
    }, 0),
    total: quote.totals.total ?? quote.totals.subtotal ?? 0,
    expires_at: quote.meta.expiresAt ?? undefined,
    created_at: quote.meta.createdAt,
    updated_at: quote.meta.updatedAt,
  };
}

export function toAdminReviewItemVNext(raw: {
  id: string;
  quoteId?: string | null;
  quote_id?: string | null;
  quoteNumber?: string | null;
  quoteNo?: string | null;
  customerName?: string | null;
  company?: string | null;
  lane?: string | null;
  statusReason?: string | null;
  totalItems?: number | null;
  totalValue?: number | null;
  currency?: string | null;
  dfmFindingCount?: number | null;
  priority?: string | null;
  assignee?: string | null;
  submittedBy?: string | null;
  createdAt: string;
  lastActionAt?: string | null;
}): ContractsVNext.AdminReviewItemVNext {
  const lane = (raw.lane ?? 'NEW').toUpperCase();
  const priority = (raw.priority ?? 'MED').toUpperCase();

  return ContractsVNext.AdminReviewItemSchema.parse({
    id: raw.id,
    quoteId: raw.quoteId ?? raw.quote_id ?? raw.id,
    quoteNumber: raw.quoteNumber ?? raw.quoteNo ?? null,
    customerName: raw.customerName ?? null,
    company: raw.company ?? null,
    lane,
    statusReason: raw.statusReason ?? null,
    totalItems: raw.totalItems ?? 0,
    totalValue: raw.totalValue ?? null,
    currency: raw.currency ?? null,
    dfmFindingCount: raw.dfmFindingCount ?? null,
    priority,
    assignee: raw.assignee ?? null,
    submittedBy: raw.submittedBy ?? null,
    createdAt: raw.createdAt,
    lastActionAt: raw.lastActionAt ?? null,
  });
}

export type PricingEngineLike = {
  pricing_matrix: Array<{
    quantity: number;
    unit_price: number;
    total_price: number;
    margin_percentage?: number;
    quantity_discount?: number;
    currency: string;
    lead_time_days?: number;
    cost_factors?: Record<string, unknown>;
  }>;
  currency: string;
  lead_times?: { standard?: number; expedited?: number } | null;
  minimums?: { quantity?: number; value?: number } | null;
  tax?: {
    totalTax: number;
    jurisdiction: string;
    provider: string;
    lines: Array<{ quantity: number; taxAmount: number; taxRate: number; taxableAmount: number }>;
    metadata?: Record<string, unknown>;
  } | null;
};

export function toPricingComputationVNext(
  source: PricingEngineLike,
  origin: ContractsVNext.PricingComputationVNext['source'] = 'engine_v2',
  metadata?: Record<string, unknown>,
): ContractsVNext.PricingComputationVNext {
  const matrix = source.pricing_matrix.map((row) => ({
    quantity: row.quantity,
    unitPrice: row.unit_price,
    totalPrice: row.total_price,
    leadTimeDays: row.lead_time_days ?? null,
    marginPercentage: row.margin_percentage ?? null,
    discountPercentage: row.quantity_discount ?? null,
    currency: row.currency,
    breakdown: row.cost_factors ?? undefined,
  }));

  return ContractsVNext.PricingComputationSchema.parse({
    source: origin,
    currency: source.currency,
    matrix,
    leadTimes: source.lead_times ?? undefined,
    minimums: source.minimums ?? undefined,
    tax: source.tax ?? undefined,
    metadata,
  });
}
