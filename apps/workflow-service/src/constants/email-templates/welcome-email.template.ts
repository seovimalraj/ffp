import { BaseEmailTemplate } from "./base.template.js";

export const WelcomeTemplate = (name: string = "Customer") => {
  const content = `
    <mj-section padding="0 24px">
      <mj-column css-class="main-content" padding="40px" border-radius="8px">

        <mj-text mj-class="heading" padding-bottom="16px">
          Welcome to Frigate, ${name}
        </mj-text>

        <mj-text padding-bottom="20px">
          Your account is now verified. You can start generating instant quotes for machining and sheet metal parts.
        </mj-text>

        <mj-text padding-bottom="24px">
          Upload your CAD and drawings, choose material, finish, quantity, and lead time, and review pricing immediately.
          If any clarification is needed (for example tolerances or bend details), we’ll reach out so you can proceed without delays.
        </mj-text>

        <mj-divider padding-bottom="24px" />

        <mj-text mj-class="section-title" padding-bottom="12px">
          Getting Started
        </mj-text>

        <mj-table padding-bottom="10px">
          <tr>
            <td style="width: 32px; vertical-align: top; color: #2563eb; font-weight: 700; font-size: 14px; padding-bottom: 16px;">01</td>
            <td style="padding-left: 12px; padding-bottom: 16px;">
              <div style="font-weight: 700; color: #0f172a; font-size: 14px;">Upload your part files</div>
              <div style="font-size: 13px; color: #64748b; line-height: 20px;">Submit CAD and drawings for the part you want quoted.</div>
            </td>
          </tr>
          <tr>
            <td style="width: 32px; vertical-align: top; color: #2563eb; font-weight: 700; font-size: 14px; padding-bottom: 16px;">02</td>
            <td style="padding-left: 12px; padding-bottom: 16px;">
              <div style="font-weight: 700; color: #0f172a; font-size: 14px;">Configure requirements</div>
              <div style="font-size: 13px; color: #64748b; line-height: 20px;">Select material, finish, quantity, and lead time.</div>
            </td>
          </tr>
          <tr>
            <td style="width: 32px; vertical-align: top; color: #2563eb; font-weight: 700; font-size: 14px; padding-bottom: 16px;">03</td>
            <td style="padding-left: 12px; padding-bottom: 16px;">
              <div style="font-weight: 700; color: #0f172a; font-size: 14px;">Review quote and proceed</div>
              <div style="font-size: 13px; color: #64748b; line-height: 20px;">See price and lead time, then place an order.</div>
            </td>
          </tr>
        </mj-table>

        <mj-button href="https://app.frigate.ai/instant-quote" align="center" padding="10px 0 0 0">
          Create Instant Quote
        </mj-button>
        
        
        <mj-text padding-top="18px">
          Best regards,<br />
          <b>Frigate Fast Parts Team</b><br />
          Fast Parts Platform
        </mj-text>

        <mj-text padding-top="32px">
          Need help getting started? Contact us at
          <a class="link-style" href="mailto:support@frigate.ai">support@frigate.ai</a>.
        </mj-text>

      </mj-column>

    </mj-section>
  `;

  return BaseEmailTemplate(content, "Welcome to Frigate");
};
