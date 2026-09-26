import { useCallback } from "react";
import { useNavigate } from "react-router";

import { useAuth, useLogout } from "../features/auth";
import { OnboardingFeature } from "../features/onboarding/OnboardingFeature";

export function OnboardingPage() {
  const navigate = useNavigate();
  const { endAuthentication, refreshAuth } = useAuth();

  const handleAuthenticationExpired = useCallback(() => {
    endAuthentication();
    navigate("/login", { replace: true });
  }, [endAuthentication, navigate]);

  const handleSuccess = useCallback(() => {
    refreshAuth();
    navigate("/", { replace: true });
  }, [navigate, refreshAuth]);
  const switchAccount = useLogout({ onSuccess: handleAuthenticationExpired });

  return (
    <OnboardingFeature
      isSwitchingAccount={switchAccount.isLoggingOut}
      onAuthenticationExpired={handleAuthenticationExpired}
      onSuccess={handleSuccess}
      onSwitchAccount={switchAccount.submit}
      switchAccountErrorMessage={switchAccount.errorMessage}
    />
  );
}
