import { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router";

import "./AppHeader.css";
import { HeaderBrandLink } from "./HeaderBrandLink";
import { appNavigationItems, isAppNavigationItemActive } from "./AppNavigation";

interface AuthenticatedUser {
  kind: "authenticated";
  isLoggingOut: boolean;
  logoutErrorMessage: string | null;
  onLogout: () => void;
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
  const { pathname } = useLocation();
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-header__left">
          <HeaderBrandLink to="/" />

          <nav aria-label="주요 메뉴" className="app-header__navigation">
            {appNavigationItems
              .filter((item) => item.showInDesktopHeader)
              .map((item) => (
                <Link
                  aria-current={
                    isAppNavigationItemActive(pathname, item.to)
                      ? "page"
                      : undefined
                  }
                  className="app-header__navigation-item"
                  key={item.to}
                  to={item.to}
                >
                  {item.label}
                </Link>
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
            <button
              aria-busy={user.isLoggingOut}
              aria-describedby={
                user.logoutErrorMessage ? "app-header-logout-error" : undefined
              }
              aria-label="로그아웃"
              className="app-header__logout"
              disabled={user.isLoggingOut}
              onClick={user.onLogout}
              title="로그아웃"
              type="button"
            >
              <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                <path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M14 8l4 4-4 4M8 12h10" />
              </svg>
            </button>
            {user.isLoggingOut ? (
              <span className="app-header__sr-only" role="status">
                로그아웃 처리 중
              </span>
            ) : null}
            {user.logoutErrorMessage ? (
              <div className="app-header__logout-error" role="alert">
                <span id="app-header-logout-error">
                  {user.logoutErrorMessage}
                </span>
                <button onClick={user.onLogout} type="button">
                  다시 시도
                </button>
              </div>
            ) : null}
          </div>
        ) : user.kind === "guest" ? (
          <nav aria-label="계정 메뉴" className="app-header__guest-actions">
            <NavLink className="app-header__login" to="/login">
              로그인
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
