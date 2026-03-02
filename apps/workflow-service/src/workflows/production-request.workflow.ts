import { proxyActivities, log } from "@temporalio/workflow";
import type * as activities from "../activities/production-request.activities.js";

const { sendProductionRequestEmails } = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 minute",
  retry: {
    initialInterval: "5s",
    maximumAttempts: 3,
  },
});

export type ProductionRequestWorkflowInput = {
  requestCode: string;
  customerEmail: string;
  customerName: string;
  projectName: string;
  projectDescription: string;
  services: string[];
};

export async function productionRequestWorkflow(
  input: ProductionRequestWorkflowInput,
) {
  log.info("Starting ProductionRequestWorkflow", {
    requestCode: input.requestCode,
    projectName: input.projectName,
  });

  try {
    // Send emails to admin and customer
    await sendProductionRequestEmails({
      requestCode: input.requestCode,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      projectName: input.projectName,
      projectDescription: input.projectDescription,
      services: input.services,
    });

    log.info("ProductionRequestWorkflow completed successfully", {
      requestCode: input.requestCode,
    });

    return {
      success: true,
      requestCode: input.requestCode,
    };
  } catch (err: any) {
    log.error("ProductionRequestWorkflow failed", { error: err.message });
    throw err;
  }
}
