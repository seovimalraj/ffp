import { BaseEmailTemplate } from "./base.template.js";
import { config } from "../../config.js";

export const OrderStatusReminderTemplate = (
  fromStatus: string,
  toStatus: string,
  orderId: string,
  partImage: string,
) => {
  const url = `${config.frontendUrl}/admin/orders/${orderId}?tab=workflow`;
  const content = `
    <mj-section padding="10px 0">
      <mj-column background-color="#ffffff" border-radius="12px" padding="20px">
        <mj-text font-size="12px" font-weight="800" color="#ef4444" padding-bottom="0px" text-transform="uppercase" letter-spacing="1px">
          Reminder
        </mj-text>
        <mj-text font-size="24px" font-weight="800" color="#1e293b" padding-bottom="8px">
          Pending Status Change Request
        </mj-text>

        <mj-text font-size="15px" color="#64748b" line-height="20px">
          This is a reminder to review a pending status change request that was submitted over 24 hours ago.
        </mj-text>

        <mj-divider border-width="1px" border-color="#f1f5f9" padding="24px 0" />

        <mj-text font-size="16px" color="#334155" line-height="24px">
          Hello Admin,
        </mj-text>

        <mj-text font-size="16px" color="#334155" line-height="24px" padding-bottom="20px">
          The following status change request is still awaiting your review. Please take action to avoid delays in production.
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

        <mj-image 
          src="${partImage}"
          alt="Part Image"
          width="120px"
          border-radius="8px"
        />

        <mj-spacer height="24px" />

        <mj-button 
          href="${url}"
          background-color="#ef4444"
          color="#ffffff"
          font-size="16px"
          font-weight="600"
          border-radius="8px"
          inner-padding="14px 32px"
        >
          Review Now
        </mj-button>

        <mj-spacer height="32px" />

        <mj-text font-size="14px" color="#64748b" line-height="20px">
          Best regards,<br />
          <span style="color:#1e293b;font-weight:700;">FFP Team</span>
        </mj-text>
      </mj-column>
    </mj-section>
  `;

  return BaseEmailTemplate(content, "REMINDER: Order Status Change Request");
};
