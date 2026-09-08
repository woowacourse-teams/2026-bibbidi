import { useLayoutEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router";

import { AppHeaderSummaryFeature } from "../features/app-header";
import { FeedbackFeature } from "../features/feedback";
import { AppBottomNavigation } from "./AppBottomNavigation";
import { AppHeader } from "./AppHeader";
import "./ServiceLayout.css";

export function ServiceLayout() {
  const { pathname } = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [pathname]);

  return (
    <div className="service-layout">
      <AppHeader
        user={{
          kind: "authenticated",
          summary: <AppHeaderSummaryFeature />,
          userInitial: "나",
        }}
      />

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
