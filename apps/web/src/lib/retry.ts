export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number; // initial backoff
  factor?: number; // backoff multiplier
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

export async function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? 2;
  const base = opts.baseDelayMs ?? 300;
  const factor = opts.factor ?? 2;
  const shouldRetry = opts.shouldRetry ?? (() => true);

  let attempt = 0;
  let lastError: unknown;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === retries || !shouldRetry(err, attempt)) break;
      const delay = base * Math.pow(factor, attempt);
      await sleep(delay);
      attempt += 1;
    }
  }
  // Re-throw last error if all attempts failed
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
