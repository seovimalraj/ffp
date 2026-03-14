import { BaseEmailTemplate } from "./base.template.js";

export const ProductionRequestAdminTemplate = (
  customerName: string,
  customerEmail: string,
  projectName: string,
  projectDescription: string,
  services: string[],
  requestCode: string,
) => {
  const servicesList = services.length
    ? services.map((s) => `<li>${s}</li>`).join("")
    : "<li>No specific services selected</li>";

  const content = `
    <mj-section padding="10px 0">
      <mj-column background-color="#ffffff" padding="18px" border-radius="8px">
        <mj-text font-size="20px" font-weight="700" color="#334155" padding-bottom="20px">
          New Production Request
        </mj-text>

        <mj-text padding-bottom="16px">
          Hello Team,
        </mj-text>

        <mj-text padding-bottom="16px">
          A new production request <b>#${requestCode}</b> has been submitted and requires review.
        </mj-text>

        <mj-divider border-width="1px" border-color="#f1f5f9" padding="10px 0" />

        <mj-text font-weight="700" padding-top="10px">Project Details:</mj-text>
        <mj-text>
          <b>Project Name:</b> ${projectName}<br/>
          <b>Description:</b> ${projectDescription}
        </mj-text>

        <mj-text font-weight="700" padding-top="16px">Manufacturing Services:</mj-text>
        <mj-text>
          <ul style="margin: 0; padding-left: 20px;">
            ${servicesList}
          </ul>
        </mj-text>

        <mj-divider border-width="1px" border-color="#f1f5f9" padding="10px 0" />

        <mj-text font-weight="700" padding-top="10px">Customer Details:</mj-text>
        <mj-text>
          <b>Name:</b> ${customerName}<br/>
          <b>Email:</b> ${customerEmail}
        </mj-text>

        <mj-spacer height="24px" />

        <mj-text padding-top="12px">
          Please review and reach out to the customer regarding their production requirements.
        </mj-text>

        <mj-text padding-top="18px">
          Best regards,<br /><br />
          <b>Frigate System</b>
        </mj-text>
      </mj-column>
    </mj-section>
  `;

  return BaseEmailTemplate(content, "New Production Request");
};
