import { useId, useLayoutEffect, useRef, useState } from "react";
import { Outlet, Navigate, useLocation, useNavigate } from "react-router";
import { Dialog } from "../../../components/dialog";
import { IconButton } from "../../../components/icon-button";
import { useAuth } from "../../auth/AuthProvider";
import {
  getSafeLoginReturnPath,
  rememberLoginReturnPath,
  consumeLoginReturnPath,
} from "../../auth/model/loginReturnPath";
import type { LoginModalState } from "../../auth/useLoginModal";
import { useLogout } from "../../auth/useLogout";
import { OnboardingModal } from "../../onboarding/OnboardingModal";
import { SocialLoginResult } from "./SocialLoginResult";
import { SocialLoginForm } from "./SocialLoginForm";
import "./LoginModal.css";

export function LoginModalLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { authState, endAuthentication } = useAuth();
  const [contentBusy, setContentBusy] = useState(false);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const modal = (location.state as LoginModalState | null)?.loginModal;
  const callback = modal?.callback;
  const isOnboarding = !callback && authState.status === "onboardingRequired";
  const title = isOnboarding ? "약관 동의" : "로그인";
  const open =
    isOnboarding ||
    Boolean(callback) ||
    (Boolean(modal) && authState.status === "guest");
  const step = callback ? "callback" : isOnboarding ? "terms" : "login";
  useLayoutEffect(() => {
    if (open) closeRef.current?.focus({ preventScroll: true });
  }, [step, open]);

  const dismiss = () => {
    if (modal?.hasBackground) void navigate(-1);
    else {
      const state = { ...location.state };
      delete state.loginModal;
      void navigate(location, {
        replace: true,
        state,
        preventScrollReset: true,
      });
    }
  };

  const cancelOnboarding = useLogout({
    onSuccess: () => {
      endAuthentication();
      consumeLoginReturnPath();
      dismiss();
    },
  });
  const busy = contentBusy || cancelOnboarding.isLoggingOut;
  const close = () => {
    if (busy) return;
    if (isOnboarding) void cancelOnboarding.submit();
    else dismiss();
  };

  return (
    <>
      <Outlet />
      <Dialog
        className="login-modal"
        aria-labelledby={titleId}
        open={open}
        onClose={close}
        closeOnEscape={!busy}
        closeOnDimmerClick={!busy}
        initialFocusRef={closeRef}
        title={
          <div className="login-modal__header">
            <Dialog.Title id={titleId}>{title}</Dialog.Title>
            <IconButton
              ref={closeRef}
              aria-label={`${title} 닫기`}
              disabled={busy}
              onClick={close}
              icon={
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              }
            />
          </div>
        }
        actions={null}
      >
        <div inert={cancelOnboarding.isLoggingOut || undefined}>
          {open &&
            (callback ? (
              <SocialLoginResult
                provider={callback.provider}
                search={callback.search}
                returnTo={modal?.returnTo ?? "/"}
              />
            ) : isOnboarding ? (
              <OnboardingModal onBusyChange={setContentBusy} />
            ) : (
              <SocialLoginForm
                onAuthorizationStart={() =>
                  rememberLoginReturnPath(
                    `?${new URLSearchParams({ returnTo: modal?.returnTo ?? "/" })}`,
                  )
                }
              />
            ))}
        </div>
        {cancelOnboarding.isLoggingOut && (
          <p role="status">로그인 상태 정리 중...</p>
        )}
        {isOnboarding && cancelOnboarding.errorMessage && (
          <p role="alert" className="onboarding__error">
            {cancelOnboarding.errorMessage}
          </p>
        )}
      </Dialog>
    </>
  );
}

/** Keep old bookmarks and OAuth retry links working without a login page. */
export function LegacyLoginRedirect() {
  const { search } = useLocation();
  const returnTo = getSafeLoginReturnPath(search) ?? "/";
  return (
    <Navigate replace to={returnTo} state={{ loginModal: { returnTo } }} />
  );
}
