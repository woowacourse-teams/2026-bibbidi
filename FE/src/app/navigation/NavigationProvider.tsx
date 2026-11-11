"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  NavigationContext,
  exportHref,
  type EntryState,
  type NavigateTo,
} from "./navigation";

const changeEvent = "bibbidi:navigation-entry";
const entryKey = "bibbidiEntry";
let sequence = 0;

const notify = () => window.dispatchEvent(new Event(changeEvent));

function subscribe(listener: () => void) {
  window.addEventListener(changeEvent, listener);
  window.addEventListener("popstate", listener);
  window.addEventListener("hashchange", listener);
  return () => {
    window.removeEventListener(changeEvent, listener);
    window.removeEventListener("popstate", listener);
    window.removeEventListener("hashchange", listener);
  };
}

function getEntrySnapshot() {
  const { search, hash } = window.location;
  return JSON.stringify([
    search,
    hash,
    window.history.state?.[entryKey] ?? null,
  ]);
}
const getServerSnapshot = () => "";
type Entry = { key: string; data: EntryState | null };

export function normalizePathname(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}

// Keep the search-param bailout local; the page and the shared layout stay in the export.
function LocationChangeObserver({ pathname }: { pathname: string }) {
  const search = useSearchParams().toString();
  useLayoutEffect(() => {
    notify();
  }, [pathname, search]);
  return null;
}

function writeEntry(href: string, replace: boolean, data: EntryState | null) {
  const currentState = window.history.state;
  const key = replace
    ? (currentState?.[entryKey]?.key ?? "document")
    : String(++sequence);
  // Next patches the History API and adds its own internal router fields.
  // Supplying them ourselves would bypass that integration.
  const entry = { [entryKey]: { key, data } };
  if (replace) window.history.replaceState(entry, "", href);
  else window.history.pushState(entry, "", href);
  notify();
}

export function NavigationProvider({
  children,
  onNavigationStart,
}: {
  children: ReactNode;
  onNavigationStart: (pathname: string) => void;
}) {
  const router = useRouter();
  const pathname = normalizePathname(usePathname());
  const pendingEntry = useRef<{ href: string; data: EntryState } | null>(null);
  const snapshot = useSyncExternalStore(
    subscribe,
    getEntrySnapshot,
    getServerSnapshot,
  );
  const [search, hash, entry] = useMemo(
    () =>
      JSON.parse(snapshot || '["","",null]') as [string, string, Entry | null],
    [snapshot],
  );

  useLayoutEffect(() => {
    const pending = pendingEntry.current;
    if (!pending) return;
    const expected = new URL(pending.href);
    const actual = window.location;
    if (
      normalizePathname(expected.pathname) ===
        normalizePathname(actual.pathname) &&
      expected.search === actual.search &&
      expected.hash === actual.hash
    ) {
      pendingEntry.current = null;
      writeEntry(actual.href, true, pending.data);
    }
  }, [pathname, snapshot]);

  const startNavigation = useCallback(
    (href: string) => {
      pendingEntry.current = null;
      onNavigationStart(
        normalizePathname(new URL(href, window.location.href).pathname),
      );
    },
    [onNavigationStart],
  );

  const navigate = useCallback<NavigateTo>(
    (destination, options = {}) => {
      if (typeof destination === "number") {
        window.history.go(destination);
        return;
      }
      const href =
        typeof destination === "string"
          ? destination
          : `${destination.pathname}${destination.search ?? ""}${destination.hash ?? ""}`;
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const nextPath = normalizePathname(url.pathname);
      if (nextPath === normalizePathname(window.location.pathname)) {
        // Query changes and modal history must not remount the route or reset scroll.
        url.pathname = window.location.pathname;
        writeEntry(url.href, Boolean(options.replace), options.state ?? null);
        return;
      }
      startNavigation(href);
      if (options.state)
        pendingEntry.current = { href: url.href, data: options.state };
      const action = options.replace ? router.replace : router.push;
      action(exportHref(`${url.pathname}${url.search}${url.hash}`), {
        scroll: !options.preventScrollReset,
      });
    },
    [router, startNavigation],
  );
  const navigation = useMemo(
    () => ({
      location: {
        ready: snapshot !== "",
        pathname,
        search,
        hash,
        key: entry?.key ?? "document",
        state: entry?.data ?? null,
      },
      navigate,
      startNavigation,
    }),
    [pathname, search, hash, entry, navigate, snapshot, startNavigation],
  );

  return (
    <NavigationContext value={navigation}>
      <Suspense fallback={null}>
        <LocationChangeObserver pathname={pathname} />
      </Suspense>
      {children}
    </NavigationContext>
  );
}
