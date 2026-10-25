import { Navigate, Outlet, useLocation } from "react-router";

import { AppLayout } from "../components/app-layout";
import { getSafeLoginReturnPath, useAuth } from "../features/auth";
import { BrandHeader } from "./BrandHeader";
import "./AuthLayout.css";

export function AuthLayout() {
  const { authState } = useAuth();
  const { pathname, search } = useLocation();
  const isLoginPath = pathname === "/login";
  const isOnboardingPath =
    pathname === "/onboarding" || pathname === "/onboarding/account";

  if (authState.status === "authenticated") {
    return <Navigate replace to={getSafeLoginReturnPath(search) ?? "/"} />;
  }

  if (authState.status === "onboardingRequired" && pathname !== "/onboarding") {
    return <Navigate replace to="/onboarding" />;
  }

  if (authState.status === "guest" && isOnboardingPath) {
    return <Navigate replace to="/login" />;
  }

  return (
    <AppLayout
      className="auth-layout"
      header={<BrandHeader />}
      headerPosition="sticky"
      headerTone="fade"
      scroll="document"
      hideScrollBar
    >
      <main className={`auth-page${isLoginPath ? " auth-page--login" : ""}`}>
        {authState.status === "loading" ||
        authState.status === "synchronizing" ? (
          <p role="status">로그인 상태를 확인하고 있습니다.</p>
        ) : (
          <Outlet />
        )}
      </main>
    </AppLayout>
  );
}
