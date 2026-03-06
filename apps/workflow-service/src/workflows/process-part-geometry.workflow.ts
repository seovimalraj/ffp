import { proxyActivities, ApplicationFailure } from "@temporalio/workflow";
import type * as activities from "../activities/process-part-geometry.activities.js";

const { analyzeGeometry, saveGeometryAndMarkProcessed, markManualQuote } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: "20 minutes",
    heartbeatTimeout: "1 minute",
    retry: {
      maximumAttempts: 5,
      initialInterval: "10 seconds",
      maximumInterval: "5 minutes",
      backoffCoefficient: 2,
    },
  });

export type CADWorkflowInput = {
  partId: string;
  fileUrl: string;
  filename: string;
};

export async function cadProcessingWorkflow(input: CADWorkflowInput) {
  const { partId, fileUrl, filename } = input;

  try {
    // 1. analyze (now includes status update inside the activity slot)
    let geometry = await analyzeGeometry(partId, fileUrl, filename);

    // manual quote path
    if (geometry.requiresManualQuote) {
      await markManualQuote(partId);
      return;
    }

    // 3. persist geometry & mark processed
    await saveGeometryAndMarkProcessed(partId, geometry);
  } catch (err: any) {
    // non-retryable
    if (err instanceof ApplicationFailure && err.nonRetryable) {
      await markManualQuote(partId);
      return;
    }

    // let Temporal retry
    throw err;
  }
}
