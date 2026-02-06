// Only run cron jobs in production to avoid cluttering local dev/branch environments
export const cron = process.env.NODE_ENV === "production" ? [] : [];
