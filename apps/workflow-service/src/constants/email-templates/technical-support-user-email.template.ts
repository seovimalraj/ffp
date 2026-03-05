import { BaseEmailTemplate } from "./base.template.js";
import { config } from "../../config.js";

export const TechnicalSupportUserTemplate = (requestCode?: string) => {
  const url = `${config.frontendUrl}/portal/requests`;
  const content = `
    <!-- Main content -->
    <mj-section padding="20px">
      <mj-column background-color="#ffffff" padding="32px" border-radius="12px">

        <mj-text font-size="24px" font-weight="800" color="#1e293b" padding-bottom="8px">
          Request Received
        </mj-text>

        <mj-text font-size="15px" color="#64748b" line-height="20px">
          We've got your message. Our technical team is already on it.
        </mj-text>

        <mj-divider border-width="1px" border-color="#f1f5f9" padding="24px 0" />

        <mj-text font-size="16px" color="#334155" line-height="24px">
          Hello,
        </mj-text>

        <mj-text font-size="16px" color="#334155" line-height="24px" padding-bottom="20px">
          Thank you for reaching out to <b>FFP Support</b>. We are reviewing your details and will get back to you with a solution shortly.
        </mj-text>

        ${
          requestCode &&
          `
        <mj-text font-size="14px">

          <b>Request Reference:</b> #${requestCode}

        </mj-text>
        `
        }

        <mj-spacer height="24px" />

        <mj-button href="${url}" background-color="#2563eb" color="#ffffff" font-size="16px" font-weight="600" border-radius="8px" inner-padding="14px 32px">
          Track Your Request
        </mj-button>

        <mj-spacer height="32px" />

        <mj-text font-size="14px" color="#64748b" line-height="20px">
          Best regards,<br />
          <span style="color: #1e293b; font-weight: 700;">FFP Support Team</span>
        </mj-text>

        <mj-divider border-width="1px" border-color="#f1f5f9" padding="24px 0 12px 0" />

        <mj-text align="center" font-size="12px" color="#94a3b8">
          This is an automated notification. No need to reply to this email.
        </mj-text>

      </mj-column>
    </mj-section>
  `;

  return BaseEmailTemplate(content, "Technical Support Request Submitted");
};
