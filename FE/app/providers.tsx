"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AppPageViewTracker } from "../src/app/analytics/AppPageViewTracker";
import {
  createNavigationTiming,
  NavigationTracking,
} from "../src/app/analytics/NavigationTracking";
import {
  NavigationProvider,
  normalizePathname,
} from "../src/app/navigation/NavigationProvider";
import { AuthProvider } from "../src/features/auth";
import { ChecklistMigrationProvider } from "../src/features/checklist-migration";
import { LoginModalLayout } from "../src/features/social-login/view/LoginModal";
import { preventLinkDrag } from "../src/infrastructure/browser/preventLinkDrag";

export function Providers({ children }: { children: ReactNode }) {
  const pathname = normalizePathname(usePathname());
  const [timing] = useState(createNavigationTiming);
  const startNavigation = useCallback(
    (pathname: string) => timing.publish(pathname, false),
    [timing],
  );
  useEffect(() => {
    const onPop = () =>
      startNavigation(normalizePathname(window.location.pathname));
    window.addEventListener("popstate", onPop);
    document.addEventListener("dragstart", preventLinkDrag);
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("dragstart", preventLinkDrag);
    };
  }, [startNavigation]);

  return (
    <NavigationProvider onNavigationStart={startNavigation}>
      <AuthProvider
        keepChildrenOnError={pathname === "/" || pathname === "/preparation"}
      >
        <ChecklistMigrationProvider>
          <AppPageViewTracker />
          <NavigationTracking timing={timing} />
          <LoginModalLayout>{children}</LoginModalLayout>
        </ChecklistMigrationProvider>
      </AuthProvider>
    </NavigationProvider>
  );
}
