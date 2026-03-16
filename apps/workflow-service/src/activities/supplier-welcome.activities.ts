import { SocialLinks } from "../constants/index.js";
import { sendEmail, type SendEmailDetails } from "../lib/email.js";
import { renderEmail } from "../lib/render-email.js";

const SupplierWelcomeEmailTemplate = (
  name: string,
  organizationName: string,
  password?: string
) => {
  const passwordBlock = password
    ? `<mj-text font-weight="700" padding-bottom="8px">Your Temporary Credentials:</mj-text>
        <mj-table css-class="credential-container">
          <tr>
            <td style="padding: 16px; border-bottom: 1px solid #e2e8f0;">
              <span style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Initial Password</span><br/>
              <span style="font-family: monospace; font-size: 18px; font-weight: 700; color: #2563eb;">${password}</span>
            </td>
          </tr>
        </mj-table>
        <mj-text font-size="12px" color="#64748b" padding-top="8px" padding-bottom="24px">
          * Please change your password immediately after your first login for security.
        </mj-text>`
    : "";

  return `
<mjml>
  <mj-head>
    <mj-title>Welcome to Frigate Fast Parts</mj-title>
    <mj-preview>Welcome ${name}! Your supplier account for ${organizationName} is ready.</mj-preview>

    <mj-attributes>
      <mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" />
      <mj-text color="#0f172a" font-size="14px" line-height="22px" padding="0" />
      <mj-button background-color="#2563eb" color="#ffffff" border-radius="6px" font-size="14px" font-weight="600" />
      <mj-divider border-width="1px" border-color="#e2e8f0" />
      <mj-class name="footer-small" font-size="12px" color="#94a3b8" line-height="18px" />
      <mj-class name="muted" color="#64748b" />
    </mj-attributes>

    <mj-style inline="inline">
      .credential-container {
        background-color: #f8fafc;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
      }
      .footer-link a { color: #94a3b8; text-decoration: underline; }
    </mj-style>
  </mj-head>

  <mj-body background-color="#f6f9ff">

    <mj-section padding="32px 0 20px 0">
      <mj-column>
        <mj-image width="140px" src="https://frigate.ai/wp-content/uploads/2025/03/FastParts-logo-1024x351.png" alt="Frigate Fast Parts" />
      </mj-column>
    </mj-section>

    <mj-section padding="0 24px">
      <mj-column background-color="#ffffff" padding="32px" border-radius="12px">

        <mj-text font-size="22px" font-weight="700" color="#334155" padding-bottom="20px">
          Welcome to the Network!
        </mj-text>

        <mj-text padding-bottom="12px">Hello ${name},</mj-text>

        <mj-text padding-bottom="16px">
          We are excited to welcome <b>${organizationName}</b> as a verified supplier on the Frigate Fast Parts platform. Your account has been successfully created by our administrator.
        </mj-text>

        <mj-text padding-bottom="16px">
          You can now log in to your supplier portal to view assignments, manage orders, and update your profile.
        </mj-text>

        ${passwordBlock}

        <mj-button href="${SocialLinks.FrigateOfficialSiteEmail}" padding-bottom="24px">
          Go to Supplier Portal
        </mj-button>

        <mj-divider padding-bottom="24px" />

        <mj-text css-class="muted">
          If you have any questions or need assistance getting started, our support team is here to help.
        </mj-text>

        <mj-text padding-top="12px">
          Contact us at
          <a href="mailto:support@frigate.ai" style="color:#2563eb; text-decoration:underline;">support@frigate.ai</a>.
        </mj-text>

      </mj-column>
    </mj-section>

    <mj-section padding="20px 24px 40px 24px">
      <mj-column>
        <mj-divider />
        <mj-social font-size="12px" icon-size="24px" mode="horizontal" padding-top="15px">
          <mj-social-element name="linkedin" href="${SocialLinks.LinkedinFFP}" background-color="#94a3b8"></mj-social-element>
          <mj-social-element name="web" href="${SocialLinks.FrigateOfficialSiteEmail}" background-color="#94a3b8"></mj-social-element>
        </mj-social>

        <mj-text align="center" mj-class="footer-small" padding-top="15px">
          © 2026 <b>Frigate Engineering Services Pvt Ltd</b>
        </mj-text>

        <mj-text align="center" mj-class="footer-small" padding-top="8px">
          You’re receiving this because you’ve been registered as a supplier on Frigate Fast Parts.
        </mj-text>
      </mj-column>
    </mj-section>

  </mj-body>
</mjml>
`;
}

export async function sendSupplierWelcomeEmail(
  email: string,
  name: string,
  organizationName: string,
  password?: string
) {
  const mjmlContent = SupplierWelcomeEmailTemplate(name, organizationName, password);
  const htmlContent = renderEmail(mjmlContent);

  const emailDetails: SendEmailDetails = {
    to: email,
    subject: `Welcome to Frigate! Your Supplier Account is Ready`,
    html: htmlContent,
  };

  return await sendEmail(emailDetails);
}
