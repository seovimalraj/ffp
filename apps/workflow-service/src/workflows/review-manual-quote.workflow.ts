import { proxyActivities, log } from "@temporalio/workflow";
import type * as activities from "../activities/review-manual-quote.activities.js";

const { getUser, sendNotficationMailForManualQuoteReview } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: "1 minute",
  retry: {
    initialInterval: "5s",
    maximumAttempts: 3,
  },
});

export async function reviewManualQuoteWorkflow(data: {
  userId: string;
  quoteId: string;
}): Promise<void> {
  log.info("Starting reviewManualQuoteWorkflow", {
    userId: data.userId,
    quoteId: data.quoteId,
  });

  // Step 1: Fetch user details
  // We need the name and email for the notification
  const user = await getUser(data.userId, "email, name");

  if (!user || !user.email) {
    log.error("User not found or email missing", { userId: data.userId });
    throw new Error(`Cannot notify user ${data.userId}: Email missing`);
  }

  log.info("Sending notification email", {
    email: user.email,
    quoteId: data.quoteId,
  });

  // Step 2: Send the notification email
  await sendNotficationMailForManualQuoteReview(
    user.email,
    data.quoteId,
    user.name || "Customer",
  );

  log.info("reviewManualQuoteWorkflow completed successfully", {
    quoteId: data.quoteId,
  });
}
