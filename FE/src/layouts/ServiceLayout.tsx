import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";

import { AiChatFeature } from "../features/ai-chat/AiChatFeature";
import { AppLayout } from "../components/app-layout";
import { AppHeaderSummaryFeature } from "../features/app-header";
import { useAuth, useLogout } from "../features/auth";
import { FeedbackFeature } from "../features/feedback";
import { AppBottomNavigation } from "./AppBottomNavigation";
import { AppHeader } from "./AppHeader";
import "./ServiceLayout.css";
import { useReservedPanelSpace } from "./useReservedPanelSpace";
import { useIsMobileLayout } from "../shared/responsive";

export function ServiceLayout() {
  const { authState, endAuthentication, refreshAuth } = useAuth();
  const { pathname } = useLocation();
  const isMobile = useIsMobileLayout();
  const [aiKeyboardVisible, setAiKeyboardVisible] = useState(false);
  const aiContext = pathname.startsWith("/preparation")
    ? "로드맵"
    : pathname.startsWith("/checklist")
      ? "체크리스트"
      : pathname.startsWith("/calendar")
        ? "캘린더"
        : "홈";
  const aiAudience =
    authState.status === "authenticated"
      ? `authenticated:${authState.user.id}`
      : "guest";
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
      const document = layoutRef.current.ownerDocument;
      const scrollRoot = document.scrollingElement ?? document.documentElement;
      scrollRoot.scrollTop = 0;
      scrollRoot.scrollLeft = 0;
    }
  }, [pathname]);

  if (authState.status === "onboardingRequired") {
    return <Navigate replace to="/onboarding" />;
  }

  return (
    <AppLayout
      className="service-layout"
      data-modal-scope
      data-ai-keyboard-open={(isMobile && aiKeyboardVisible) || undefined}
      data-page-scroll-container
      ref={layoutRef}
      role="region"
      aria-label="서비스 화면"
      tabIndex={0}
      scroll={isMobile ? "document" : "contained"}
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
        {authState.status === "authenticated" ||
        authState.status === "guest" ? (
          <AiChatFeature
            key={aiAudience}
            contextLabel={aiContext}
            onKeyboardVisibilityChange={setAiKeyboardVisible}
            isAuthenticated={authState.status === "authenticated"}
            onAuthenticationRequired={refreshAuth}
            launcherClassName={
              isMobile ? "app-bottom-navigation__item" : undefined
            }
            renderLauncher={(launcher) => (
              <>
                <AppBottomNavigation>
                  {isMobile ? launcher : null}
                </AppBottomNavigation>
                {!isMobile && launcher}
              </>
            )}
          />
        ) : (
          <AppBottomNavigation />
        )}
        <FeedbackFeature />
      </div>
    </AppLayout>
  );
}
