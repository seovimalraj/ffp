import { inngest } from "../client.js";

export const testCron = inngest.createFunction(
  { id: "test-cron" },
  { cron: "* * * * *" },

  async ({ step }) => {
    await step.run("task-1", async () => {
      // Your code here (task should take less than 10 seconds)
      console.log("Running task at 0s");
    });

    // Sleep for 10 seconds and run again
    await step.sleep("wait-10s-1", "10s");
    await step.run("task-2", async () => {
      console.log("Running task at 10s");
    });

    // Sleep for another 10 seconds and run again
    await step.sleep("wait-10s-2", "10s");
    await step.run("task-3", async () => {
      console.log("Running task at 20s");
    });
  },
);
