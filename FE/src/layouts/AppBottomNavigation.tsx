import { MouseEventHandler } from "react";
import { NavLink } from "react-router";

import "./AppBottomNavigation.css";
import { AppNavigationIcon, appNavigationItems } from "./AppNavigation";

interface AppBottomNavigationProps {
  onPlannerNavigation?: MouseEventHandler<HTMLAnchorElement>;
}

export function AppBottomNavigation({
  onPlannerNavigation,
}: AppBottomNavigationProps) {
  return (
    <nav aria-label="하단 메뉴" className="app-bottom-navigation">
      {appNavigationItems.map((item) => (
        <NavLink
          className="app-bottom-navigation__item"
          end={item.to === "/"}
          key={item.to}
          onClick={item.to === "/planner" ? onPlannerNavigation : undefined}
          to={item.to}
        >
          <AppNavigationIcon icon={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
