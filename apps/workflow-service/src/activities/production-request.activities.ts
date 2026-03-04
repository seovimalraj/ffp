import { Tables } from "../constants/index.js";
import { sendEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";
import { renderEmail } from "../lib/render-email.js";
import { supabase } from "../lib/supabase.js";
import { ProductionRequestAdminTemplate } from "../constants/email-templates/production-request-admin.template.js";
import { ProductionRequestUserTemplate } from "../constants/email-templates/production-request-user.template.js";

export type SendProductionRequestEmailsParams = {
  requestCode: string;
  customerEmail: string;
  customerName: string;
  projectName: string;
  projectDescription: string;
  services: string[];
};

/**
 * Sends notification emails for a production request:
 * 1. Admin/Verifier gets project details
 * 2. Customer gets an acknowledgement
 */
export async function sendProductionRequestEmails(
  props: SendProductionRequestEmailsParams,
) {
  try {
    // 1. Fetch Admin/Verifier Email
    const { data: configData, error: configError } = await supabase
      .from(Tables.SystemConfig)
      .select("value")
      .eq("key", "verifier_email_multi")
      .single();

    if (configError || !configData?.value) {
      logger.error(
        { configError },
        "Failed to fetch verifier_email_multi from system_config",
      );
      throw configError || new Error("Config verifier_email_multi not found");
    }

    let adminEmails: string[] = [];
    try {
      adminEmails = JSON.parse(configData.value);
      if (!Array.isArray(adminEmails)) adminEmails = [configData.value];
    } catch (_e) {
      adminEmails = [configData.value];
    }

    // 2. Send Notification to Admins
    const adminMjml = ProductionRequestAdminTemplate(
      props.customerName,
      props.customerEmail,
      props.projectName,
      props.projectDescription,
      props.services,
      props.requestCode,
    );
    const adminHtml = renderEmail(adminMjml);

    await Promise.all(
      adminEmails.map((email) =>
        sendEmail({
          to: email,
          subject: `New Production Request: ${props.projectName} (#${props.requestCode})`,
          html: adminHtml,
        }).catch((err) => {
          // Log error but don't stop the activity
          logger.error(
            { email, err },
            "Failed to send production notification to admin",
          );
        }),
      ),
    );

    // 3. Send Acknowledgement to Customer
    const userMjml = ProductionRequestUserTemplate(
      props.requestCode,
      props.projectName,
    );
    const userHtml = renderEmail(userMjml);

    await sendEmail({
      to: props.customerEmail,
      subject: "Production Request Received",
      html: userHtml,
    });

    logger.info(
      { requestCode: props.requestCode },
      "Production request emails sent successfully",
    );
  } catch (error) {
    logger.error({ error }, "Error in sendProductionRequestEmails activity");
    throw error;
  }
}
