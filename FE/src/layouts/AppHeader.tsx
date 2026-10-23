import { Link, NavLink, useLocation } from "react-router";

import "./AppHeader.css";
import { HeaderBrandLink } from "./HeaderBrandLink";
import {
  AppHeaderAccountMenu,
  AppHeaderAccountUser,
} from "./AppHeaderAccountMenu";
import { appNavigationItems, isAppNavigationItemActive } from "./AppNavigation";

interface AuthenticatedUser extends AppHeaderAccountUser {
  kind: "authenticated";
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
      <div className="service-page-container app-header__inner">
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
          <AppHeaderAccountMenu navigationKey={pathname} user={user} />
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
