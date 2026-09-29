import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { analytics } from "../../../infrastructure/analytics";
import {
  createSocialLoginEvent,
  socialLoginFailureKind,
} from "../analytics/socialLoginAnalytics";

import { completeSocialLogin, SocialLoginApiError } from "../api/socialLogin";
import {
  isConnectedSocialProvider,
  readSocialLoginCallbackParams,
  SocialLoginSession,
} from "../model/socialLogin";
import "./SocialLoginCallback.css";

type CallbackState =
  | { status: "pending" }
  | { status: "success"; termsAgreementRequired: boolean }
  | { status: "failure"; message: string };

const INVALID_CALLBACK_MESSAGE =
  "로그인 결과를 확인하지 못했어요. 다시 시도해 주세요.";

interface SocialLoginCallbackProps {
  loginLink: ReactNode;
  onSuccess?: (session: SocialLoginSession) => void;
  provider: string;
  search: string;
}

export function SocialLoginCallback({
  loginLink,
  onSuccess,
  provider,
  search,
}: SocialLoginCallbackProps) {
  const params = useMemo(() => readSocialLoginCallbackParams(search), [search]);
  const canRequest =
    isConnectedSocialProvider(provider) && params.status === "ready";
  const [callbackState, setCallbackState] = useState<CallbackState>(() =>
    canRequest
      ? { status: "pending" }
      : { status: "failure", message: INVALID_CALLBACK_MESSAGE },
  );
  // 인가 코드는 한 번만 쓸 수 있어 개발 모드에서 effect가 두 번 돌아도 한 번만 보낸다.
  const hasRequestedRef = useRef(false);

  useEffect(() => {
    if (hasRequestedRef.current) {
      return;
    }
    hasRequestedRef.current = true;
    if (params.status === "invalid" || !canRequest) {
      const cancelled =
        new URLSearchParams(search).get("error") === "access_denied";
      analytics.track(
        createSocialLoginEvent("social_login_callback_failed", provider, {
          failure_kind: cancelled ? "cancelled" : "invalid_callback",
        }),
      );
      return;
    }

    completeSocialLogin(provider, params.code, params.state)
      .then((session) => {
        analytics.track(
          createSocialLoginEvent("social_login_callback_complete", provider, {
            terms_required: session.termsAgreementRequired,
          }),
        );
        onSuccess?.(session);
        setCallbackState({
          status: "success",
          termsAgreementRequired: session.termsAgreementRequired,
        });
      })
      .catch((error: unknown) => {
        analytics.track(
          createSocialLoginEvent("social_login_callback_failed", provider, {
            failure_kind: socialLoginFailureKind(error),
          }),
        );
        setCallbackState({
          status: "failure",
          message:
            error instanceof SocialLoginApiError
              ? error.message
              : INVALID_CALLBACK_MESSAGE,
        });
      });
  }, [canRequest, onSuccess, params, provider, search]);

  if (callbackState.status === "pending") {
    return (
      <p className="social-login-callback__message" role="status">
        로그인하고 있어요.
      </p>
    );
  }

  if (callbackState.status === "failure") {
    return (
      <div className="social-login-callback">
        <p className="social-login-callback__error" role="alert">
          {callbackState.message}
        </p>
        {loginLink}
      </div>
    );
  }

  return (
    <div className="social-login-callback">
      <p className="social-login-callback__message" role="status">
        {callbackState.termsAgreementRequired
          ? "가입을 시작했어요. 약관 동의 화면은 준비 중이에요."
          : "로그인했어요."}
      </p>
      {loginLink}
    </div>
  );
}
