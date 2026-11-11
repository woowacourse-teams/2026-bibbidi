"use client";

import NextLink from "next/link";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ComponentProps,
  type MouseEvent,
} from "react";

import {
  NavigationContext,
  type Destination,
  type NavigationOptions,
} from "./navigationContext";
export { NavigationContext };
export type {
  Destination,
  EntryState,
  Location,
  NavigateTo,
  NavigationOptions,
} from "./navigationContext";

function useNavigation() {
  const navigation = useContext(NavigationContext);
  if (!navigation) throw new Error("NavigationProvider가 필요합니다.");
  return navigation;
}

export const useLocation = () => useNavigation().location;
export const useNavigate = () => useNavigation().navigate;

export function useHref(to: Destination) {
  return typeof to === "string"
    ? to
    : `${to.pathname}${to.search ?? ""}${to.hash ?? ""}`;
}

// The export places Flight payloads at /route/index.txt. An uncached
// navigation to /route would request /route.txt and fall back to a document load.
export function exportHref(href: string) {
  const index = href.search(/[?#]/);
  const path = index < 0 ? href : href.slice(0, index);
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.endsWith("/") ||
    /\.[^/]+$/.test(path)
  )
    return href;
  return path + "/" + (index < 0 ? "" : href.slice(index));
}

export function useSearchParams() {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const setParams = useCallback(
    (
      update: URLSearchParams | ((current: URLSearchParams) => URLSearchParams),
      options?: NavigationOptions,
    ) => {
      const next = typeof update === "function" ? update(params) : update;
      const query = next.toString();
      navigate({ pathname, search: query ? `?${query}` : "", hash }, options);
    },
    [hash, navigate, params, pathname],
  );
  return [params, setParams] as const;
}

export function useLinkClickHandler<T extends HTMLAnchorElement>(
  to: Destination,
  options?: NavigationOptions,
) {
  const navigate = useNavigate();
  const href = useHref(to);
  return (event: MouseEvent<T>) => {
    if (
      !event.defaultPrevented &&
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.shiftKey &&
      (!event.currentTarget.target || event.currentTarget.target === "_self")
    ) {
      event.preventDefault();
      navigate(href, options);
    }
  };
}

export type LinkProps = Omit<
  ComponentProps<typeof NextLink>,
  "href" | "scroll" | "onNavigate"
> &
  NavigationOptions & { to: Destination };

export function Link({
  to,
  replace,
  state,
  preventScrollReset,
  ...props
}: LinkProps) {
  const href = useHref(to);
  const { navigate, startNavigation } = useNavigation();
  return (
    <NextLink
      {...props}
      href={exportHref(href)}
      replace={replace}
      scroll={!preventScrollReset}
      onNavigate={(event) => {
        if (state !== undefined) {
          event.preventDefault();
          navigate(href, { replace, state, preventScrollReset });
        } else startNavigation(href);
      }}
    />
  );
}

export function Navigate({
  to,
  replace,
  state,
}: NavigationOptions & { to: Destination }) {
  const navigate = useNavigate();
  const { ready } = useLocation();
  const href = useHref(to);
  useEffect(() => {
    if (ready) navigate(href, { replace, state });
  }, [href, navigate, ready, replace, state]);
  return null;
}
