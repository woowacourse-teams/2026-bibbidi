import { createBrowserRouter, Navigate } from "react-router";

import { FeedbackLayout } from "../layouts/FeedbackLayout";
import { PreparationCatalogPage } from "../pages/PreparationCatalogPage";

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
    path: "*",
    element: <Navigate replace to="/" />,
  },
]);
