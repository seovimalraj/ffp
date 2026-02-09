// lib/render-email.ts
import mjml2html from "mjml";
import { logger } from "./logger.js";

export function renderEmail(mjml: string) {
  const { html, errors } = mjml2html(mjml, {
    validationLevel: "soft",
  });

  if (errors.length) {
    logger.error({ errors }, "MJML rendering errors occurred");
  }

  return html;
}
