import { BaseEmailTemplate } from "./base.template.js";
import { config } from "../../config.js";

export const TechnicalSupportTemplate = (
  username: string,
  userEmail: string,
  phoneNumber: string,
  quoteId?: string,
  quoteCode?: string,
) => {
  const content = `
    <mj-section padding="10px 0">
      <mj-column background-color="#ffffff" padding="18px" border-radius="8px">
        <mj-text font-size="20px" font-weight="700" color="#334155" padding-bottom="20px">
          Technical Support Requested
        </mj-text>

        <mj-text padding-bottom="16px">
          Hello Team,
        </mj-text>

        ${
          quoteId &&
          ` <mj-text padding-bottom="16px">
              A technical support request has been submitted for quote <a href="${config.frontendUrl}/admin/orders/${quoteId}"><b>#${quoteCode}</b></a>.
            </mj-text>
          `
        }

       

        <mj-divider border-width="1px" border-color="#f1f5f9" padding="10px 0" />

        <mj-text font-weight="700" padding-top="10px">User Details:</mj-text>
        <mj-text>
          <b>Name:</b> ${username}<br/>
          <b>Email:</b> ${userEmail}<br/>
          <b>Phone:</b> ${phoneNumber}
        </mj-text>

        <mj-spacer height="24px" />

        <mj-text padding-top="12px">
          Please reach out to the user to assist with their technical requirements.
        </mj-text>

        <mj-text padding-top="18px">
          Best regards,<br /><br />
          <b>Frigate System</b>
        </mj-text>
      </mj-column>
    </mj-section>
  `;

  return BaseEmailTemplate(content, "Technical Support Request");
};
