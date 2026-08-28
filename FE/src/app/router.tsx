import { createBrowserRouter, Navigate } from "react-router";

import { PreparationCatalogPage } from "../pages/PreparationCatalogPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: PreparationCatalogPage,
  },
  {
    path: "*",
    element: <Navigate replace to="/" />,
  },
]);
