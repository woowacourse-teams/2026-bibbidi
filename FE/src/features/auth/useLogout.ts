import { useCallback, useEffect, useRef, useState } from "react";

import { analytics } from "../../infrastructure/analytics";
import { createLogoutEvent } from "./analytics/authAnalytics";
import {
  logout,
  LogoutNetworkError,
  LogoutRequestAbortedError,
  LogoutTimeoutError,
} from "./api/logout";

interface UseLogoutOptions {
  onSuccess: () => void;
}

export function useLogout({ onSuccess }: UseLogoutOptions) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      requestRef.current?.abort();
    };
  }, []);

  const submit = useCallback(async () => {
    if (requestRef.current) {
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    setIsLoggingOut(true);
    setErrorMessage(null);

    try {
      await logout(controller.signal);

      if (isMountedRef.current && !controller.signal.aborted) {
        onSuccess();
        analytics.track(createLogoutEvent());
      }
    } catch (error) {
      if (
        !isMountedRef.current ||
        controller.signal.aborted ||
        error instanceof LogoutRequestAbortedError
      ) {
        return;
      }

      if (error instanceof LogoutNetworkError) {
        setErrorMessage("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
      } else if (error instanceof LogoutTimeoutError) {
        setErrorMessage("요청 시간이 초과됐습니다. 다시 시도해 주세요.");
      } else {
        setErrorMessage("로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;

        if (isMountedRef.current) {
          setIsLoggingOut(false);
        }
      }
    }
  }, [onSuccess]);

  return { errorMessage, isLoggingOut, submit };
}
