import { NavLink } from "react-router";

import "./AppBottomNavigation.css";
import { AppNavigationIcon, appNavigationItems } from "./AppNavigation";

export function AppBottomNavigation() {
  return (
    <nav aria-label="하단 메뉴" className="app-bottom-navigation">
      {appNavigationItems.map((item) => (
        <NavLink
          className="app-bottom-navigation__item"
          end={item.to === "/"}
          key={item.to}
          to={item.to}
        >
          <AppNavigationIcon icon={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
