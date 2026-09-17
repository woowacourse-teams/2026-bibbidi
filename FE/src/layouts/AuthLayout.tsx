import { Navigate, Outlet, useLocation } from "react-router";

import { getSafeLoginReturnPath, useAuth } from "../features/auth";
import { BrandHeader } from "./BrandHeader";
import "./AuthLayout.css";

export function AuthLayout() {
  const { authState } = useAuth();
  const { search } = useLocation();

  if (authState.status === "authenticated") {
    return <Navigate replace to={getSafeLoginReturnPath(search) ?? "/"} />;
  }

  return (
    <div className="auth-layout">
      <BrandHeader />

      <main className="auth-page">
        {authState.status === "loading" ||
        authState.status === "synchronizing" ? (
          <p role="status">로그인 상태를 확인하고 있습니다.</p>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
