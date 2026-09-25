import {
  accessTokenForRequest,
  expireWebAuthentication,
  refreshWebSession,
} from "../auth/webSessionManager";
import { WebSessionExpiredError } from "../auth/webSessionApi";

interface AuthenticatedFetchOptions {
  retryUnauthorized?: boolean;
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
    const refreshedSession = await refreshWebSession();
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
  const accessToken = accessTokenForRequest();

  if (accessToken instanceof Promise) {
    return accessToken.then((token) =>
      requestWithAccessToken(input, init, options, token),
    );
  }

  return requestWithAccessToken(input, init, options, accessToken);
}
