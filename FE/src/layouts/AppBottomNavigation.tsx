import { Link, useLocation } from "react-router";
import type { ReactNode } from "react";

import "./AppBottomNavigation.css";
import {
  AppNavigationIcon,
  appNavigationItems,
  isAppNavigationItemActive,
} from "./AppNavigation";

export function AppBottomNavigation({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <nav aria-label="하단 메뉴" className="app-bottom-navigation">
      {appNavigationItems.map((item) => (
        <Link
          aria-current={
            isAppNavigationItemActive(pathname, item.to) ? "page" : undefined
          }
          className="app-bottom-navigation__item"
          key={item.to}
          to={item.to}
        >
          <AppNavigationIcon icon={item.icon} />
          <span>{item.label}</span>
        </Link>
      ))}
      {children}
    </nav>
  );
}
