import { useCallback } from "react";
import { useNavigate } from "react-router";

import {
  AccountSetupFeature,
  clearAccountSetupProgress,
} from "../features/account-setup";
import { useAuth, useLogout } from "../features/auth";

export function AccountSetupPage() {
  const navigate = useNavigate();
  const { beginOnboarding, endAuthentication, refreshAuth } = useAuth();

  const handleAuthenticationExpired = useCallback(() => {
    clearAccountSetupProgress();
    endAuthentication();
    navigate("/login", { replace: true });
  }, [endAuthentication, navigate]);

  const handleSuccess = useCallback(() => {
    clearAccountSetupProgress();
    refreshAuth();
    navigate("/", { replace: true });
  }, [navigate, refreshAuth]);

  const handleTermsRequired = useCallback(() => {
    beginOnboarding();
    navigate("/onboarding", { replace: true });
  }, [beginOnboarding, navigate]);

  const switchAccount = useLogout({ onSuccess: handleAuthenticationExpired });

  return (
    <AccountSetupFeature
      isSwitchingAccount={switchAccount.isLoggingOut}
      onAuthenticationExpired={handleAuthenticationExpired}
      onSuccess={handleSuccess}
      onSwitchAccount={switchAccount.submit}
      onTermsRequired={handleTermsRequired}
      switchAccountErrorMessage={switchAccount.errorMessage}
    />
  );
}
