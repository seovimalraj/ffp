import { proxyActivities, log } from "@temporalio/workflow";
import type * as activities from "../activities/otp.activities.js";

const { generateOTP, sendOTPNotification } = proxyActivities<typeof activities>(
  {
    startToCloseTimeout: "1 minute",
    retry: {
      initialInterval: "5s",
      maximumAttempts: 3,
    },
  },
);

export async function otpWorkflow(data: {
  email: string;
  username: string;
  code?: string;
  password?: string;
}) {
  log.info("Starting otpWorkflow", {
    email: data.email,
    username: data.username,
    hasProvidedCode: !!data.code,
  });

  let otp = data.code;

  if (!otp) {
    log.info("No code provided, generating new OTP");
    otp = await generateOTP(data.email);
  }

  if (!otp) {
    const errorMsg = "Error in OTP generation: OTP was null or undefined";
    log.error(errorMsg);
    throw new Error(errorMsg); // Fail the workflow so it can potentially retry or alert
  }

  log.info("Sending notification email", {
    email: data.email,
  });
  await sendOTPNotification(data.email, data.username, otp);

  log.info(`otpWorkflow completed successfully`, {
    email: data.email,
  });
}
