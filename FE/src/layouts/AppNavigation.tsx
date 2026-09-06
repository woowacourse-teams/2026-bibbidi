export const appNavigationItems = [
  { icon: "home", label: "홈", showInDesktopHeader: false, to: "/" },
  {
    icon: "checklist",
    label: "체크리스트",
    showInDesktopHeader: true,
    to: "/checklist",
  },
  {
    icon: "catalog",
    label: "준비 목록",
    showInDesktopHeader: true,
    to: "/preparation",
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
    case "checklist":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m4 7 2 2 4-4M12 7h8M4 14l2 2 4-4M12 14h8" />
        </svg>
      );
    case "catalog":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z" />
        </svg>
      );
    default: {
      const exhaustiveIcon: never = icon;

      return exhaustiveIcon;
    }
  }
}
