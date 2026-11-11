import type { ReactNode } from "react";
import { Navigate, useLocation } from "../app/navigation/navigation";

import { AppLayout } from "../components/app-layout";
import { getSafeLoginReturnPath, useAuth } from "../features/auth";
import { BrandHeader } from "./BrandHeader";
import "./AuthLayout.css";

export function AuthLayout({ children }: { children?: ReactNode }) {
  const { authState } = useAuth();
  const { pathname, search } = useLocation();
  const isOnboardingPath =
    pathname === "/onboarding" || pathname === "/onboarding/account";

  if (authState.status === "authenticated") {
    return <Navigate replace to={getSafeLoginReturnPath(search) ?? "/"} />;
  }

  if (authState.status === "onboardingRequired" && pathname !== "/onboarding") {
    return <Navigate replace to="/onboarding" />;
  }

  if (authState.status === "guest" && isOnboardingPath) {
    return (
      <Navigate replace to="/" state={{ loginModal: { returnTo: "/" } }} />
    );
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
      <main className="auth-page">
        {authState.status === "loading" ||
        authState.status === "synchronizing" ? (
          <p role="status">로그인 상태를 확인하고 있습니다.</p>
        ) : (
          children
        )}
      </main>
    </AppLayout>
  );
}
