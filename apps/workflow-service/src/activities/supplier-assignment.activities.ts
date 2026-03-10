import { Tables } from "../constants/index.js";
import { sendEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";
import { renderEmail } from "../lib/render-email.js";
import { supabase } from "../lib/supabase.js";
import { SupplierAssignmentTemplate } from "../constants/email-templates/supplier-assignment.template.js";

export async function getOrderCode(orderId: string): Promise<string> {
  const { data, error } = await supabase
    .from(Tables.OrdersTable)
    .select("order_code")
    .eq("id", orderId)
    .single();

  if (error || !data) {
    logger.error({ error, orderId }, "Failed to fetch order code");
    throw error || new Error("Order not found");
  }

  return data.order_code;
}

export interface SendSupplierAssignmentEmailParams {
  supplierEmail: string;
  orderCode: string;
  orderId: string;
}

export async function sendSupplierAssignmentEmail(
  params: SendSupplierAssignmentEmailParams,
) {
  try {
    const mjml = SupplierAssignmentTemplate(params.orderCode, params.orderId);
    const html = renderEmail(mjml);

    await sendEmail({
      to: params.supplierEmail,
      subject: `New Order Assigned: ${params.orderCode}`,
      html: html,
    });

    logger.info(
      { orderCode: params.orderCode, to: params.supplierEmail },
      "Supplier assignment email sent successfully",
    );
  } catch (error) {
    logger.error({ error }, "Error in sendSupplierAssignmentEmail activity");
    throw error;
  }
}
