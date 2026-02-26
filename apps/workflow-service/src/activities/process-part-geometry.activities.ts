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
): Promise<GeometryResult> {
  const ctx = Context.current();
  ctx.heartbeat("starting-cad-analysis");

  logger.info({ partId, filename }, "Analyzing CAD geometry");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  let geometry: GeometryResult | null = null;

  try {
    const res = await fetch(`${config.frontendUrl}/api/cad/analyze-geometry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileUrl, fileName: filename }),
      signal: controller.signal,
    });

    if (res.ok) {
      geometry = await res.json();
    } else {
      const text = await res.text();
      logger.warn({ partId, text }, "CAD API failed, attempting fallback");
    }
  } catch (err: any) {
    if (err.name === "AbortError") {
      clearTimeout(timeout);
      logger.error({ partId }, "CAD timeout");
      throw err;
    }
    logger.warn({ err, partId }, "CAD analysis failed, attempting fallback");
  }

  // fallback to manual-cad-analysis if primary fails
  if (!geometry) {
    ctx.heartbeat("starting-fallback-cad-analysis");
    try {
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

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        logger.error({ partId, text }, "Fallback CAD API failed");
        throw new Error(`Fallback CAD API error: ${res.status}`);
      }

      geometry = await res.json();
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        logger.error({ partId }, "Fallback CAD timeout");
        throw err;
      }
      logger.error({ err, partId }, "Fallback CAD analysis failed");
      throw err;
    }
  }

  clearTimeout(timeout);
  ctx.heartbeat("cad-analysis-complete");

  if (!geometry) {
    throw ApplicationFailure.nonRetryable("Empty geometry result");
  }

  // assembly detection → manual quote
  if (geometry.isAssembly) {
    geometry.requiresManualQuote = true;
    geometry.manualQuoteReason =
      geometry.manualQuoteReason ||
      "Assembly detected — manual review required";
  }

  return geometry;
}

/* ---------------------------------------------------------- */
/* activity: save geometry */
/* ---------------------------------------------------------- */

export async function saveGeometry(partId: string, geometry: GeometryResult) {
  logger.info({ partId }, "Saving geometry");

  if (geometry?.isAssembly && geometry.recommendedProcess !== "manual-quote") {
    geometry.recommendedProcess = "manual-quote";
    geometry.requiresManualQuote = true;
    geometry.manualQuoteReason =
      geometry.manualQuoteReason ||
      "Assembly detected — multiple bodies require manual review";
  }

  const processMap: Record<string, string> = {
    "sheet-metal": "sheet-metal",
    "cnc-milling": "cnc-milling",
    "cnc-turning": "cnc-turning",
    "injection-molding": "injection-molding",
    "manual-quote": "manual-quote",
  };

  const detectedProcess = geometry?.recommendedProcess
    ? processMap[geometry.recommendedProcess] || "cnc-milling"
    : "cnc-milling";

  // 4. Get process-specific defaults
  const defaultMaterial = getDefaultMaterialForProcess(detectedProcess);
  const defaultFinish = getDefaultFinishForProcess(detectedProcess);
  const defaultTolerance = getDefaultToleranceForProcess(detectedProcess);
  const defaultThicknessMm = detectedProcess?.includes("sheet")
    ? parseFloat(getDefaultThickness()) || 2.0
    : undefined;

  return updatePart(partId, {
    geometry,
    material: defaultMaterial,
    tolerance: defaultTolerance,
    finish: defaultFinish,
    sheet_thickness_mm: defaultThicknessMm,
    process: detectedProcess,
  });
}

/* ---------------------------------------------------------- */
/* activity: mark manual quote */
/* ---------------------------------------------------------- */

export async function markManualQuote(partId: string, reason: string) {
  logger.info({ partId, reason }, "Marking manual quote");

  return updatePart(partId, {
    manual_quote_reason: reason,
  });
}

/* ---------------------------------------------------------- */
/* activity: mark processed */
/* ---------------------------------------------------------- */

export async function setPartStatusToProcessed(partId: string) {
  logger.info({ partId }, "Setting part → processed");

  const { data, error } = await supabase
    .from(Tables.RFQPartsTable)
    .update({ status: RFQPartStatus.Processed })
    .eq("id", partId)
    .eq("status", RFQPartStatus.Processing)
    .select()
    .single();

  if (error && error.code !== "PGRST116") {
    logger.error({ error, partId }, "Failed to set processed");
    throw error;
  }

  return data;
}
