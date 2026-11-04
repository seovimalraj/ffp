import { Context, ApplicationFailure } from "@temporalio/activity";
import { RFQPartStatus, Tables } from "../constants/index.js";
import { logger } from "../lib/logger.js";
import { supabase } from "../lib/supabase.js";
import { config } from "../config.js";
import {
  getDefaultFinishForProcess,
  getDefaultMaterialForProcess,
  getDefaultThickness,
  getDefaultToleranceForProcess,
} from "../lib/default-process-utils.js";

/* ---------------------------------------------------------- */
/* types */
/* ---------------------------------------------------------- */

export type GeometryResult = {
  isAssembly?: boolean;
  recommendedProcess?: string;
  requiresManualQuote?: boolean;
  manualQuoteReason?: string;
  fallbackRequired?: boolean;
  [key: string]: any;
};

/* ---------------------------------------------------------- */
/* helpers */
/* ---------------------------------------------------------- */

async function updatePart(partId: string, values: any) {
  const { data, error } = await supabase
    .from(Tables.RFQPartsTable)
    .update(values)
    .eq("id", partId)
    .select()
    .single();

  if (error) {
    logger.error({ error, partId }, "Supabase update failed");
    throw error;
  }

  return data;
}

/**
 * The part's automatic price belonged to its old process, so a completed switch
 * clears it. Orders are blocked until the quote page calculates the new one. An
 * admin enters a manual quote's prices, so those are left for them to review.
 */
async function priceResetAfterProcessChange(partId: string) {
  const { data: part, error: partError } = await supabase
    .from(Tables.RFQPartsTable)
    .select("rfq_id")
    .eq("id", partId)
    .single();
  if (partError) throw partError;

  const { data: rfq, error: rfqError } = await supabase
    .from(Tables.RFQTable)
    .select("rfq_type")
    .eq("id", part.rfq_id)
    .single();
  if (rfqError) throw rfqError;

  return rfq.rfq_type === "manual" ? {} : { final_price: 0 };
}

async function recalculateRfqTotalForPart(partId: string) {
  const { data: part, error: partError } = await supabase
    .from(Tables.RFQPartsTable)
    .select("rfq_id")
    .eq("id", partId)
    .single();
  if (partError) throw partError;

  const { data: parts, error: partsError } = await supabase
    .from(Tables.RFQPartsTable)
    .select("final_price")
    .eq("rfq_id", part.rfq_id)
    .eq("is_archived", false);
  if (partsError) throw partsError;

  const total = parts.reduce(
    (sum: number, row: { final_price: number | null }) =>
      sum + Number(row.final_price ?? 0),
    0,
  );
  const { error } = await supabase
    .from(Tables.RFQTable)
    .update({ final_price: total })
    .eq("id", part.rfq_id);
  if (error) throw error;
}

/* ---------------------------------------------------------- */
/* activity: set processing */
/* ---------------------------------------------------------- */

export async function setPartStatusToProcessing(partId: string) {
  logger.info({ partId }, "Setting part → processing");

  // idempotent update
  const { data, error } = await supabase
    .from(Tables.RFQPartsTable)
    .update({ status: RFQPartStatus.Processing })
    .eq("id", partId)
    .in("status", ["draft", "queued"])
    .select()
    .single();

  if (error && error.code !== "PGRST116") {
    logger.error({ error, partId }, "Failed to set processing");
    throw error;
  }

  return data;
}

/* ---------------------------------------------------------- */
/* activity: analyze geometry */
/* ---------------------------------------------------------- */

export async function analyzeGeometry(
  partId: string,
  fileUrl: string,
  filename: string,
  requestedProcess?: string,
): Promise<GeometryResult> {
  const ctx = Context.current();

  logger.info({ partId, filename }, "Starting CAD geometry analysis");

  // ensure worker keeps heartbeating during long external calls
  const heartbeatInterval = setInterval(() => {
    ctx.heartbeat({ partId, stage: "cad-analysis-running" });
  }, 20000);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 min

  try {
    await updatePart(partId, { status: RFQPartStatus.Processing });

    let geometry: GeometryResult | null = null;

    /* ---------------- primary CAD service ---------------- */

    try {
      const res = await fetch(
        `${config.frontendUrl}/api/cad/analyze-geometry`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileUrl,
            fileName: filename,
            requestedProcess,
          }),
          signal: controller.signal,
        },
      );

      if (res.ok) {
        geometry = await res.json();
      } else {
        const text = await res.text();
        logger.warn({ partId, text }, "Primary CAD analysis failed");
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw ApplicationFailure.retryable("CAD analysis timeout");
      }
      logger.warn({ err, partId }, "Primary CAD analysis error");
    }

    /* ---------------- fallback CAD service ---------------- */

    // The fallback can't analyze for a chosen process, and would turn an outage
    // into a manual quote. Retrying, then restoring the part, is the right result.
    if (!geometry && requestedProcess) {
      throw ApplicationFailure.retryable("CAD analysis failed for process change");
    }

    if (!geometry) {
      logger.info({ partId }, "Attempting fallback CAD analysis");

      const res = await fetch(
        `${config.frontendUrl}/api/cad/manual-cad-analysis`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileUrl, fileName: filename }),
          signal: controller.signal,
        },
      );

      if (!res.ok) {
        const text = await res.text();
        logger.error({ partId, text }, "Fallback CAD API failed");
        throw ApplicationFailure.retryable("Fallback CAD analysis failed");
      }

      geometry = await res.json();
    }

    if (!geometry) {
      throw ApplicationFailure.nonRetryable("Empty geometry result");
    }

    /* ---------------- assembly detection ---------------- */

    if (geometry.isAssembly) {
      geometry.requiresManualQuote = true;
      geometry.manualQuoteReason =
        geometry.manualQuoteReason ||
        "Assembly detected — manual review required";
    }

    logger.info({ partId }, "CAD analysis completed");

    return geometry;
  } finally {
    clearTimeout(timeout);
    clearInterval(heartbeatInterval);
  }
}
/* ---------------------------------------------------------- */
/* activity: save geometry */
/* ---------------------------------------------------------- */

export async function saveGeometryAndMarkProcessed(
  partId: string,
  geometry: GeometryResult,
  requestedProcess?: string,
) {
  logger.info({ partId }, "Saving geometry and marking as processed");

  const processMap: Record<string, string> = {
    "sheet-metal": "sheet-metal",
    "cnc-milling": "cnc-milling",
    "cnc-turning": "cnc-turning",
    "injection-molding": "injection-molding",
    "manual-quote": "manual-quote",
  };

  const detectedProcess =
    requestedProcess ??
    (geometry?.recommendedProcess
      ? processMap[geometry.recommendedProcess] || "cnc-milling"
      : "cnc-milling");

  // Sheet metal: analysis picks the stock gauge closest to the detected thickness
  const defaultMaterial =
    geometry?.recommendedMaterial ??
    getDefaultMaterialForProcess(detectedProcess);
  const defaultFinish = getDefaultFinishForProcess(detectedProcess);
  const defaultTolerance = getDefaultToleranceForProcess(detectedProcess);
  const defaultThicknessMm = detectedProcess?.includes("sheet")
    ? geometry?.recommendedThicknessMm ??
      (parseFloat(getDefaultThickness()) || 2.0)
    : undefined;

  const priceReset = requestedProcess
    ? await priceResetAfterProcessChange(partId)
    : {};

  const updated = await updatePart(partId, {
    ...priceReset,
    geometry,
    material: defaultMaterial,
    tolerance: defaultTolerance,
    finish: defaultFinish,
    // A switch away from sheet metal must clear the old thickness
    sheet_thickness_mm: defaultThicknessMm ?? (requestedProcess ? null : undefined),
    process: detectedProcess,
    status: RFQPartStatus.Processed,
  });

  if (requestedProcess) await recalculateRfqTotalForPart(partId);

  return updated;
}

/* ---------------------------------------------------------- */
/* activity: mark manual quote */
/* ---------------------------------------------------------- */

export async function markManualQuote(
  partId: string,
  geometry?: GeometryResult,
) {
  logger.info({ partId }, "Marking manual quote");

  // Geometry is only passed for a switched part, whose old price no longer applies
  const priceReset = geometry ? await priceResetAfterProcessChange(partId) : {};

  const updated = await updatePart(partId, {
    ...priceReset,
    process: "manual-quote",
    status: "processed",
    ...(geometry && { geometry }),
  });

  if (geometry) await recalculateRfqTotalForPart(partId);

  return updated;
}

/* ---------------------------------------------------------- */
/* activity: restore part after a failed process change */
/* ---------------------------------------------------------- */

export async function restorePartAfterFailedProcessChange(partId: string) {
  logger.warn({ partId }, "Process change failed, restoring part");

  return updatePart(partId, { status: RFQPartStatus.Processed });
}
