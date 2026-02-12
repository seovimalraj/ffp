import { BaseEmailTemplate } from "./base.template.js";

export const WelcomeTemplate = (name: string = "Customer") => {
  const content = `
        <mj-text>
          Hi ${name},
        </mj-text>

        <mj-text padding-top="10px">
          <b>Welcome to Frigate</b> — your platform for sourcing, posting, and managing parts faster.
          You can now connect with suppliers, publish RFQs, and track orders from one place.
        </mj-text>

        <mj-text padding-top="10px">
          Whether you're posting urgent requirements or managing ongoing procurement,
          Frigate helps you move from request to quote to order with less friction.
        </mj-text>

        <mj-text padding-top="16px" font-weight="600">
          To get started:
        </mj-text>

        <mj-text>
          🔧 <b>Post your first part</b> — Create an RFQ and start receiving supplier responses.<br />
          📩 <b>Review quotes</b> — Compare pricing, lead times, and vendor details.<br />
          🏷 <b>Organize orders</b> — Track status and updates in one dashboard.<br />
          </mj-text>

        <mj-button href="http://app.frigate.ai/customer" padding-top="18px">
          Go to Dashboard
        </mj-button>

        <mj-text padding-top="18px">
          Want to explore more? Visit the platform to see active parts, responses,
          and updates in real time.
        </mj-text>

        <mj-text padding-top="18px">
          Need help getting set up or posting your first part? Just reply to this email —
          our team is happy to help.
        </mj-text>

        <mj-text padding-top="18px">
          Best regards,<br /><br />
          <b>Frigate Team</b><br />
          Fast Parts Platform
        </mj-text>
  `;

  return BaseEmailTemplate(content, "Welcome to Frigate");
};
