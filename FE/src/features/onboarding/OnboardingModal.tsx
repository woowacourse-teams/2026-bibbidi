import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";

import {
  consumeLoginReturnPath,
  readLoginReturnPath,
} from "../auth/model/loginReturnPath";

import { useAuth, useLogout } from "../auth";
import { OnboardingFeature } from "./OnboardingFeature";

export function OnboardingModal({
  onBusyChange,
}: {
  onBusyChange?: (busy: boolean) => void;
}) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { endAuthentication, refreshAuth } = useAuth();

  const handleAuthenticationExpired = useCallback(() => {
    endAuthentication();
    const returnTo = readLoginReturnPath() ?? `${pathname}${search}`;
    navigate(returnTo, { replace: true, state: { loginModal: { returnTo } } });
  }, [endAuthentication, navigate, pathname, search]);

  const handleSuccess = useCallback(() => {
    refreshAuth();
    navigate(consumeLoginReturnPath() ?? `${pathname}${search}`, {
      replace: true,
      state: null,
    });
  }, [navigate, refreshAuth, pathname, search]);
  const switchAccount = useLogout({ onSuccess: handleAuthenticationExpired });

  return (
    <OnboardingFeature
      onBusyChange={onBusyChange}
      isSwitchingAccount={switchAccount.isLoggingOut}
      onAuthenticationExpired={handleAuthenticationExpired}
      onSuccess={handleSuccess}
      onSwitchAccount={switchAccount.submit}
      switchAccountErrorMessage={switchAccount.errorMessage}
    />
  );
}
