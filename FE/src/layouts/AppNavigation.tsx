export const appNavigationItems = [
  {
    icon: "home",
    label: "로드맵",
    showInDesktopHeader: true,
    to: "/",
  },
  {
    icon: "checklist",
    label: "체크리스트",
    showInDesktopHeader: true,
    to: "/checklist",
  },
  {
    icon: "planner",
    label: "플래너",
    showInDesktopHeader: true,
    to: "/planner",
  },
] as const;

export type AppNavigationIconName = (typeof appNavigationItems)[number]["icon"];

export function AppNavigationIcon({ icon }: { icon: AppNavigationIconName }) {
  switch (icon) {
    case "home":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />
        </svg>
      );
    case "planner":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 13h3M8 16h6" />
        </svg>
      );
    case "checklist":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m4 7 2 2 4-4M12 7h8M4 14l2 2 4-4M12 14h8" />
        </svg>
      );
    default: {
      const exhaustiveIcon: never = icon;

      return exhaustiveIcon;
    }
  }
}
