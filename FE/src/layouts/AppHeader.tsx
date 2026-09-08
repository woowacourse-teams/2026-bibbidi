import { ReactNode } from "react";
import { NavLink } from "react-router";

import "./AppHeader.css";
import { HeaderBrandLink } from "./HeaderBrandLink";
import { appNavigationItems } from "./AppNavigation";

interface AuthenticatedUser {
  kind: "authenticated";
  summary: ReactNode;
  userInitial: string;
}

interface GuestUser {
  kind: "guest";
}

interface PendingUser {
  kind: "pending";
}

interface AppHeaderProps {
  user: AuthenticatedUser | GuestUser | PendingUser;
}

export function AppHeader({ user }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-header__left">
          <HeaderBrandLink to="/" />

          <nav aria-label="주요 메뉴" className="app-header__navigation">
            {appNavigationItems
              .filter((item) => item.showInDesktopHeader)
              .map((item) => (
                <NavLink
                  className="app-header__navigation-item"
                  key={item.to}
                  to={item.to}
                >
                  {item.label}
                </NavLink>
              ))}
          </nav>
        </div>

        {user.kind === "authenticated" ? (
          <div className="app-header__right">
            <div className="app-header__summary">{user.summary}</div>
            <span
              aria-label={`현재 사용자 ${user.userInitial}`}
              className="app-header__user"
            >
              {user.userInitial}
            </span>
          </div>
        ) : user.kind === "guest" ? (
          <nav aria-label="계정 메뉴" className="app-header__guest-actions">
            <NavLink className="app-header__login" to="/login">
              로그인
            </NavLink>
            <NavLink className="app-header__signup" to="/signup">
              회원가입
            </NavLink>
          </nav>
        ) : (
          <div
            aria-label="로그인 상태 확인 중"
            className="app-header__auth-pending"
            role="status"
          >
            <span className="app-header__auth-pending-text">
              로그인 상태 확인 중
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
