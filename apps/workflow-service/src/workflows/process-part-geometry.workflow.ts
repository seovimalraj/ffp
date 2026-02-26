import { proxyActivities, ApplicationFailure } from "@temporalio/workflow";
import type * as activities from "../activities/process-part-geometry.activities.js";

const {
  setPartStatusToProcessing,
  analyzeGeometry,
  saveGeometry,
  markManualQuote,
  setPartStatusToProcessed,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 minutes",
  heartbeatTimeout: "30 seconds",
  retry: {
    maximumAttempts: 5,
    initialInterval: "5 seconds",
    maximumInterval: "2 minutes",
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
    // 1. mark processing
    await setPartStatusToProcessing(partId);

    // 2. analyze
    let geometry = await analyzeGeometry(partId, fileUrl, filename);

    // manual quote path
    if (geometry.requiresManualQuote) {
      await markManualQuote(
        partId,
        geometry.manualQuoteReason || "Manual review required",
      );
      return;
    }

    // if (geometry.\)

    // 3. persist geometry
    await saveGeometry(partId, geometry);

    // 4. mark processed
    await setPartStatusToProcessed(partId);
  } catch (err: any) {
    // non-retryable
    if (err instanceof ApplicationFailure && err.nonRetryable) {
      await markManualQuote(partId, err.message);
      return;
    }

    // let Temporal retry
    throw err;
  }
}
