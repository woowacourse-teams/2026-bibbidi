import { HttpError } from "./http-error.ts";

const MAX_ATTEMPTS = 3;
const TIMEOUT_MILLISECONDS = 120_000;

export class RetryingHttp {
  async send(url: string, options: RequestInit, label: string) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MILLISECONDS) });
        if (response.ok) return response;
        if (attempt === MAX_ATTEMPTS || (response.status < 500 && response.status !== 429)) {
          throw new HttpError(response.status, `${label} request failed with HTTP ${response.status}`);
        }
      } catch (error) {
        if (attempt === MAX_ATTEMPTS || (error instanceof HttpError && error.status < 500 && error.status !== 429)) {
          throw error;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000 * 2 ** (attempt - 1)));
    }
    throw new Error(`${label} request failed`);
  }
}
