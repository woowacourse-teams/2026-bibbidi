import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
} from "../../../app/navigation/navigation";
import { Dialog } from "../../../components/dialog";
import { IconButton } from "../../../components/icon-button";
import { useAuth } from "../../auth/AuthProvider";
import {
  getSafeLoginReturnPath,
  rememberLoginReturnPath,
  consumeLoginReturnPath,
} from "../../auth/model/loginReturnPath";
import { LoginCallbackContext, type LoginCallback } from "./callbackState";
import { useLogout } from "../../auth/useLogout";
import { OnboardingModal } from "../../onboarding/OnboardingModal";
import { SocialLoginResult } from "./SocialLoginResult";
import { SocialLoginForm } from "./SocialLoginForm";
import "./LoginModal.css";

export function LoginModalLayout({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { authState, endAuthentication } = useAuth();
  const [contentBusy, setContentBusy] = useState(false);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const modal = location.state?.loginModal;
  const [pendingCallback, setCallback] = useState<LoginCallback | null>(null);
  const callbackContext = useMemo(() => ({ setCallback }), [setCallback]);
  const callback =
    pendingCallback?.returnTo ===
    `${location.pathname}${location.search}${location.hash}`
      ? pendingCallback
      : null;
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
    setCallback(null);
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
    <LoginCallbackContext value={callbackContext}>
      {children}
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
                returnTo={callback.returnTo}
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
    </LoginCallbackContext>
  );
}

/** Keep old bookmarks and OAuth retry links working without a login page. */
export function LegacyLoginRedirect() {
  const { search } = useLocation();
  const returnTo = getSafeLoginReturnPath(search) ?? "/";
  const state = useMemo(() => ({ loginModal: { returnTo } }), [returnTo]);
  return <Navigate replace to={returnTo} state={state} />;
}
