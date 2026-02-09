export const WelcomeTemplate = (name: string = "Customer") => {
  return `
<mjml>
  <mj-head>
    <mj-title>Welcome to Frigate</mj-title>
    <mj-attributes>
      <mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" />
      <mj-text color="#0f172a" font-size="14px" line-height="22px" />
      <mj-button background-color="#2563eb" color="#ffffff" border-radius="6px" font-size="14px" font-weight="600" />
      <mj-divider border-width="1px" border-color="#e2e8f0" />
      <mj-class name="footer-small" font-size="12px" color="#94a3b8" line-height="18px" />
    </mj-attributes>
  </mj-head>

  <mj-body background-color="#f6f9ff">
    <mj-section padding="24px 0 10px 0">
      <mj-column>
        <mj-image width="140px" src="https://frigate.ai/wp-content/uploads/2025/03/FastParts-logo-1024x351.png" alt="FFP Logo" />
      </mj-column>
    </mj-section>

    <!-- Main content -->
    <mj-section padding="10px 24px 0 24px">
      <mj-column background-color="#ffffff" padding="28px" border-radius="8px">
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
      </mj-column>
    </mj-section>

    <!-- Footer -->
    <mj-section padding="20px 24px 40px 24px">
      <mj-column>
        <mj-divider />
        <mj-text align="center" mj-class="footer-small">
          © 2026 <b>Frigate Engineering Services Pvt Ltd</b>
        </mj-text>
        <mj-text align="center" mj-class="footer-small" padding-top="0px">
          You’re receiving this email because you created an account on Frigate Fast Parts.
        </mj-text>
        <mj-social font-size="12px" icon-size="24px" mode="horizontal" padding-top="10px">
          <mj-social-element name="linkedin" href="https://www.linkedin.com/company/frigates/posts/?feedView=all" background-color="#94a3b8">
          </mj-social-element>
          <mj-social-element name="web" href="https://frigate.ai" background-color="#94a3b8">
          </mj-social-element>
        </mj-social>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
  `;
};
