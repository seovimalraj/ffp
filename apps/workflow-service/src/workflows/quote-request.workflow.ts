import {
  proxyActivities,
  defineSignal,
  setHandler,
  condition,
  log,
} from "@temporalio/workflow";
import type * as activities from "../activities/quote-request.activities.js";

const {
  sendQuoteRequestedEmailActivity,
  sendQuoteResponseToAdminActivity,
  sendOrderAssignedEmailToSupplierActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minute",
  retry: {
    initialInterval: "5s",
    maximumAttempts: 3,
  },
});

export const quoteResponseSignal =
  defineSignal<[{ status: "accepted" | "declined" }]>("quoteResponse");

/**
 * Workflow to handle the lifecycle of a quote request email notifications.
 * Triggered when a quote request is created by an admin.
 */
export async function quoteRequestWorkflow(quoteRequestId: string) {
  log.info("Starting quoteRequestWorkflow", { quoteRequestId });

  // 1. Initial notification to supplier
  await sendQuoteRequestedEmailActivity(quoteRequestId);

  let responseStatus: "accepted" | "declined" | null = null;

  // Listen for the supplier's response signal
  setHandler(quoteResponseSignal, (payload) => {
    responseStatus = payload.status;
  });

  // 2. Wait for supplier response signal (sent from API upon status update)
  // We don't use a timeout here as the supplier can take any amount of time
  await condition(() => responseStatus !== null);

  log.info("Received quote response signal", { quoteRequestId, responseStatus });

  // 3. Notify Admin about the response (accepted/declined)
  await sendQuoteResponseToAdminActivity(quoteRequestId);

  // 4. If accepted by supplier, notify them that the order is assigned
  if (responseStatus === "accepted") {
    await sendOrderAssignedEmailToSupplierActivity(quoteRequestId);
  }

  log.info("Completed quoteRequestWorkflow", { quoteRequestId });
}
