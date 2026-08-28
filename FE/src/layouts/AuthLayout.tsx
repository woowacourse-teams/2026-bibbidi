import { Outlet } from "react-router";

import { BrandHeader } from "./BrandHeader";
import "./AuthLayout.css";

export function AuthLayout() {
  return (
    <div className="auth-layout">
      <BrandHeader />

      <main className="auth-page">
        <Outlet />
      </main>
    </div>
  );
}
