import {
  requestWebSessionRefresh,
  WebSessionExpiredError,
  WebSessionRefreshError,
  WebSessionResponse,
} from "./webSessionApi";

const REFRESH_BEFORE_EXPIRATION_MS = 60_000;

interface StoredAccessToken {
  value: string;
  expiresAt: number | null;
}

interface RefreshTask {
  controller: AbortController;
  promise: Promise<WebSessionResponse>;
}

interface WebAuthSessionState {
  authenticationRequiredListeners: Set<() => void>;
  refreshTask: RefreshTask | null;
  refreshTimer: ReturnType<typeof setTimeout> | null;
  revision: number;
  storedAccessToken: StoredAccessToken | null;
}

const webAuthSessionStates = new WeakMap<object, WebAuthSessionState>();

function currentEnvironment(): object {
  return typeof window === "undefined" ? globalThis : window;
}

function currentWebAuthSessionState(): WebAuthSessionState {
  const environment = currentEnvironment();
  const existingState = webAuthSessionStates.get(environment);

  if (existingState) {
    return existingState;
  }

  const state: WebAuthSessionState = {
    authenticationRequiredListeners: new Set(),
    refreshTask: null,
    refreshTimer: null,
    revision: 0,
    storedAccessToken: null,
  };
  webAuthSessionStates.set(environment, state);
  return state;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
}

function readAccessTokenPayload(
  accessToken: string,
): Record<string, unknown> | null {
  const payload = accessToken.split(".")[1];

  if (!payload) {
    return null;
  }

  try {
    const decoded = JSON.parse(decodeBase64Url(payload)) as unknown;

    return isRecord(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function readAccessTokenExpiration(accessToken: string): number | null {
  const payload = readAccessTokenPayload(accessToken);
  return payload && typeof payload.exp === "number"
    ? payload.exp * 1_000
    : null;
}

export function webUserIdFromAccessToken(accessToken: string): string | null {
  const payload = readAccessTokenPayload(accessToken);
  return payload && typeof payload.sub === "string" && payload.sub
    ? payload.sub
    : null;
}

function cancelScheduledRefresh(state: WebAuthSessionState) {
  if (state.refreshTimer !== null) {
    clearTimeout(state.refreshTimer);
    state.refreshTimer = null;
  }
}

function invalidateRefreshTask(state: WebAuthSessionState) {
  state.revision += 1;
  state.refreshTask?.controller.abort();
  state.refreshTask = null;
}

function clearWebAccessTokenForState(state: WebAuthSessionState) {
  invalidateRefreshTask(state);
  state.storedAccessToken = null;
  cancelScheduledRefresh(state);
}

function notifyAuthenticationRequired(state: WebAuthSessionState) {
  state.authenticationRequiredListeners.forEach((listener) => listener());
}

function scheduleRefresh(state: WebAuthSessionState, expiresAt: number | null) {
  cancelScheduledRefresh(state);

  if (expiresAt === null) {
    return;
  }

  const delay = Math.max(
    expiresAt - Date.now() - REFRESH_BEFORE_EXPIRATION_MS,
    0,
  );
  state.refreshTimer = setTimeout(() => {
    state.refreshTimer = null;
    void refreshWebSessionForState(state).catch((error: unknown) => {
      if (error instanceof WebSessionExpiredError) {
        notifyAuthenticationRequired(state);
      }
    });
  }, delay);
}

function storeWebAccessToken(
  state: WebAuthSessionState,
  accessToken: string,
): void {
  const expiresAt = readAccessTokenExpiration(accessToken);
  state.storedAccessToken = { value: accessToken, expiresAt };
  scheduleRefresh(state, expiresAt);
}

export function acceptWebAccessToken(accessToken: string): void {
  const state = currentWebAuthSessionState();
  invalidateRefreshTask(state);
  storeWebAccessToken(state, accessToken);
}

export function clearWebAccessToken(): void {
  clearWebAccessTokenForState(currentWebAuthSessionState());
}

export function hasWebAccessToken(): boolean {
  return currentWebAuthSessionState().storedAccessToken !== null;
}

export function currentWebUserId(): string | null {
  const currentToken = currentWebAuthSessionState().storedAccessToken;
  return currentToken ? webUserIdFromAccessToken(currentToken.value) : null;
}

export function subscribeAuthenticationRequired(
  listener: () => void,
): () => void {
  const state = currentWebAuthSessionState();
  state.authenticationRequiredListeners.add(listener);
  return () => state.authenticationRequiredListeners.delete(listener);
}

function refreshWebSessionForState(
  state: WebAuthSessionState,
): Promise<WebSessionResponse> {
  if (state.refreshTask) {
    return state.refreshTask.promise;
  }

  const controller = new AbortController();
  const revision = state.revision;
  const promise = requestWebSessionRefresh(controller.signal)
    .then((session) => {
      if (state.revision !== revision) {
        throw new WebSessionRefreshError(null, "aborted");
      }

      storeWebAccessToken(state, session.accessToken);
      return session;
    })
    .catch((error: unknown) => {
      if (
        error instanceof WebSessionExpiredError &&
        state.revision === revision
      ) {
        state.storedAccessToken = null;
        cancelScheduledRefresh(state);
      }

      throw error;
    })
    .finally(() => {
      if (state.refreshTask?.promise === promise) {
        state.refreshTask = null;
      }
    });
  state.refreshTask = { controller, promise };
  return promise;
}

export function refreshWebSession(): Promise<WebSessionResponse> {
  return refreshWebSessionForState(currentWebAuthSessionState());
}

async function refreshAccessTokenForRequest(
  state: WebAuthSessionState,
  currentToken: StoredAccessToken,
): Promise<string> {
  try {
    return (await refreshWebSessionForState(state)).accessToken;
  } catch (error) {
    if (error instanceof WebSessionExpiredError) {
      notifyAuthenticationRequired(state);
    }

    if (
      error instanceof WebSessionRefreshError &&
      error.reason !== "aborted" &&
      currentToken.expiresAt !== null &&
      currentToken.expiresAt > Date.now()
    ) {
      return currentToken.value;
    }

    throw error;
  }
}

export function accessTokenForRequest(): string | null | Promise<string> {
  const state = currentWebAuthSessionState();
  const currentToken = state.storedAccessToken;

  if (!currentToken || currentToken.expiresAt === null) {
    return currentToken?.value ?? null;
  }

  if (currentToken.expiresAt - Date.now() > REFRESH_BEFORE_EXPIRATION_MS) {
    return currentToken.value;
  }

  return refreshAccessTokenForRequest(state, currentToken);
}

export function expireWebAuthentication(): void {
  const state = currentWebAuthSessionState();
  clearWebAccessTokenForState(state);
  notifyAuthenticationRequired(state);
}

export function resetWebAuthSessionForTest(): void {
  const state = currentWebAuthSessionState();
  clearWebAccessTokenForState(state);
  state.authenticationRequiredListeners.clear();
}
