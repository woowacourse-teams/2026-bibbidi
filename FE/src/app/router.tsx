import { createBrowserRouter, Navigate } from "react-router";

import { AuthLayout } from "../layouts/AuthLayout";
import { FeedbackLayout } from "../layouts/FeedbackLayout";
import { LoginPage } from "../pages/LoginPage";
import { PreparationCatalogPage } from "../pages/PreparationCatalogPage";
import { SignupPage } from "../pages/SignupPage";

export const router = createBrowserRouter([
  {
    Component: FeedbackLayout,
    children: [
      {
        path: "/",
        Component: PreparationCatalogPage,
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
