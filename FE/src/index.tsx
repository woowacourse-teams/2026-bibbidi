import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";

import { router } from "./app/router";
import { AuthProvider } from "./features/auth";
import { analytics } from "./infrastructure/analytics";
import "./styles/colors.css";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("React를 마운트할 #root 요소를 찾을 수 없습니다.");
}

analytics.initialize();

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
