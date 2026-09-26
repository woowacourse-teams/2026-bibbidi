import {
  MouseEvent,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";

import { AppHeaderSummaryFeature } from "../features/app-header";
import {
  createLoginPath,
  LoginRequiredDialog,
  PLANNER_RETURN_PATH,
  useAuth,
  useLogout,
} from "../features/auth";
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
  const [plannerDialogTrigger, setPlannerDialogTrigger] =
    useState<HTMLAnchorElement | null>(null);
  const isPlannerLoginDialogOpen = plannerDialogTrigger !== null;

  const handlePlannerNavigation = (event: MouseEvent<HTMLAnchorElement>) => {
    if (authState.status === "authenticated") {
      return;
    }

    event.preventDefault();

    if (authState.status === "guest") {
      setPlannerDialogTrigger(event.currentTarget);
    }
  };

  const closePlannerLoginDialog = () => setPlannerDialogTrigger(null);

  useLayoutEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [pathname]);

  if (authState.status === "onboardingRequired") {
    return <Navigate replace to="/onboarding" />;
  }

  return (
    <div className="service-layout">
      <div
        aria-hidden={isPlannerLoginDialogOpen ? true : undefined}
        className="service-layout__header"
        inert={isPlannerLoginDialogOpen ? true : undefined}
      >
        <AppHeader
          onPlannerNavigation={handlePlannerNavigation}
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
        aria-hidden={isPlannerLoginDialogOpen ? true : undefined}
        className="service-layout__content"
        data-page-scroll-container
        inert={isPlannerLoginDialogOpen ? true : undefined}
        ref={contentRef}
      >
        <Outlet />
      </div>

      <div
        aria-hidden={isPlannerLoginDialogOpen ? true : undefined}
        className="service-layout__mobile-dock"
        inert={isPlannerLoginDialogOpen ? true : undefined}
      >
        <AppBottomNavigation onPlannerNavigation={handlePlannerNavigation} />
        <FeedbackFeature />
      </div>

      {isPlannerLoginDialogOpen ? (
        <LoginRequiredDialog
          onClose={closePlannerLoginDialog}
          onLogin={() => {
            closePlannerLoginDialog();
            navigate(createLoginPath(PLANNER_RETURN_PATH));
          }}
          returnFocusTo={plannerDialogTrigger}
        />
      ) : null}
    </div>
  );
}
