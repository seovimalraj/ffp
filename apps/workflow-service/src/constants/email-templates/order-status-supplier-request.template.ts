import { BaseEmailTemplate } from "./base.template.js";
import { config } from "../../config.js";

export const OrderStatusSupplierRequestTemplate = (
  fromStatus: string,
  toStatus: string,
  orderId: string,
  partImage: string,
) => {
  const url = `${config.frontendUrl}/admin/orders/${orderId}?tab=workflow`;
  const content = `
    <mj-section padding="20px 0">
      <mj-column background-color="#ffffff" padding="20px" border-radius="12px">

        <mj-text font-size="24px" font-weight="800" color="#1e293b" padding-bottom="8px">
          Order Status Change Request
        </mj-text>

        <mj-text font-size="15px" color="#64748b" line-height="20px">
          A supplier has requested a status change for a part in an order.
        </mj-text>

        <mj-divider border-width="1px" border-color="#f1f5f9" padding="24px 0" />

        <mj-text font-size="16px" color="#334155" line-height="24px">
          Hello Admin,
        </mj-text>

        <mj-text font-size="16px" color="#334155" line-height="24px" padding-bottom="20px">
          A supplier has submitted a request to change the status of a part. Please review the request and approve or reject the status update in the admin portal.
        </mj-text>

        <mj-spacer height="20px" />

        <mj-text font-size="15px" font-weight="600" color="#1e293b" padding-bottom="10px">
          Requested Status Change
        </mj-text>

        <mj-table padding="10px 0">
          <tr>
            <td align="center" style="background-color: #f1f5f9; color: #334155; font-size: 14px; font-weight: 600; padding: 10px; border-radius: 6px; width: 40%;">
              ${fromStatus}
            </td>
            <td align="center" style="font-size: 18px; color: #94a3b8; padding: 10px; width: 20%;">
              &rarr;
            </td>
            <td align="center" style="background-color: #dbeafe; color: #1e40af; font-size: 14px; font-weight: 700; padding: 10px; border-radius: 6px; width: 40%;">
              ${toStatus}
            </td>
          </tr>
        </mj-table>

        <mj-spacer height="20px" />

        <mj-text font-size="15px" font-weight="600" color="#1e293b">
          Part Preview
        </mj-text>

        <mj-image 
          src="${partImage}"
          alt="Part Image"
          width="120px"
          border-radius="8px"
        />

        <mj-spacer height="24px" />

        <mj-button 
          href="${url}"
          background-color="#2563eb"
          color="#ffffff"
          font-size="16px"
          font-weight="600"
          border-radius="8px"
          inner-padding="14px 32px"
        >
          Review Request
        </mj-button>

        <mj-spacer height="32px" />

        <mj-text font-size="14px" color="#64748b" line-height="20px">
          Please review the request and take the appropriate action in the admin portal.
        </mj-text>

        <mj-spacer height="16px" />

        <mj-text font-size="14px" color="#64748b" line-height="20px">
          Best regards,<br />
          <span style="color:#1e293b;font-weight:700;">FFP Team</span>
        </mj-text>

        <mj-divider border-width="1px" border-color="#f1f5f9" padding="24px 0 12px 0" />

        <mj-text align="center" font-size="12px" color="#94a3b8">
          This is an automated notification. Please do not reply to this email.
        </mj-text>

      </mj-column>
    </mj-section>
  `;

  return BaseEmailTemplate(content, "Order Status change Request");
};
