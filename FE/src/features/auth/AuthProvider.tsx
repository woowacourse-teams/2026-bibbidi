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
import { AuthState, CurrentUser } from "./model/auth";

interface AuthContextValue {
  authState: AuthState;
  beginAuthentication: (user: CurrentUser) => void;
  completeAuthentication: (user: CurrentUser) => void;
  endAuthentication: () => void;
  refreshAuth: () => void;
}

interface AuthProviderProps {
  children: ReactNode;
}

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

    getCurrentUser(controller.signal)
      .then((user) => {
        if (isActive && authRevisionRef.current === authRevision) {
          setAuthState({ status: "synchronizing", user });
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

  const beginAuthentication = useCallback(
    (user: CurrentUser) => {
      invalidateCurrentUserRequest();
      setAuthState({ status: "synchronizing", user });
    },
    [invalidateCurrentUserRequest],
  );

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

  const endAuthentication = useCallback(() => {
    invalidateCurrentUserRequest();
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
      completeAuthentication,
      endAuthentication,
      refreshAuth,
    }),
    [
      authState,
      beginAuthentication,
      completeAuthentication,
      endAuthentication,
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
