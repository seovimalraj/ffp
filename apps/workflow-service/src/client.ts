import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "workflow-service",

  // REQUIRED for emitting events
  eventKey: process.env.INNGEST_EVENT_KEY,

  // @ts-ignore
  // REQUIRED for verifying Inngest → app requests
  signingKey: process.env.INNGEST_SIGNING_KEY,

  // REQUIRED ONLY for self-hosted Inngest
  baseUrl: process.env.INNGEST_BASE_URL || "https://ffp-workflow.frigate.ai", // undefined in Cloud → OK
});
