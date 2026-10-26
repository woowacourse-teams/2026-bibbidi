import { useCallback, useLayoutEffect, useRef } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";

import { AppLayout } from "../components/app-layout";
import { AppHeaderSummaryFeature } from "../features/app-header";
import { useAuth, useLogout } from "../features/auth";
import { FeedbackFeature } from "../features/feedback";
import { AppBottomNavigation } from "./AppBottomNavigation";
import { AppHeader } from "./AppHeader";
import "./ServiceLayout.css";
import { useReservedPanelSpace } from "./useReservedPanelSpace";

export function ServiceLayout() {
  const { authState, endAuthentication, refreshAuth } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const handleLogoutSuccess = useCallback(() => {
    endAuthentication();
    navigate("/", { replace: true });
  }, [endAuthentication, navigate]);
  const logout = useLogout({ onSuccess: handleLogoutSuccess });
  const layoutRef = useRef<HTMLDivElement>(null);
  useReservedPanelSpace(layoutRef);

  useLayoutEffect(() => {
    if (layoutRef.current) {
      layoutRef.current.scrollTop = 0;
    }
  }, [pathname]);

  if (authState.status === "onboardingRequired") {
    return <Navigate replace to="/onboarding" />;
  }

  return (
    <AppLayout
      className="service-layout"
      data-modal-scope
      data-page-scroll-container
      ref={layoutRef}
      role="region"
      aria-label="서비스 화면"
      tabIndex={0}
      scroll="contained"
      hideScrollBar
      headerPosition="sticky"
      headerTone="fade"
      header={
        <div className="service-layout__header">
          <AppHeader
            user={
              authState.status === "authenticated"
                ? {
                    kind: "authenticated",
                    summary: (
                      <AppHeaderSummaryFeature
                        navigationKey={pathname}
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
      }
    >
      <div className="service-layout__content">
        <Outlet />
      </div>

      <div className="service-layout__mobile-dock">
        <AppBottomNavigation />
        <FeedbackFeature />
      </div>
    </AppLayout>
  );
}
