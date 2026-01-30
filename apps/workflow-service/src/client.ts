import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "workflow-service",
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
