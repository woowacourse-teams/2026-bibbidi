import { Link, Outlet } from "react-router";

import { BibidiBrand } from "../components/BibidiBrand/BibidiBrand";
import "./AuthLayout.css";

export function AuthLayout() {
  return (
    <div className="auth-layout">
      <header className="auth-header">
        <div className="auth-header__inner">
          <Link aria-label="비비디 홈" className="auth-header__brand" to="/">
            <BibidiBrand />
          </Link>
        </div>
      </header>

      <main className="auth-page">
        <Outlet />
      </main>
    </div>
  );
}
