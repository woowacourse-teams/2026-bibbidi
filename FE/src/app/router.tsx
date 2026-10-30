import { createBrowserRouter, Navigate, RouteObject } from "react-router";

import {
  LoginModalLayout,
  LegacyLoginRedirect,
} from "../features/social-login/view/LoginModal";

import { ServiceLayout } from "../layouts/ServiceLayout";
import { HomeEntryPage } from "../pages/HomeEntryPage";
import { PreparationCatalogPage } from "../pages/PreparationCatalogPage";

const pageRoutes: RouteObject[] = [
  { path: "/login", Component: LegacyLoginRedirect },
  { path: "/signup", Component: LegacyLoginRedirect },
  {
    element: <ServiceLayout showNavigationDock={false} />,
    children: [
      {
        path: "/balance-game",
        lazy: async () => ({
          Component: (await import("../pages/BalanceGamePage")).BalanceGamePage,
        }),
      },
    ],
  },
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
    path: "/onboarding",
    lazy: async () => ({
      Component: (await import("../pages/OnboardingPage")).OnboardingPage,
    }),
  },
  {
    path: "/onboarding/account",
    lazy: async () => ({
      Component: (await import("../pages/OnboardingPage")).OnboardingPage,
    }),
  },
  {
    // This URL must continue to match the redirect URI registered with the provider.
    path: "/auth/:provider",
    lazy: async () => ({
      Component: (await import("../pages/SocialLoginCallbackPage"))
        .SocialLoginCallbackPage,
    }),
  },
  {
    path: "*",
    element: <Navigate replace to="/" />,
  },
];

export const appRoutes: RouteObject[] = [
  { Component: LoginModalLayout, children: pageRoutes },
];

export const router = createBrowserRouter(appRoutes);
