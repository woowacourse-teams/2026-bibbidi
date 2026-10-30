import { Link, useLocation } from "react-router";
import { PageContainer } from "../components/page-container";
import { LoginIcon } from "../components/icons/ActionIcons";
import { IconButton } from "../components/icon-button";
import { useLoginModal } from "../features/auth/useLoginModal";
import { useCompactHeaderLogin } from "./useCompactHeaderLogin";

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
  const { loginTo, loginState, openLogin } = useLoginModal();
  const { ref, compact } = useCompactHeaderLogin();
  return (
    <header className="app-header" data-compact={compact || undefined}>
      <PageContainer width="wide" className="app-header__inner">
        <div
          className="app-header__left"
          inert={compact}
          aria-hidden={compact || undefined}
        >
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

        <div className="app-header__actions" ref={ref}>
          {user.kind === "authenticated" ? (
            <AppHeaderAccountMenu navigationKey={pathname} user={user} />
          ) : user.kind === "guest" ? (
            <nav aria-label="계정 메뉴" className="app-header__guest-actions">
              <Link
                className="app-header__login"
                to={loginTo}
                state={loginState}
                replace={false}
                preventScrollReset
                aria-hidden={compact || undefined}
                inert={compact}
                tabIndex={compact ? -1 : undefined}
              >
                <LoginIcon />
                <span className="app-header__login-label">로그인</span>
              </Link>
              <IconButton
                className="app-header__login-icon"
                icon={<LoginIcon />}
                aria-label="로그인"
                aria-hidden={!compact || undefined}
                inert={!compact}
                tabIndex={compact ? undefined : -1}
                color="var(--color-fg-neutral-muted)"
                variant="clear"
                onClick={openLogin}
              />
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
      </PageContainer>
    </header>
  );
}
