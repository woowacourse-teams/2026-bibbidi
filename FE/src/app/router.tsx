import { createBrowserRouter, Navigate, RouteObject } from "react-router";

import { PlannerAccessGuard } from "../features/auth";
import { AuthLayout } from "../layouts/AuthLayout";
import { ServiceLayout } from "../layouts/ServiceLayout";
import { ChecklistPage } from "../pages/ChecklistPage";
import { LoginPage } from "../pages/LoginPage";
import { OnboardingPage } from "../pages/OnboardingPage";
import { PlannerPage } from "../pages/PlannerPage";
import { PreparationCatalogPage } from "../pages/PreparationCatalogPage";
import { SignupPage } from "../pages/SignupPage";
import { SocialLoginCallbackPage } from "../pages/SocialLoginCallbackPage";

export const appRoutes: RouteObject[] = [
  {
    Component: ServiceLayout,
    children: [
      {
        path: "/",
        Component: PreparationCatalogPage,
      },
      {
        path: "/preparation",
        element: <Navigate replace to="/" />,
      },
      {
        Component: PlannerAccessGuard,
        children: [
          {
            path: "/planner",
            Component: PlannerPage,
          },
        ],
      },
      {
        path: "/checklist",
        Component: ChecklistPage,
      },
    ],
  },
  {
    Component: AuthLayout,
    children: [
      {
        path: "/login",
        Component: LoginPage,
      },
      {
        path: "/signup",
        Component: SignupPage,
      },
      {
        path: "/onboarding",
        Component: OnboardingPage,
      },
      {
        // 소셜 제공자가 로그인 뒤 돌려보내는 주소다. 제공자 콘솔의 리다이렉트 URI와 같아야 한다.
        path: "/auth/:provider",
        Component: SocialLoginCallbackPage,
      },
    ],
  },
  {
    path: "*",
    element: <Navigate replace to="/" />,
  },
];

export const router = createBrowserRouter(appRoutes);
