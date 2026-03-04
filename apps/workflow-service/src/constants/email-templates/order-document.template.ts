import { SocialLinks } from "../index.js";

export const getOrderDocumentTemplate = (orderId: string, username: string) => `
<mjml>
  <mj-head>
    <mj-title>New document for your order</mj-title>
    <mj-preview>A new document has been uploaded to your order.</mj-preview>

    <mj-attributes>
      <mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" />
      <mj-text color="#0f172a" font-size="14px" line-height="22px" padding="0" />
      <mj-button background-color="#2563eb" color="#ffffff" border-radius="6px" font-size="14px" font-weight="600" />
      <mj-divider border-width="1px" border-color="#e2e8f0" />
      <mj-class name="footer-small" font-size="12px" color="#94a3b8" line-height="18px" />
      <mj-class name="muted" color="#64748b" />
    </mj-attributes>
  </mj-head>

  <mj-body background-color="#f6f9ff">

    <!-- HEADER -->
    <mj-section padding="32px 0 20px 0">
      <mj-column>
        <mj-image width="140px" src="https://frigate.ai/wp-content/uploads/2025/03/FastParts-logo-1024x351.png" alt="Frigate Fast Parts" />
      </mj-column>
    </mj-section>

    <!-- CARD -->
    <mj-section padding="0 24px">
      <mj-column background-color="#ffffff" padding="32px" border-radius="12px">

        <mj-text font-size="22px" font-weight="700" color="#334155" padding-bottom="20px">
          New Document Uploaded
        </mj-text>

        <mj-text padding-bottom="16px">
          Hello ${username},
        </mj-text>

        <mj-text padding-bottom="16px">
          A new document related to your order <b>${orderId}</b> has been uploaded.
          Please find the document attached to this email.
        </mj-text>

        <mj-spacer height="20px" />

        <mj-text css-class="muted">
          You can download the document directly from this email attachment.
        </mj-text>

        <mj-text padding-top="12px">
          If you have any questions contact
          <a href="mailto:support@frigate.ai" style="color:#2563eb; text-decoration:underline;">
            support@frigate.ai
          </a>.
        </mj-text>

      </mj-column>
    </mj-section>

    <!-- FOOTER -->
    <mj-section padding="20px 24px 40px 24px">
      <mj-column>
        <mj-divider />
        <mj-social font-size="12px" icon-size="24px" mode="horizontal" padding-top="15px">
          <mj-social-element name="linkedin" href="${SocialLinks.LinkedinEmail}" background-color="#94a3b8"></mj-social-element>
          <mj-social-element name="web" href="${SocialLinks.FrigateOfficialSiteEmail}" background-color="#94a3b8"></mj-social-element>
        </mj-social>

        <mj-text align="center" mj-class="footer-small" padding-top="15px">
          © 2026 <b>Frigate Engineering Services Pvt Ltd</b>
        </mj-text>

        <mj-text align="center" mj-class="footer-small" padding-top="8px">
          You’re receiving this email because a document related to your order was shared with you.
        </mj-text>

        <mj-text align="center" mj-class="footer-small" css-class="footer-link" padding-top="12px">
          <a href="https://frigate.ai/policy/privacy-policy/">Privacy Policy</a>
        </mj-text>
      </mj-column>
    </mj-section>

  </mj-body>
</mjml>

`;
