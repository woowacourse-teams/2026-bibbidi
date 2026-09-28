import {
  accessTokenForRequest,
  expireWebAuthentication,
  refreshWebSession,
} from "../auth/webSessionManager";
import { WebSessionExpiredError } from "../auth/webSessionApi";

interface AuthenticatedFetchOptions {
  retryUnauthorized?: boolean;
}

function abortReason(signal: AbortSignal): unknown {
  return (
    signal.reason ??
    new DOMException("The operation was aborted.", "AbortError")
  );
}

function waitForCaller<T>(
  promise: Promise<T>,
  signal?: AbortSignal | null,
): Promise<T> {
  if (!signal) {
    return promise;
  }

  if (signal.aborted) {
    return Promise.reject(abortReason(signal));
  }

  return new Promise<T>((resolve, reject) => {
    const handleAbort = () => {
      signal.removeEventListener("abort", handleAbort);
      reject(abortReason(signal));
    };
    const settle = (callback: (value: T) => void) => (value: T) => {
      signal.removeEventListener("abort", handleAbort);
      callback(value);
    };

    signal.addEventListener("abort", handleAbort, { once: true });
    promise.then(settle(resolve), (error: unknown) => {
      signal.removeEventListener("abort", handleAbort);
      reject(error);
    });
  });
}

function withBearerToken(init: RequestInit | undefined, accessToken: string) {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  return { ...init, headers };
}

async function requestWithAccessToken(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  options: AuthenticatedFetchOptions,
  accessToken: string | null,
): Promise<Response> {
  const response = await fetch(
    input,
    accessToken ? withBearerToken(init, accessToken) : init,
  );

  if (
    response.status !== 401 ||
    options.retryUnauthorized === false ||
    accessToken === null
  ) {
    return response;
  }

  try {
    const refreshedSession = await waitForCaller(
      refreshWebSession(),
      init?.signal,
    );
    const retriedResponse = await fetch(
      input,
      withBearerToken(init, refreshedSession.accessToken),
    );

    if (retriedResponse.status === 401) {
      expireWebAuthentication();
    }

    return retriedResponse;
  } catch (error) {
    if (error instanceof WebSessionExpiredError) {
      expireWebAuthentication();
      return response;
    }

    throw error;
  }
}

export function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: AuthenticatedFetchOptions = {},
): Promise<Response> {
  if (init?.signal?.aborted) {
    return Promise.reject(abortReason(init.signal));
  }

  const accessToken = accessTokenForRequest();

  if (accessToken instanceof Promise) {
    return waitForCaller(accessToken, init?.signal).then((token) =>
      requestWithAccessToken(input, init, options, token),
    );
  }

  return requestWithAccessToken(input, init, options, accessToken);
}
