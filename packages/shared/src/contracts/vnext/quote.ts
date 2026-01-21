import { z } from 'zod';

export const QuoteLifecycleStatusVNextSchema = z.enum([
  'draft',
  'processing',
  'ready',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'cancelled',
  'converted',
]);

export const PricingBreakdownEntryVNextSchema = z.object({
  quantity: z.number(),
  unitPrice: z.number().nullable().optional(),
  totalPrice: z.number().nullable().optional(),
  leadTimeDays: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  status: z.enum(['pending', 'ready', 'review_required']).optional(),
  breakdown: z.record(z.string(), z.unknown()).optional(),
});

export const QuoteLinePricingVNextSchema = z.object({
  status: z
    .enum(['pending', 'ready', 'review_required', 'failed'])
    .nullable()
    .optional(),
  currency: z.string().nullable().optional(),
  matrix: z.array(PricingBreakdownEntryVNextSchema),
});

export const QuoteLineDfmIssueVNextSchema = z.object({
  id: z.string(),
  severity: z.enum(['info', 'warn', 'critical']).optional(),
  category: z.string().optional(),
  message: z.string(),
  recommendation: z.string().optional(),
  refs: z.record(z.string(), z.unknown()).optional(),
});

export const QuoteLineDfmVNextSchema = z.object({
  status: z.enum(['pending', 'processing', 'complete', 'failed']).nullable().optional(),
  issues: z.array(QuoteLineDfmIssueVNextSchema).default([]),
});

export const QuoteLineAuditVNextSchema = z.object({
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const QuoteLineSelectionVNextSchema = z.object({
  processType: z.string().nullable().optional(),
  materialId: z.string().nullable().optional(),
  materialSpec: z.string().nullable().optional(),
  finishIds: z.array(z.string()).default([]),
  toleranceClass: z.string().nullable().optional(),
  tolerances: z.array(z.string()).optional(),
  inspectionLevel: z.string().nullable().optional(),
  leadTimeOption: z.string().nullable().optional(),
  secondaryOperations: z.array(z.string()).default([]),
  surfaceFinish: z.string().nullable().optional(),
  machiningComplexity: z.string().nullable().optional(),
  selectedQuantity: z.number().nullable().optional(),
  quantities: z.array(z.number()).default([]),
  // Sheet metal specific fields
  sheetThicknessMm: z.number().nullable().optional(),
  bendCount: z.number().nullable().optional(),
  materialGauge: z.string().nullable().optional(),
});

export const QuoteLineGeometryVNextSchema = z.object({
  metrics: z.record(z.string(), z.unknown()).optional(),
}).partial();

export const QuoteLineOverridesVNextSchema = z.object({
  unitPrice: z.number().nullable().optional(),
  leadTimeDays: z.number().nullable().optional(),
  marginPercent: z.number().nullable().optional(),
});

export const QuoteLineVNextSchema = z.object({
  id: z.string(),
  quoteId: z.string(),
  fileId: z.string().nullable().optional(),
  selection: QuoteLineSelectionVNextSchema,
  pricing: QuoteLinePricingVNextSchema,
  dfm: QuoteLineDfmVNextSchema,
  geometry: QuoteLineGeometryVNextSchema.optional(),
  overrides: QuoteLineOverridesVNextSchema.optional(),
  audit: QuoteLineAuditVNextSchema,
});

export const QuoteTotalsVNextSchema = z.object({
  subtotal: z.number().nullable().optional(),
  total: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
});

export const QuoteMetaVNextSchema = z.object({
  expiresAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  acceptedAt: z.string().nullable().optional(),
  rejectedAt: z.string().nullable().optional(),
  emailSentAt: z.string().nullable().optional(),
});

export const QuoteSummaryVNextSchema = z.object({
  id: z.string(),
  orgId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  status: QuoteLifecycleStatusVNextSchema,
  totals: QuoteTotalsVNextSchema,
  notes: z.string().nullable().optional(),
  terms: z.string().nullable().optional(),
  lines: z.array(QuoteLineVNextSchema),
  meta: QuoteMetaVNextSchema,
});

export type QuoteLifecycleStatusVNext = z.infer<typeof QuoteLifecycleStatusVNextSchema>;
export type QuoteLineVNext = z.infer<typeof QuoteLineVNextSchema>;
export type QuoteSummaryVNext = z.infer<typeof QuoteSummaryVNextSchema>;
