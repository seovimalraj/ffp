import { inngest } from "../client.js";
import { logger } from "../lib/logger.js";
import { sendEmail } from "../lib/email.js";

export const processQuoteCreated = inngest.createFunction(
  { id: "process-quote-created" },
  { event: "rfq/quote.created" },
  async ({ event, step }) => {
    const { quoteId, userId, data } = event.data;

    logger.info({ quoteId, userId }, "Processing quote creation");

    // Step 1: Validate quote data
    await step.run("validate-quote", async () => {
      logger.info({ quoteId }, "Validating quote data");
      // Add validation logic here
      return { validated: true };
    });

    // Step 2: Send notification email
    await step.run("send-notification", async () => {
      logger.info({ quoteId }, "Sending notification email");

      const emailTo = data?.email || "[EMAIL_ADDRESS]"; // Fallback for testing

      return await sendEmail({
        to: emailTo,
        subject: `New Quote Created: ${quoteId}`,
        text: `Hello, your quote ${quoteId} has been successfully created and is being processed.`,
        html: `<h1>Quote Created</h1><p>Hello, your quote <strong>${quoteId}</strong> has been successfully created and is being processed.</p>`,
      });
    });

    // Step 3: Update analytics
    await step.run("update-analytics", async () => {
      logger.info({ quoteId }, "Updating analytics");
      // Add analytics logic here
      return { analyticsUpdated: true };
    });

    logger.info({ quoteId }, "Quote processing completed");

    return {
      success: true,
      quoteId,
      processedAt: new Date().toISOString(),
    };
  },
);
