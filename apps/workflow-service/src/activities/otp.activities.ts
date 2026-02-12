import { BaseEmailTemplate } from "../constants/email-templates/base.template.js";
import { SQLFunctions } from "../constants/index.js";
import { sendEmail, type SendEmailDetails } from "../lib/email.js";
import { logger } from "../lib/logger.js";
import { renderEmail } from "../lib/render-email.js";
import { supabase } from "../lib/supabase.js";

const OTPEmailTemplate = (name: string = "Customer", code: string) => `
        <mj-text font-weight="500">
          Confirm verification code
        </mj-text>
        <mj-text>
          Hey ${name},
        </mj-text>

        <mj-text padding-top="10px">
          Please enter the following code on the page where you signed up:
        </mj-text>


        <mj-text padding-top="10px">
          ${code}
        </mj-text>

        This verification code will only be valid for the next 10 minutes.

        If you didn't sign up on Frigate Fast Parts, Please ignore this message.       

        <mj-text padding-top="18px">
          Best regards,<br /><br />
          <b>Frigate Team</b><br />
          Fast Parts Platform
        </mj-text>
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
  const mjmlContent = BaseEmailTemplate(
    OTPEmailTemplate(name, code),
    "Frigate Email Verification Code",
  );

  const htmlContent = renderEmail(mjmlContent);

  const customerEmail: SendEmailDetails = {
    to: email,
    subject: `Frigate Verification Code`,
    html: htmlContent,
  };

  return await sendEmail(customerEmail);
}
