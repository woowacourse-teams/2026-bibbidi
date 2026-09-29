import { useCallback, useLayoutEffect, useRef } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";

import { AppHeaderSummaryFeature } from "../features/app-header";
import { useAuth, useLogout } from "../features/auth";
import { FeedbackFeature } from "../features/feedback";
import { AppBottomNavigation } from "./AppBottomNavigation";
import { AppHeader } from "./AppHeader";
import "./ServiceLayout.css";

export function ServiceLayout() {
  const { authState, endAuthentication, refreshAuth } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const handleLogoutSuccess = useCallback(() => {
    endAuthentication();
    navigate("/", { replace: true });
  }, [endAuthentication, navigate]);
  const logout = useLogout({ onSuccess: handleLogoutSuccess });
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [pathname]);

  if (authState.status === "onboardingRequired") {
    return <Navigate replace to="/onboarding" />;
  }

  if (authState.status === "accountSetupRequired") {
    return <Navigate replace to="/onboarding/account" />;
  }

  return (
    <div className="service-layout">
      <div className="service-layout__header">
        <AppHeader
          user={
            authState.status === "authenticated"
              ? {
                  kind: "authenticated",
                  summary: (
                    <AppHeaderSummaryFeature
                      onAuthenticationRequired={refreshAuth}
                    />
                  ),
                  isLoggingOut: logout.isLoggingOut,
                  logoutErrorMessage: logout.errorMessage,
                  onLogout: logout.submit,
                  userInitial: authState.user.nickname.charAt(0),
                }
              : authState.status === "guest"
                ? { kind: "guest" }
                : { kind: "pending" }
          }
        />
      </div>

      <div
        className="service-layout__content"
        data-page-scroll-container
        ref={contentRef}
      >
        <Outlet />
      </div>

      <div className="service-layout__mobile-dock">
        <AppBottomNavigation />
        <FeedbackFeature />
      </div>
    </div>
  );
}
