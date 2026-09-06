import { createBrowserRouter, Navigate } from "react-router";

import { AuthLayout } from "../layouts/AuthLayout";
import { ServiceLayout } from "../layouts/ServiceLayout";
import { ChecklistPage } from "../pages/ChecklistPage";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { PreparationCatalogPage } from "../pages/PreparationCatalogPage";
import { SignupPage } from "../pages/SignupPage";

export const router = createBrowserRouter([
  {
    Component: ServiceLayout,
    children: [
      {
        path: "/",
        Component: HomePage,
      },
      {
        path: "/preparation",
        Component: PreparationCatalogPage,
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
]);
