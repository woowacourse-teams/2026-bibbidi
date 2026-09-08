import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { CurrentUserApiError, getCurrentUser } from "./api/getCurrentUser";
import { AuthState, CurrentUser } from "./model/auth";

interface AuthContextValue {
  authState: AuthState;
  setAuthenticatedUser: (user: CurrentUser) => void;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });
  const [requestRevision, setRequestRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    getCurrentUser(controller.signal)
      .then((user) => {
        if (isActive) {
          setAuthState({ status: "authenticated", user });
        }
      })
      .catch((error: unknown) => {
        if (!isActive) {
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
    };
  }, [requestRevision]);

  const setAuthenticatedUser = useCallback((user: CurrentUser) => {
    setAuthState({ status: "authenticated", user });
  }, []);

  const retry = useCallback(() => {
    setAuthState({ status: "loading" });
    setRequestRevision((currentRevision) => currentRevision + 1);
  }, []);

  const contextValue = useMemo(
    () => ({ authState, setAuthenticatedUser }),
    [authState, setAuthenticatedUser],
  );

  let content = children;

  if (authState.status === "error") {
    content = (
      <main>
        <p role="alert">로그인 상태를 확인하지 못했습니다.</p>
        <button onClick={retry} type="button">
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
