import { BaseEmailTemplate } from "./base.template.js";
import { config } from "../../config.js";

export const SupplierAssignmentTemplate = (
  orderCode: string,
  orderId: string,
) => {
  const url = `${config.frontendUrl}/portal/orders/${orderId}`;
  const content = `
    <!-- Main content -->
    <mj-section>
      <mj-column background-color="#ffffff" border-radius="12px">

        <mj-text font-size="24px" font-weight="800" color="#1e293b" padding-bottom="8px">
          New Order Assigned
        </mj-text>

        <mj-text font-size="15px" color="#64748b" line-height="20px">
          You have been assigned a new order for production.
        </mj-text>

        <mj-divider border-width="1px" border-color="#f1f5f9" padding="24px 0" />

        <mj-text font-size="16px" color="#334155" line-height="24px">
          Hello,
        </mj-text>

        <mj-text font-size="16px" color="#334155" line-height="24px" padding-bottom="20px">
          A new order <b>${orderCode}</b> has been assigned to you. Please review the order details and update the status in the portal.
        </mj-text>

        <mj-text font-size="14px">
          <b>Order Reference:</b> #${orderCode}
        </mj-text>

        <mj-spacer height="24px" />

        <mj-button href="${url}" background-color="#2563eb" color="#ffffff" font-size="16px" font-weight="600" border-radius="8px" inner-padding="14px 32px">
          View Order
        </mj-button>

        <mj-spacer height="32px" />

        <mj-text font-size="14px" color="#64748b" line-height="20px">
          Best regards,<br />
          <span style="color: #1e293b; font-weight: 700;">FFP Team</span>
        </mj-text>

        <mj-divider border-width="1px" border-color="#f1f5f9" padding="24px 0 12px 0" />

        <mj-text align="center" font-size="12px" color="#94a3b8">
          This is an automated notification. No need to reply to this email.
        </mj-text>

      </mj-column>
    </mj-section>
  `;

  return BaseEmailTemplate(content, "New Order Assigned");
};
