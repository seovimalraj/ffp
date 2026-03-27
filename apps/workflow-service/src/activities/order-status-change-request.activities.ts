import { OrderStatusSupplierRequestTemplate } from "../constants/email-templates/order-status-supplier-request.template.js";
import {
  ApproveOrderStatusChangeTemplate,
  RejectOrderStatusChangeTemplate,
  OrderStatusReminderTemplate,
} from "../constants/email-templates/index.js";
import { Tables } from "../constants/index.js";
import { sendEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";
import { renderEmail } from "../lib/render-email.js";
import { supabase } from "../lib/supabase.js";
import type { OrderStatusChangeRequest } from "../workflows/order-status-change-request.workflow.js";

export async function fetchRequestData(requestId: string) {
  try {
    const { data: orscData, error: orscError } = await supabase
      .from(Tables.OrderStatusChangeRequests)
      .select(
        `
        *,
        order_parts(
        id, 
        rfq_parts (
          snapshot_2d_url
        )
        )
        `,
      )
      .eq("id", requestId)
      .single();

    if (orscError) {
      throw orscError;
    }
    return orscData;
  } catch (error) {
    logger.error({ error }, "Failed to get OrderStatusChangeRequest");
    throw error;
  }
}

export async function sendVerifiersOSCR(requestData: OrderStatusChangeRequest) {
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

    const adminMjml = OrderStatusSupplierRequestTemplate(
      requestData.status_from,
      requestData.status_to,
      requestData.order_id,
      requestData.order_parts?.rfq_parts?.snapshot_2d_url,
    );

    const adminHtml = renderEmail(adminMjml);

    await Promise.all(
      adminEmails.map((email) =>
        sendEmail({
          to: email,
          subject: `Order Status change was requested by supplier`,
          html: adminHtml,
          attachments: (requestData.attachments || []).map((url) => ({
            filename: url.split("/").pop() || "attachment",
            path: url,
          })),
        }).catch((err) => {
          // Log error but don't stop the activity
          logger.error(
            { email, err },
            "Failed to send production notification to admin",
          );
        }),
      ),
    );
  } catch (error) {
    logger.error({ error }, "Error while sending emails to verifiers");
    throw error;
  }
}

export async function sendApprove(
  requestData: OrderStatusChangeRequest,
  supplierEmail: string,
) {
  try {
    const mjml = ApproveOrderStatusChangeTemplate(
      requestData.order_id,
      requestData.order_parts?.rfq_parts?.snapshot_2d_url || "",
    );

    const html = renderEmail(mjml);

    await sendEmail({
      to: supplierEmail,
      subject: `Part Status Change Approved - Order: ${requestData.order_id}`,
      html,
    });
  } catch (error) {
    logger.error(
      { error, requestId: requestData.id },
      "Failed to send approval email",
    );
    throw error;
  }
}

export async function sendReject(
  requestData: OrderStatusChangeRequest,
  supplierEmail: string,
) {
  try {
    const { data, error } = await supabase
      .from(Tables.OrderStatusChangeRequests)
      .select("rejection_reason")
      .eq("id", requestData.id)
      .single();

    if (error) {
      logger.error({ error }, "Error while fetching reject_reason");
      throw error;
    }
    const mjml = RejectOrderStatusChangeTemplate(
      requestData.order_id,
      requestData.order_parts?.rfq_parts?.snapshot_2d_url || "",
      data.rejection_reason || "No reason provided",
    );

    const html = renderEmail(mjml);

    await sendEmail({
      to: supplierEmail,
      subject: `Part Status Change Rejected - Order: ${requestData.order_id}`,
      html,
    });
  } catch (error) {
    logger.error(
      { error, requestId: requestData.id },
      "Failed to send rejection email",
    );
    throw error;
  }
}
export async function sendAdminReminder(requestData: OrderStatusChangeRequest) {
  try {
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

    const adminMjml = OrderStatusReminderTemplate(
      requestData.status_from,
      requestData.status_to,
      requestData.order_id,
      requestData.order_parts?.rfq_parts?.snapshot_2d_url,
    );

    const adminHtml = renderEmail(adminMjml);

    await Promise.all(
      adminEmails.map((email) =>
        sendEmail({
          to: email,
          subject: `REMINDER: Order Status Change Request - ${requestData.order_id}`,
          html: adminHtml,
        }).catch((err) => {
          logger.error({ email, err }, "Failed to send reminder to admin");
        }),
      ),
    );
  } catch (error) {
    logger.error({ error }, "Error while sending reminders to verifiers");
    throw error;
  }
}
