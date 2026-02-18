/**
 * @ownership contracts-team
 * @raci docs/governance/raci-matrix.yaml
 */
export * from "./admin-types"; // AdminUser, AdminOrg, Paginated
export * from "./admin-pricing.types";
export * from "./admin-pricing.digest";
export * from "./hash.util";
// Re-export everything from types.core.ts
export * from "./types.core";

// Re-export DFM types
export * from "./dfm.types";
export * from "./dfm-result.types";

// Re-export pricing types
export * from "./pricing.types";
// Re-export cost model types (Phase 1)
export * from "./cost-model.types";
// Explicit cost factor & detailed breakdown contracts (v1)
export type {
  CostFactorsV1,
  PricingBreakdownDetailedV1,
} from "./contracts/v1/pricing";
// Pricing compute utility
export { computePricingBreakdown } from "./pricing.compute";
// Catalog domain (materials, finishes, processes, machines, preview request/response)
export * from "./catalog.types";
export { CATALOG_SNAPSHOT } from "./catalog.data";
export { computeFinishCostPerPart } from "./finish-cost.util";
export { applyRiskMargin } from "./risk.util";
export * from "./rbac.types";
export { buildDiff } from "./diff.util";
export type { DiffResult } from "./diff.util";
export * from "./process-recommendation.types";
export * from "./leadtime.types";
export * from "./ai/redaction";
export * from "./ai/prompt-registry";
export * from "./contants";
export * from "./disposable-email";
export * from "./file-validation";
export * from "./ai/model-registry";
export * from "./ai/prompts/pricing-rationale";
export {
  ADMIN_PRICING_REVISION_SYSTEM_PROMPT,
  ADMIN_PRICING_REVISION_USER_PROMPT,
  renderAdminPricingRevisionSystemPrompt,
  renderAdminPricingRevisionUserPrompt,
} from "./ai/prompts/admin-pricing-revision";
export type {
  AdminPricingRevisionSystemContext,
  AdminPricingRevisionUserContext,
} from "./ai/prompts/admin-pricing-revision";
export type { AdminPricingConfig as AdminPricingRevisionPromptConfig } from "./ai/prompts/admin-pricing-revision";
export * from "./ai/model-lifecycle.types";

// Re-export order lifecycle types
export * from "./orders/order-status";

// Re-export marketplace types (Step 17)
export * from "./marketplace";

// Versioned contract exports
export {
  ContractsV1,
  ContractsVNext,
  computeQuoteDiffSummaryV1,
  QUOTE_RATIONALE_CACHE_PREFIX_V1,
  buildQuoteRationaleCacheKeyV1,
  QUOTE_RATIONALE_CACHE_TTL_SECONDS,
  buildQuoteRationaleRevisionCacheKeyV1,
} from "./contracts";
export type { PartConfigV1 } from "./contracts/v1/part-config";
export {
  toQuoteSummaryV1,
  toQuoteSummaryVNext,
  toAdminReviewItemVNext,
  toPricingComputationVNext,
} from "./contracts/mappers";
