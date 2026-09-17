import { createBrowserRouter, Navigate, RouteObject } from "react-router";

import { PlannerAccessGuard } from "../features/auth";
import { AuthLayout } from "../layouts/AuthLayout";
import { ServiceLayout } from "../layouts/ServiceLayout";
import { ChecklistPage } from "../pages/ChecklistPage";
import { LoginPage } from "../pages/LoginPage";
import { PlannerPage } from "../pages/PlannerPage";
import { PreparationCatalogPage } from "../pages/PreparationCatalogPage";
import { SignupPage } from "../pages/SignupPage";

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
    ],
  },
  {
    path: "*",
    element: <Navigate replace to="/" />,
  },
];

export const router = createBrowserRouter(appRoutes);
