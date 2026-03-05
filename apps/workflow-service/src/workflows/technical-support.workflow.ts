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
  quoteId?: string | undefined;
  email: string;
  phone: string;
  text: string;

  // Email Params
  customerName: string;
  quoteCode?: string | undefined;
};

export async function technicalSupportWorkflow(
  input: TechnicalSupportWorkflowInput,
) {
  log.info("Starting TechnicalSupportWorkflow", {
    userId: input.userId,
    quoteId: input.quoteId,
  });

  try {
    const props = {
      userId: input.userId,
      organizationId: input.organizationId,
      email: input.email,
      phone: input.phone,
      text: input.text,
      quote_id: input.quoteId,
    };

    // 1. Create Request Record
    const result = await createTechnicalRequest({ ...props });

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
