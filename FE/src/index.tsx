import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";

import { AppPageViewTracker } from "./app/analytics/AppPageViewTracker";
import { router } from "./app/router";
import { AuthProvider } from "./features/auth";
import { ChecklistMigrationProvider } from "./features/checklist-migration";
import { analytics } from "./infrastructure/analytics";
import { preventLinkDrag } from "./infrastructure/browser/preventLinkDrag";
import "./styles/colors.css";
import "./index.css";

document.addEventListener("dragstart", preventLinkDrag);

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("React를 마운트할 #root 요소를 찾을 수 없습니다.");
}

analytics.initialize();

createRoot(rootElement).render(
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
