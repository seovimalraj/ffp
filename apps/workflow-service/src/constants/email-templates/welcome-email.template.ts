import { BaseEmailTemplate } from "./base.template.js";

export const WelcomeTemplate = (name: string = "Customer") => {
  const content = `
     <mj-section padding="">
          <mj-column css-class="main-content" padding="20px" border-radius="8px">

            <mj-text mj-class="heading" padding-bottom="16px">
              Welcome to Frigate, ${name}
            </mj-text>

            <mj-text padding-bottom="20px">
              Your account is now verified. You can start generating instant quotes for machining and sheet metal parts.
            </mj-text>

            <mj-text padding-bottom="24px">
              Simply upload your <strong>3D models (STEP, IGES) or 2D drawings (DXF, PDF)</strong>. Our platform analyzes your geometry instantly to provide <strong>real-time pricing and DFM (Design for Manufacturing) feedback </strong>.

            </mj-text>

            <mj-divider padding-bottom="24px" />

        <mj-text mj-class="section-title" padding-bottom="12px">
          How to get your first quote
        </mj-text>

        <mj-table padding-bottom="10px">
          <tr>
            <td style="width: 32px; vertical-align: top; color: #2563eb; font-weight: 700; font-size: 14px; padding-bottom: 20px;">01</td>
            <td style="padding-left: 12px; padding-bottom: 20px;">
              <div style="font-weight: 700; color: #0f172a; font-size: 14px;">Securely Upload Files</div>
              <div style="font-size: 13px; color: #64748b; line-height: 20px;">Upload your CAD files. Your intellectual property is protected by our strict confidentiality standards.</div>
            </td>
          </tr>
          <tr>
            <td style="width: 32px; vertical-align: top; color: #2563eb; font-weight: 700; font-size: 14px; padding-bottom: 20px;">02</td>
            <td style="padding-left: 12px; padding-bottom: 20px;">
              <div style="font-weight: 700; color: #0f172a; font-size: 14px;">Configure Specifications</div>
              <div style="font-size: 13px; color: #64748b; line-height: 20px;">Choose from 100+ materials and finishes. Adjust quantities and lead times to fit your project budget.</div>
            </td>
          </tr>
          <tr>
            <td style="width: 32px; vertical-align: top; color: #2563eb; font-weight: 700; font-size: 14px; padding-bottom: 20px;">03</td>
            <td style="padding-left: 12px; padding-bottom: 20px;">
              <div style="font-weight: 700; color: #0f172a; font-size: 14px;">Checkout & Production</div>
              <div style="font-size: 13px; color: #64748b; line-height: 20px;">Review your quote, place your order, and track your parts through production to your doorstep.</div>
            </td>
          </tr>
        </mj-table>

        <mj-button href="https://app.frigate.ai/instant-quote" align="center" padding="10px 0 0 0">
          Get Your First Quote
        </mj-button>

            <mj-text padding-top="18px">
              Best regards,<br />
              <b>Frigate Fast Parts Team</b><br />
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
