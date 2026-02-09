// import { inngest } from "../client.js";
// import { sendEmail } from "../lib/email.js";

// export const sendEmailFunction = inngest.createFunction(
//   { id: "send-email" },
//   { event: "system/email.send" },
//   async ({ event, step }) => {
//     const { to, subject, body, html, name, type } = event.data;

//     const result = await step.run("send-email-via-nodemailer", async () => {
//       return await sendEmail({
//         to,
//         subject,
//         text: body,
//         html: html || body,
//         name,
//         type,
//       });
//     });

//     return { success: true, messageId: result.messageId };
//   },
// );
