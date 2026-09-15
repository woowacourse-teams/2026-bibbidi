import { useLayoutEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router";

import { AppHeaderSummaryFeature } from "../features/app-header";
import { useAuth } from "../features/auth";
import { FeedbackFeature } from "../features/feedback";
import { AppBottomNavigation } from "./AppBottomNavigation";
import { AppHeader } from "./AppHeader";
import { useIsMobileLayout } from "../shared/responsive";
import "./ServiceLayout.css";

export function ServiceLayout() {
  const { authState, refreshAuth } = useAuth();
  const { pathname, search } = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);
  const isMobileLayout = useIsMobileLayout();
  const selectedTaskId = new URLSearchParams(search).get("taskId");
  const isMobileChecklistDetailOpen =
    isMobileLayout &&
    pathname === "/checklist" &&
    selectedTaskId !== null &&
    selectedTaskId.length > 0;

  useLayoutEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [pathname]);

  return (
    <div className="service-layout">
      <div
        aria-hidden={isMobileChecklistDetailOpen ? true : undefined}
        className="service-layout__header"
        hidden={isMobileChecklistDetailOpen}
        inert={isMobileChecklistDetailOpen ? true : undefined}
      >
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
                  userInitial: authState.user.nickname.charAt(0),
                }
              : authState.status === "guest"
                ? { kind: "guest" }
                : { kind: "pending" }
          }
        />
      </div>

      <div
        className={`service-layout__content${
          isMobileChecklistDetailOpen
            ? " service-layout__content--mobile-detail"
            : ""
        }`}
        data-page-scroll-container
        ref={contentRef}
      >
        <Outlet />
      </div>

      <div
        aria-hidden={isMobileChecklistDetailOpen ? true : undefined}
        className="service-layout__mobile-dock"
        hidden={isMobileChecklistDetailOpen}
        inert={isMobileChecklistDetailOpen ? true : undefined}
      >
        <AppBottomNavigation />
        <FeedbackFeature />
      </div>
    </div>
  );
}
