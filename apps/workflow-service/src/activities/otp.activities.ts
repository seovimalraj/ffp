import { SocialLinks, SQLFunctions } from "../constants/index.js";
import { sendEmail, type SendEmailDetails } from "../lib/email.js";
import { logger } from "../lib/logger.js";
import { renderEmail } from "../lib/render-email.js";
import { supabase } from "../lib/supabase.js";

const OTPEmailTemplate = (name: string = "Customer", code: string) => `
<mjml>
  <mj-head>
    <mj-title>Your Frigate verification code</mj-title>
    <mj-preview>Your verification code is ${code}. Expires in 10 minutes.</mj-preview>

    <mj-attributes>
      <mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" />
      <mj-text color="#0f172a" font-size="14px" line-height="22px" padding="0" />
      <mj-button background-color="#2563eb" color="#ffffff" border-radius="6px" font-size="14px" font-weight="600" />
      <mj-divider border-width="1px" border-color="#e2e8f0" />
      <mj-class name="footer-small" font-size="12px" color="#94a3b8" line-height="18px" />
      <mj-class name="muted" color="#64748b" />
    </mj-attributes>

    <mj-style inline="inline">
      .otp-container {
        background-color: #f8fafc;
        border-radius: 8px;
      }
      .otp-text {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
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
          Confirm verification code
        </mj-text>

        <mj-text padding-bottom="12px">Hello ${name},</mj-text>

        <mj-text padding-bottom="8px">
          Enter this code on Frigate Platform to verify your email and continue to your instant quote.
        </mj-text>

        <mj-text css-class="muted" padding-bottom="24px">
          This code expires in <b>10 minutes</b>.
        </mj-text>

        <mj-table css-class="otp-container">
          <tr>
            <td style="padding: 24px 0; text-align: center;">
              <span style="font-size: 38px; font-weight: 800; color: #6366f1; letter-spacing: 12px; font-family: monospace;">${code}</span>
            </td>
          </tr>
        </mj-table>

        <mj-spacer height="24px" />

        <mj-text css-class="muted">
          If you didn’t request this, ignore this email. No changes will be made.
        </mj-text>

        <mj-text padding-top="12px">
          Need help? Contact
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
          You’re receiving this email because a verification was requested for your Frigate account.
        </mj-text>

        <mj-text align="center" mj-class="footer-small" css-class="footer-link" padding-top="12px">
          <a href="https://frigate.ai/policy/privacy-policy/">Privacy Policy</a>
        </mj-text>
      </mj-column>
    </mj-section>

  </mj-body>
</mjml>
`;

export async function generateOTP(email: string): Promise<any> {
  try {
    const { data, error } = await supabase.rpc(SQLFunctions.requestOtp, {
      target_email: email,
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    logger.error(`Error while generating OTP`);
    throw error;
  }
}

export async function sendOTPNotification(
  email: string,
  name: string,
  code: string,
) {
  const mjmlContent = OTPEmailTemplate(name, code);

  const htmlContent = renderEmail(mjmlContent);

  const customerEmail: SendEmailDetails = {
    to: email,
    subject: `Frigate Verification Code`,
    html: htmlContent,
  };

  return await sendEmail(customerEmail);
}
