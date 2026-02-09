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
 * Generic workflow to send an email.
 * Replaces the Inngest system/email.send function.
 */
export async function sendEmailWorkflow(
  details: SendEmailDetails,
): Promise<void> {
  await sendEmailActivity(details);
}
