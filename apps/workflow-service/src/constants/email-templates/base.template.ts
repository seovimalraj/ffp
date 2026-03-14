import { SocialLinks } from "../index.js";

export const BaseEmailTemplate = (
  content: string,
  title: string = "Frigate",
) => {
  return `
<mjml>
  <mj-head>
    <mj-title>${title}</mj-title>
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
    ${content}

    <!-- Footer -->
    <mj-section padding="20px 24px 40px 24px">
      <mj-column>
        <mj-divider />
        <mj-text align="center" mj-class="footer-small">
          © ${new Date().getFullYear()} <b>Frigate Engineering Services Pvt Ltd</b>
        </mj-text>
        <mj-text align="center" mj-class="footer-small" padding-top="0px">
          You’re receiving this email because you created an account on Frigate Fast Parts.
        </mj-text>
        <mj-social font-size="12px" icon-size="24px" mode="horizontal" padding-top="10px">
          <mj-social-element name="linkedin" href="${SocialLinks.LinkedinEmail}" background-color="#94a3b8">
          </mj-social-element>
          <mj-social-element name="web" href="${SocialLinks.FrigateOfficialSiteEmail}" background-color="#94a3b8">
          </mj-social-element>
        </mj-social>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
  `.trim();
};
