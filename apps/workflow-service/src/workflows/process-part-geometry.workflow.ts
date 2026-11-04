import { proxyActivities, ApplicationFailure } from "@temporalio/workflow";
import type * as activities from "../activities/process-part-geometry.activities.js";

const {
  analyzeGeometry,
  saveGeometryAndMarkProcessed,
  markManualQuote,
  restorePartAfterFailedProcessChange,
} = proxyActivities<typeof activities>({
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
  /** Set when a user switched an existing part to this process. */
  requestedProcess?: string;
};

export async function cadProcessingWorkflow(input: CADWorkflowInput) {
  const { partId, fileUrl, filename, requestedProcess } = input;

  try {
    // 1. analyze (now includes status update inside the activity slot)
    let geometry = await analyzeGeometry(
      partId,
      fileUrl,
      filename,
      requestedProcess,
    );

    // manual quote path
    if (geometry.requiresManualQuote) {
      // A switched part keeps this analysis, so the UI can explain the outcome
      await markManualQuote(partId, requestedProcess ? geometry : undefined);
      return;
    }

    // 3. persist geometry & mark processed
    await saveGeometryAndMarkProcessed(partId, geometry, requestedProcess);
  } catch (err: any) {
    // A failed switch leaves the part on its previous process and geometry,
    // which are only overwritten on success
    if (requestedProcess) {
      await restorePartAfterFailedProcessChange(partId);
      return;
    }

    // non-retryable (an activity's failure arrives wrapped, with the cause inside)
    const failure = err?.cause ?? err;
    if (failure instanceof ApplicationFailure && failure.nonRetryable) {
      await markManualQuote(partId);
      return;
    }

    // let Temporal retry
    throw err;
  }
}
