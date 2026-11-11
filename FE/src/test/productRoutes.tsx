import { OnboardingPage } from "../screens/OnboardingPage";
import { ChecklistPage } from "../screens/ChecklistPage";
import { CalendarPage } from "../screens/CalendarPage";
import { AiChatPage } from "../screens/AiChatPage";
import { LandingPage } from "../screens/LandingPage";
import { BalanceGamePage } from "../screens/BalanceGamePage";
import { Outlet, useParams, type RouteObject } from "./memoryNavigation";

import {
  LoginModalLayout,
  LegacyLoginRedirect,
} from "../features/social-login/view/LoginModal";

import { ServiceLayout } from "../layouts/ServiceLayout";
import { SocialLoginCallbackPage } from "../screens/SocialLoginCallbackPage";
import { PreparationCatalogPage } from "../screens/PreparationCatalogPage";

const pageRoutes: RouteObject[] = [
  { path: "/login", Component: LegacyLoginRedirect },
  { path: "/signup", Component: LegacyLoginRedirect },
  {
    element: (
      <ServiceLayout showNavigationDock={false}>
        <Outlet />
      </ServiceLayout>
    ),
    children: [
      {
        path: "/balance-game",
        Component: BalanceGamePage,
      },
    ],
  },
  {
    path: "/landing",
    Component: LandingPage,
  },
  {
    element: (
      <ServiceLayout>
        <Outlet />
      </ServiceLayout>
    ),
    children: [
      {
        path: "/ai-chat",
        Component: AiChatPage,
      },
      {
        path: "/",
        Component: PreparationCatalogPage,
      },
      {
        path: "/preparation",
        Component: PreparationCatalogPage,
      },
      {
        path: "/calendar",
        Component: CalendarPage,
      },
      {
        path: "/checklist",
        Component: ChecklistPage,
      },
    ],
  },
  {
    path: "/onboarding",
    Component: OnboardingPage,
  },
  {
    path: "/onboarding/account",
    Component: OnboardingPage,
  },
  {
    // This URL must continue to match the redirect URI registered with the provider.
    path: "/auth/:provider",
    Component: TestSocialLoginCallbackPage,
  },
  {
    path: "*",
    element: <h1>페이지를 찾을 수 없어요.</h1>,
  },
];

export const appRoutes: RouteObject[] = [
  {
    element: (
      <LoginModalLayout>
        <Outlet />
      </LoginModalLayout>
    ),
    children: pageRoutes,
  },
];

export function TestSocialLoginCallbackPage() {
  return <SocialLoginCallbackPage provider={useParams().provider ?? ""} />;
}
