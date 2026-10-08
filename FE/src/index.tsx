import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";

import { AppPageViewTracker } from "./app/analytics/AppPageViewTracker";
import { router } from "./app/router";
import { AuthProvider } from "./features/auth";
import { ChecklistMigrationProvider } from "./features/checklist-migration";
import { analytics } from "./infrastructure/analytics";
import { preventLinkDrag } from "./infrastructure/browser/preventLinkDrag";
import {
  initializeErrorTracking,
  reportHandledError,
} from "./infrastructure/error-tracking";
import "./styles/colors.css";
import "./index.css";

document.addEventListener("dragstart", preventLinkDrag);
initializeErrorTracking();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("React를 마운트할 #root 요소를 찾을 수 없습니다.");
}

analytics.initialize();

createRoot(rootElement, {
  onCaughtError: (error) =>
    reportHandledError(error, {
      feature: "app",
      operation: "render",
      level: "fatal",
    }),
  onUncaughtError: (error) =>
    reportHandledError(error, {
      feature: "app",
      operation: "render",
      level: "fatal",
    }),
}).render(
  <StrictMode>
    <AuthProvider>
      <ChecklistMigrationProvider>
        <AppPageViewTracker
          analytics={analytics}
          landingPage={{
            pathname: window.location.pathname,
            search: window.location.search,
            referrer: document.referrer,
          }}
          origin={window.location.origin}
          router={router}
        >
          <RouterProvider router={router} />
        </AppPageViewTracker>
      </ChecklistMigrationProvider>
    </AuthProvider>
  </StrictMode>,
);
