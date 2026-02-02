import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'workflow-service',
  eventKey: process.env.INNGEST_EVENT_KEY,
  // Point to the Inngest Dev Server (default port 8288) or custom URL
  eventAPI: process.env.INNGEST_SERVICE_URL
    ? { baseURL: process.env.INNGEST_SERVICE_URL }
    : process.env.NODE_ENV !== 'production'
      ? { baseURL: 'http://127.0.0.1:8288' }
      : undefined,
});
