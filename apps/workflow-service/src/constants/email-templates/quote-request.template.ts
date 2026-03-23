import { BaseEmailTemplate } from "./base.template.js";
import { config } from "../../config.js";

export const QuoteRequestedSupplierTemplate = (
  quoteRequestId: string,
  supplierName: string,
) => {
  const url = `${config.frontendUrl}/portal/quote-requests/${quoteRequestId}`; // Adjust URL if needed
  const content = `
    <mj-section>
      <mj-column background-color="#ffffff" border-radius="12px">
        <mj-text font-size="24px" font-weight="800" color="#1e293b" padding-bottom="8px">
          New Quote Request
        </mj-text>
        <mj-text font-size="15px" color="#64748b" line-height="20px">
          A new quote request has been placed for you.
        </mj-text>
        <mj-divider border-width="1px" border-color="#f1f5f9" padding="24px 0" />
        <mj-text font-size="16px" color="#334155" line-height="24px">
          Hello ${supplierName},
        </mj-text>
        <mj-text font-size="16px" color="#334155" line-height="24px" padding-bottom="20px">
          You have received a new quote request. Please review and respond in the portal.
        </mj-text>
        <mj-button href="${url}" background-color="#2563eb" color="#ffffff" font-size="16px" font-weight="600" border-radius="8px" inner-padding="14px 32px">
          View Quote Request
        </mj-button>
        <mj-spacer height="32px" />
        <mj-text font-size="14px" color="#64748b" line-height="20px">
          Best regards,<br />
          <span style="color: #1e293b; font-weight: 700;">FFP Team</span>
        </mj-text>
      </mj-column>
    </mj-section>
  `;
  return BaseEmailTemplate(content, "New Quote Request");
};

export const QuoteResponseAdminTemplate = (
  orderCode: string,
  supplierName: string,
  status: "accepted" | "declined",
  reason?: string,
) => {
  const statusColor = status === "accepted" ? "#10b981" : "#ef4444";
  const content = `
    <mj-section>
      <mj-column background-color="#ffffff" border-radius="12px">
        <mj-text font-size="24px" font-weight="800" color="#1e293b" padding-bottom="8px">
          Quote Request ${status.charAt(0).toUpperCase() + status.slice(1)}
        </mj-text>
        <mj-text font-size="15px" color="#64748b" line-height="20px">
          Supplier <b>${supplierName}</b> has ${status} the quote request for order <b>${orderCode}</b>.
        </mj-text>
        <mj-divider border-width="1px" border-color="#f1f5f9" padding="24px 0" />
        ${
          reason
            ? `<mj-text font-size="16px" color="#334155" line-height="24px" padding-bottom="20px">
                 <b>Reason:</b> ${reason}
               </mj-text>`
            : ""
        }
        <mj-text font-size="16px" color="${statusColor}" font-weight="700">
          Status: ${status.toUpperCase()}
        </mj-text>
      </mj-column>
    </mj-section>
  `;
  return BaseEmailTemplate(content, `Quote Request ${status}`);
};

export const OrderAssignedSupplierTemplate = (
  orderCode: string,
  orderId: string,
) => {
  const url = `${config.frontendUrl}/portal/orders/${orderId}`;
  const content = `
    <mj-section>
      <mj-column background-color="#ffffff" border-radius="12px">
        <mj-text font-size="24px" font-weight="800" color="#1e293b" padding-bottom="8px">
          Order Assigned
        </mj-text>
        <mj-text font-size="15px" color="#64748b" line-height="20px">
          The order has been successfully assigned to you.
        </mj-text>
        <mj-divider border-width="1px" border-color="#f1f5f9" padding="24px 0" />
        <mj-text font-size="16px" color="#334155" line-height="24px" padding-bottom="20px">
          Order <b>${orderCode}</b> has been assigned in your name. You can now start processing the order.
        </mj-text>
        <mj-button href="${url}" background-color="#2563eb" color="#ffffff" font-size="16px" font-weight="600" border-radius="8px" inner-padding="14px 32px">
          View Order
        </mj-button>
        <mj-spacer height="32px" />
        <mj-text font-size="14px" color="#64748b" line-height="20px">
          Best regards,<br />
          <span style="color: #1e293b; font-weight: 700;">FFP Team</span>
        </mj-text>
      </mj-column>
    </mj-section>
  `;
  return BaseEmailTemplate(content, "Order Assigned");
};
