import { Navigate, Outlet, useLocation } from "react-router";

import { hasAccountSetupProgress } from "../features/account-setup";
import { getSafeLoginReturnPath, useAuth } from "../features/auth";
import { BrandHeader } from "./BrandHeader";
import "./AuthLayout.css";

export function AuthLayout() {
  const { authState } = useAuth();
  const { pathname, search } = useLocation();
  const hasPendingAccountSetup = hasAccountSetupProgress();
  const isOnboardingPath =
    pathname === "/onboarding" || pathname === "/onboarding/account";
  const canUseAccountSetup =
    pathname === "/onboarding/account" && hasPendingAccountSetup;

  if (authState.status === "authenticated" && !canUseAccountSetup) {
    if (pathname === "/onboarding" && hasPendingAccountSetup) {
      return <Navigate replace to="/onboarding/account" />;
    }

    return <Navigate replace to={getSafeLoginReturnPath(search) ?? "/"} />;
  }

  if (authState.status === "onboardingRequired" && pathname !== "/onboarding") {
    return <Navigate replace to="/onboarding" />;
  }

  if (authState.status === "guest" && isOnboardingPath) {
    return <Navigate replace to="/login" />;
  }

  return (
    <div className="auth-layout">
      <BrandHeader />

      <main className="auth-page">
        {authState.status === "loading" ||
        authState.status === "synchronizing" ? (
          <p role="status">로그인 상태를 확인하고 있습니다.</p>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
