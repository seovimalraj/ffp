import { inngest } from "../client.js";
import { logger } from "../lib/logger.js";
import { sendEmail } from "../lib/email.js";
import { supabase } from "../lib/supabase.js";
import { RFQStatuses, Tables } from "../constants/index.js";

// DX Metadata
type _ManualQuoteApprovalEvent = {
  name: "rfq/manual-quote.approval";
  data: {
    quoteId: string;
    userId: string;
  };
};

// Workflow Steps
enum Steps {
  FetchUser = "fetch-user",
  UpdateRFQStatus = "update-rfq-status",
  SendNotificationEmail = "send-notification-email",
}

// Workflow
export const sendManualQuoteApproval = inngest.createFunction(
  {
    id: "send-manual-quote-approval",
    // Retries the whole function up to 5 times if a step fails
    retries: 5,
  },
  { event: "rfq/manual-quote.approval" },
  async ({ event, step }) => {
    const { quoteId, userId } = event.data;

    // --- STEP 1: FETCH USER EMAIL ---
    // We return only the email string to keep the step state small and clean
    const userEmail = await step.run(Steps.FetchUser, async () => {
      const { data, error } = await supabase
        .from(Tables.UserTable)
        .select("email")
        .eq("id", userId)
        .single();

      if (error || !data?.email) {
        logger.error({ error, userId }, "User email lookup failed");
        // Check if we have a hardcoded fallback, otherwise fail to trigger retry
        if (process.env.VERIFIER_EMAIL) return process.env.VERIFIER_EMAIL;
        throw new Error(
          error?.message || "User email not found and no fallback available",
        );
      }

      return data.email;
    });

    // --- STEP 2: UPDATE RFQ STATUS ---
    const updateResult = await step.run(Steps.UpdateRFQStatus, async () => {
      const { data, error } = await supabase
        .from(Tables.RFQTable)
        .update({ status: RFQStatuses.PendingApproval })
        .eq("id", quoteId)
        .eq("status", RFQStatuses.UnderReview) // Ensures we only update if it's in the right state
        .select("id")
        .single();

      if (error) {
        // If the error is 'PGRST116' (no rows returned), it might already be updated
        if (error.code === "PGRST116") {
          logger.info({ quoteId }, "RFQ already updated; skipping update step");
          return { success: false, reason: "already_updated" };
        }
        throw error;
      }

      return { success: true, id: data.id };
    });

    // --- STEP 3: SEND NOTIFICATION EMAIL ---
    await step.run(Steps.SendNotificationEmail, async () => {
      // Logic: Only send if the update was successful OR if it was already updated
      // If we want to prevent double-emailing on retries, Inngest's step-memoization
      // handles that automatically!

      const dashboardUrl = `${process.env.FRONTEND_URL}/portal/quotes/${quoteId}`;

      await sendEmail({
        to: userEmail,
        subject: "Your updated quote is ready",
        text: `Your quote has been reviewed. View it here: ${dashboardUrl}`,
        html: `
          <div style="font-family: sans-serif; line-height: 1.5;">
            <p>Your quote has been reviewed and pricing has been updated.</p>
            <p>
              <a href="${dashboardUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Click here to view your quote
              </a>
            </p>
            <p>Please verify and continue the process.</p>
          </div>
        `,
      });

      logger.info(
        { quoteId, recipient: userEmail },
        "Quote approval email sent",
      );
    });

    return { status: "completed", quoteId };
  },
);
