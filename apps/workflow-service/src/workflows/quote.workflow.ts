import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/email.activities.js";
import type { SendEmailDetails } from "../lib/email.js";

// Define the activities proxy with timeout and retry policies
const { sendEmailActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 minute",
  retry: {
    initialInterval: "5s",
    maximumAttempts: 3,
  },
});

/**
 * Workflow that handles the sequence of actions when a quote is created.
 * This is triggered by the NestJS API.
 */
export async function quoteCreatedWorkflow(data: {
  email: string;
  name: string;
  quoteId: string;
}): Promise<void> {
  // 1. Send the welcome/notification email
  const emailDetails: SendEmailDetails = {
    to: data.email,
    subject: `Quote #${data.quoteId} Received`,
    type: "welcome",
    name: data.name,
  };

  await sendEmailActivity(emailDetails);

  // You can add more steps here, like:
  // await updateDatabaseActivity(data.quoteId);
}
