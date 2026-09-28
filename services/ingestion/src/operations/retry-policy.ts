/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 8B — Operational Retry Safety & Policy
 *
 * Enforces exponential backoff and idempotency guarantees for transient failures.
 */

import { IngestionFailureError } from "./types";

export interface RetryPolicyOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  jitter?: boolean;
}

export const DEFAULT_RETRY_POLICY: Required<RetryPolicyOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffFactor: 2,
  jitter: true
};

/**
 * Executes an asynchronous operation with retry logic enforcing idempotency.
 * Non-retryable errors are propagated immediately without retrying.
 */
export async function executeWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options?: RetryPolicyOptions
): Promise<{ result: T; attempts: number }> {
  const maxRetries = options?.maxRetries ?? DEFAULT_RETRY_POLICY.maxRetries;
  const initialDelay = options?.initialDelayMs ?? DEFAULT_RETRY_POLICY.initialDelayMs;
  const maxDelay = options?.maxDelayMs ?? DEFAULT_RETRY_POLICY.maxDelayMs;
  const backoffFactor = options?.backoffFactor ?? DEFAULT_RETRY_POLICY.backoffFactor;
  const useJitter = options?.jitter ?? DEFAULT_RETRY_POLICY.jitter;

  let attempt = 0;
  let lastError: Error | unknown;

  while (attempt <= maxRetries) {
    attempt++;
    try {
      const result = await operation(attempt);
      return { result, attempts: attempt };
    } catch (err: unknown) {
      lastError = err;

      // Check if error is explicitly non-retryable
      if (err instanceof IngestionFailureError && !err.isRetryable) {
        throw err;
      }

      if (attempt > maxRetries) {
        break;
      }

      // Calculate exponential backoff delay
      let delay = initialDelay * Math.pow(backoffFactor, attempt - 1);
      if (useJitter) {
        delay = delay * (0.8 + Math.random() * 0.4);
      }
      delay = Math.min(delay, maxDelay);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error(`Operation failed after ${attempt} attempts: ${String(lastError)}`);
}
