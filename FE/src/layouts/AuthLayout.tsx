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
        {authState.status === "loading" ? (
          <p role="status">로그인 상태를 확인하고 있습니다.</p>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
