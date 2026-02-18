import { proxyActivities, log } from "@temporalio/workflow";
import type * as activities from "../activities/technical-support.activites.js";

const { createTechnicalRequest, sendTechnicalSupportEmails } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: "1 minute",
  retry: {
    initialInterval: "5s",
    maximumAttempts: 3,
  },
});

export type TechnicalSupportWorkflowInput = {
  // DB Creation Params
  userId: string;
  organizationId: string;
  quoteId: string;
  email: string;
  phone: string;
  text: string;

  // Email Params
  customerName: string;
  quoteCode: string;
};

export async function technicalSupportWorkflow(
  input: TechnicalSupportWorkflowInput,
) {
  log.info("Starting TechnicalSupportWorkflow", {
    userId: input.userId,
    quoteId: input.quoteId,
  });

  try {
    // 1. Create Request Record
    const result = await createTechnicalRequest({
      userId: input.userId,
      organizationId: input.organizationId,
      quote_id: input.quoteId,
      email: input.email,
      phone: input.phone,
      text: input.text,
    });

    if (!result || !result[0]) {
      throw new Error("Failed to create technical request record");
    }

    const techRequest = result[0];
    const techRequestCode = techRequest.code; // Generated Code fri_ts_...

    // 2. Send Emails
    await sendTechnicalSupportEmails({
      requestCode: techRequestCode,
      customerEmail: input.email,
      customerName: input.customerName,
      customerPhone: input.phone,
      quoteId: input.quoteId,
      quoteCode: input.quoteCode,
    });

    log.info("TechnicalSupportWorkflow completed successfully", {
      requestCode: techRequestCode,
    });

    return {
      success: true,
      requestCode: techRequestCode,
    };
  } catch (err: any) {
    log.error("TechnicalSupportWorkflow failed", { error: err.message });
    throw err;
  }
}
