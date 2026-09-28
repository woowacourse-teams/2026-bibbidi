import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { CurrentUserApiError, getCurrentUser } from "./api/getCurrentUser";
import {
  clearWebAccessToken,
  hasWebAccessToken,
  refreshWebSession,
  subscribeAuthenticationRequired,
} from "../../infrastructure/auth/webSessionManager";
import { WebSessionExpiredError } from "../../infrastructure/auth/webSessionApi";
import { AuthState, CurrentUser } from "./model/auth";

interface AuthContextValue {
  authState: AuthState;
  beginAuthentication: (user: CurrentUser) => void;
  beginOnboarding: () => void;
  completeAuthentication: (user: CurrentUser) => void;
  endAuthentication: () => void;
  failAuthentication: (user: CurrentUser) => void;
  requireAccountSetup: (user: CurrentUser) => void;
  refreshAuth: () => void;
}

interface AuthProviderProps {
  children: ReactNode;
}

type AuthenticationSynchronizationResult =
  | { status: "guest" }
  | { status: "onboardingRequired" }
  | { status: "user"; user: CurrentUser };

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });
  const [requestRevision, setRequestRevision] = useState(0);
  const authRevisionRef = useRef(0);
  const currentUserControllerRef = useRef<AbortController | null>(null);

  const invalidateCurrentUserRequest = useCallback(() => {
    authRevisionRef.current += 1;
    currentUserControllerRef.current?.abort();
    currentUserControllerRef.current = null;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const authRevision = authRevisionRef.current;
    currentUserControllerRef.current = controller;
    let isActive = true;

    const synchronizeAuthentication = async () => {
      let retryUnauthorized = true;

      if (!hasWebAccessToken()) {
        try {
          const session = await refreshWebSession();

          if (session.termsAgreementRequired) {
            return { status: "onboardingRequired" } as const;
          }
        } catch (error) {
          if (!(error instanceof WebSessionExpiredError)) {
            throw error;
          }

          // refresh cookie가 없는 동안에는 기존 JSESSIONID 사용자를 한 번 확인한다.
          // 이미 실패한 refresh를 현재 사용자 401에서 반복하지 않는다.
          retryUnauthorized = false;
        }
      }

      return {
        status: "user",
        user: await getCurrentUser(controller.signal, retryUnauthorized),
      } satisfies AuthenticationSynchronizationResult;
    };

    synchronizeAuthentication()
      .then((result) => {
        if (isActive && authRevisionRef.current === authRevision) {
          if (result.status === "user") {
            setAuthState({ status: "synchronizing", user: result.user });
            return;
          }

          setAuthState({ status: result.status });
        }
      })
      .catch((error: unknown) => {
        if (!isActive || authRevisionRef.current !== authRevision) {
          return;
        }

        const isAuthenticationRequired =
          error instanceof CurrentUserApiError &&
          error.status === 401 &&
          error.errorCode === 201;
        const isSessionUserMissing =
          error instanceof CurrentUserApiError &&
          error.status === 404 &&
          error.errorCode === 301;

        if (isAuthenticationRequired || isSessionUserMissing) {
          setAuthState({ status: "guest" });
          return;
        }

        setAuthState({ status: "error" });
      });

    return () => {
      isActive = false;
      controller.abort();
      if (currentUserControllerRef.current === controller) {
        currentUserControllerRef.current = null;
      }
    };
  }, [requestRevision]);

  useEffect(
    () =>
      subscribeAuthenticationRequired(() => {
        invalidateCurrentUserRequest();
        setAuthState({ status: "guest" });
      }),
    [invalidateCurrentUserRequest],
  );

  const beginAuthentication = useCallback(
    (user: CurrentUser) => {
      invalidateCurrentUserRequest();
      setAuthState({ status: "synchronizing", user });
    },
    [invalidateCurrentUserRequest],
  );

  const beginOnboarding = useCallback(() => {
    invalidateCurrentUserRequest();
    setAuthState({ status: "onboardingRequired" });
  }, [invalidateCurrentUserRequest]);

  const completeAuthentication = useCallback((user: CurrentUser) => {
    setAuthState((currentState) => {
      if (
        currentState.status !== "synchronizing" ||
        currentState.user.nickname !== user.nickname
      ) {
        return currentState;
      }

      return { status: "authenticated", user };
    });
  }, []);

  const requireAccountSetup = useCallback((user: CurrentUser) => {
    setAuthState((currentState) => {
      if (
        currentState.status !== "synchronizing" ||
        currentState.user.nickname !== user.nickname
      ) {
        return currentState;
      }

      return { status: "accountSetupRequired", user };
    });
  }, []);

  const failAuthentication = useCallback((user: CurrentUser) => {
    setAuthState((currentState) => {
      if (
        currentState.status !== "synchronizing" ||
        currentState.user.nickname !== user.nickname
      ) {
        return currentState;
      }

      return { status: "error" };
    });
  }, []);

  const endAuthentication = useCallback(() => {
    invalidateCurrentUserRequest();
    clearWebAccessToken();
    setAuthState({ status: "guest" });
  }, [invalidateCurrentUserRequest]);

  const refreshAuth = useCallback(() => {
    invalidateCurrentUserRequest();
    setAuthState({ status: "loading" });
    setRequestRevision((currentRevision) => currentRevision + 1);
  }, [invalidateCurrentUserRequest]);

  const contextValue = useMemo(
    () => ({
      authState,
      beginAuthentication,
      beginOnboarding,
      completeAuthentication,
      endAuthentication,
      failAuthentication,
      requireAccountSetup,
      refreshAuth,
    }),
    [
      authState,
      beginAuthentication,
      beginOnboarding,
      completeAuthentication,
      endAuthentication,
      failAuthentication,
      requireAccountSetup,
      refreshAuth,
    ],
  );

  let content = children;

  if (authState.status === "error") {
    content = (
      <main>
        <p role="alert">로그인 상태를 확인하지 못했습니다.</p>
        <button onClick={refreshAuth} type="button">
          다시 시도
        </button>
      </main>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>{content}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth는 AuthProvider 안에서 사용해야 합니다.");
  }

  return context;
}
