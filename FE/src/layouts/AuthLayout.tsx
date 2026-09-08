import { Navigate, Outlet } from "react-router";

import { useAuth } from "../features/auth";
import { BrandHeader } from "./BrandHeader";
import "./AuthLayout.css";

export function AuthLayout() {
  const { authState } = useAuth();

  if (authState.status === "authenticated") {
    return <Navigate replace to="/" />;
  }

  return (
    <div className="auth-layout">
      <BrandHeader />

      <main className="auth-page">
        <Outlet />
      </main>
    </div>
  );
}
