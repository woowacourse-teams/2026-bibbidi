import { createBrowserRouter, Navigate, RouteObject } from "react-router";

import { AuthLayout } from "../layouts/AuthLayout";
import { ServiceLayout } from "../layouts/ServiceLayout";
import { HomeEntryPage } from "../pages/HomeEntryPage";
import { PreparationCatalogPage } from "../pages/PreparationCatalogPage";

export const appRoutes: RouteObject[] = [
  {
    path: "/landing",
    lazy: async () => {
      const { LandingPage } = await import("../pages/LandingPage");
      return { Component: LandingPage };
    },
  },
  {
    Component: ServiceLayout,
    children: [
      {
        path: "/",
        Component: HomeEntryPage,
      },
      {
        path: "/preparation",
        Component: PreparationCatalogPage,
      },
      {
        path: "/calendar",
        lazy: async () => ({
          Component: (await import("../pages/CalendarPage")).CalendarPage,
        }),
      },
      {
        path: "/checklist",
        lazy: async () => ({
          Component: (await import("../pages/ChecklistPage")).ChecklistPage,
        }),
      },
    ],
  },
  {
    Component: AuthLayout,
    children: [
      {
        path: "/login",
        lazy: async () => ({
          Component: (await import("../pages/LoginPage")).LoginPage,
        }),
      },
      {
        path: "/signup",
        element: <Navigate replace to="/login" />,
      },
      {
        path: "/onboarding",
        lazy: async () => ({
          Component: (await import("../pages/OnboardingPage")).OnboardingPage,
        }),
      },
      {
        path: "/onboarding/account",
        lazy: async () => ({
          Component: (await import("../pages/AccountSetupPage"))
            .AccountSetupPage,
        }),
      },
      {
        // 소셜 제공자가 로그인 뒤 돌려보내는 주소다. 제공자 콘솔의 리다이렉트 URI와 같아야 한다.
        path: "/auth/:provider",
        lazy: async () => ({
          Component: (await import("../pages/SocialLoginCallbackPage"))
            .SocialLoginCallbackPage,
        }),
      },
    ],
  },
  {
    path: "*",
    element: <Navigate replace to="/" />,
  },
];

export const router = createBrowserRouter(appRoutes);
