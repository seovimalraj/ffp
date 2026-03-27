import { Tables } from "../constants/index.js";
import { sendEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";
import { renderEmail } from "../lib/render-email.js";
import { supabase } from "../lib/supabase.js";
import {
  QuoteRequestedSupplierTemplate,
  QuoteResponseAdminTemplate,
  OrderAssignedSupplierTemplate,
} from "../constants/email-templates/index.js";

interface BaseQuoteRequestInfo {
  id: string;
  order_id: string;
  order_code: string;
  supplier_name: string;
  contact_email: string;
  contact_name: string;
}

async function fetchQuoteRequestDetails(
  id: string,
): Promise<BaseQuoteRequestInfo> {
  const { data, error } = await supabase
    .from(Tables.QuoteRequest)
    .select(
      `
      id,
      order_id,
      order:${Tables.OrdersTable}(order_code),
      contact:${Tables.UserTable}(email, name),
      supplier:${Tables.OrganizationTable}(name)
    `,
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    logger.error({ error }, `Failed to fetch quote request details for ${id}`);
    throw error || new Error("Quote Request not found");
  }

  // Handle potential nested arrays or single objects depending on PostgREST version/config
  const contact = Array.isArray(data.contact) ? data.contact[0] : data.contact;
  const order = Array.isArray(data.order) ? data.order[0] : data.order;
  const supplier = Array.isArray(data.supplier)
    ? data.supplier[0]
    : data.supplier;

  return {
    id: data.id,
    order_id: data.order_id,
    order_code: order?.order_code || "N/A",
    supplier_name: supplier?.name || "Supplier",
    contact_email: contact?.email || "",
    contact_name: contact?.name || "User",
  };
}

/**
 * Notify supplier when a quote request is created
 */
export async function sendQuoteRequestedEmailActivity(quoteRequestId: string) {
  const details = await fetchQuoteRequestDetails(quoteRequestId);

  if (!details.contact_email) {
    logger.warn(
      { quoteRequestId },
      "No contact email found for supplier notification",
    );
    return;
  }

  const mjml = QuoteRequestedSupplierTemplate(
    quoteRequestId,
    details.supplier_name,
  );
  const html = renderEmail(mjml);

  await sendEmail({
    to: details.contact_email,
    subject: `New Quote Request: ${details.order_code}`,
    html,
  });
}

/**
 * Notify admins about supplier's response (Accept/Decline)
 */
export async function sendQuoteResponseToAdminActivity(quoteRequestId: string) {
  const details = await fetchQuoteRequestDetails(quoteRequestId);

  const { data: quoteRequest, error: quoteError } = await supabase
    .from(Tables.QuoteRequest)
    .select("status, reject_reason")
    .eq("id", quoteRequestId)
    .single();

  if (quoteError || !quoteRequest) {
    throw quoteError || new Error("Failed to fetch quote request status");
  }

  const status = quoteRequest.status as "accepted" | "declined";

  // Fetch Admin email from system_config
  const { data: configData, error: configError } = await supabase
    .from(Tables.SystemConfig)
    .select("value")
    .eq("key", "verifier_email_multi")
    .single();

  let adminEmails: string[] = [];
  if (configError || !configData?.value) {
    logger.warn("Admin email not found in system_config, fallback to default");
  } else {
    try {
      adminEmails = JSON.parse(configData.value);
      if (!Array.isArray(adminEmails)) adminEmails = [configData.value];
    } catch (_e) {
      adminEmails = [configData.value];
    }
  }

  if (adminEmails.length === 0) {
    logger.warn("No admin emails found to notify about quote response");
    return;
  }

  const mjml = QuoteResponseAdminTemplate(
    details.order_code,
    details.supplier_name,
    status,
    quoteRequest.reject_reason || undefined,
  );
  const html = renderEmail(mjml);

  await Promise.all(
    adminEmails.map((email) =>
      sendEmail({
        to: email,
        subject: `Quote Request ${status.charAt(0).toUpperCase() + status.slice(1)}: ${details.order_code}`,
        html,
      }),
    ),
  );
}

/**
 * Notify supplier that order was assigned to them
 */
export async function sendOrderAssignedEmailToSupplierActivity(
  quoteRequestId: string,
) {
  const details = await fetchQuoteRequestDetails(quoteRequestId);

  if (!details.contact_email) {
    return;
  }

  const mjml = OrderAssignedSupplierTemplate(
    details.order_code,
    details.order_id,
  );
  const html = renderEmail(mjml);

  await sendEmail({
    to: details.contact_email,
    subject: `Order Assigned: ${details.order_code}`,
    html,
  });
}
