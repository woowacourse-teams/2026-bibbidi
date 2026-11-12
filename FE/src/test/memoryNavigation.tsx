import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  NavigationContext,
  type Destination,
  type Location,
  type NavigationOptions,
} from "../app/navigation/navigation";

export {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "../app/navigation/navigation";

export interface RouteObject {
  path?: string;
  element?: ReactNode;
  Component?: ComponentType;
  children?: RouteObject[];
}

interface MemoryOptions {
  initialEntries?: (
    Destination | (Exclude<Destination, string> & { state?: Location["state"] })
  )[];
  initialIndex?: number;
}

const ignoreNavigationStart = () => {};

export function createMemoryRouter(
  routes: RouteObject[],
  {
    initialEntries = ["/"],
    initialIndex = initialEntries.length - 1,
  }: MemoryOptions = {},
) {
  let sequence = 0;
  const createEntry = (
    to: Destination,
    state: Location["state"] = null,
  ): Location => {
    const url = new URL(
      typeof to === "string"
        ? to
        : `${to.pathname}${to.search ?? ""}${to.hash ?? ""}`,
      "http://localhost:3000",
    );
    return {
      ready: true,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      state,
      key: String(++sequence),
    };
  };
  let entries = initialEntries.map((entry) =>
    createEntry(
      entry,
      typeof entry === "object" && "state" in entry ? entry.state : null,
    ),
  );
  let index = initialIndex;
  let state = {
    location: entries[index],
    historyAction: "POP",
    initialized: true,
    navigation: { state: "idle" },
  };
  const listeners = new Set<(snapshot: typeof state) => void>();

  function navigate(to: Destination | number, options: NavigationOptions = {}) {
    let action = "POP";
    if (typeof to === "number") {
      const next = Math.max(0, Math.min(index + to, entries.length - 1));
      if (next === index) return;
      index = next;
    } else {
      const entry = createEntry(to, options.state);
      if (options.replace) {
        action = "REPLACE";
        entries[index] = entry;
      } else {
        action = "PUSH";
        entries = entries.slice(0, index + 1).concat(entry);
        index++;
      }
    }
    state = { ...state, location: entries[index], historyAction: action };
    listeners.forEach((listener) => listener(state));
  }

  return {
    routes,
    get state() {
      return state;
    },
    getSnapshot: () => state.location,
    subscribe(listener: (snapshot: typeof state) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    navigate,
  };
}

type MemoryRouterInstance = ReturnType<typeof createMemoryRouter>;
const OutletContext = createContext<ReactNode>(null);
const ParamsContext = createContext<Record<string, string>>({});
export const Outlet = () => useContext(OutletContext);
export const useParams = () => useContext(ParamsContext);

function match(path: string, pathname: string) {
  if (path === "*") return {};
  const expected = path.split("/");
  const actual = pathname.split("/");
  if (expected.length !== actual.length) return null;
  const params: Record<string, string> = {};
  for (const [i, segment] of expected.entries()) {
    if (segment.startsWith(":")) params[segment.slice(1)] = actual[i];
    else if (segment !== actual[i]) return null;
  }
  return params;
}

function renderRoutes(
  routes: RouteObject[],
  pathname: string,
): { node: ReactNode } | null {
  for (const { path, children, element, Component } of routes) {
    const params = path ? match(path, pathname) : {};
    if (!params) continue;
    const child = children ? renderRoutes(children, pathname) : null;
    if (children && !child) continue;
    return {
      node: (
        <ParamsContext value={params}>
          <OutletContext value={child?.node ?? null}>
            {Component ? <Component /> : element}
          </OutletContext>
        </ParamsContext>
      ),
    };
  }
  return null;
}

export function RouterProvider({
  router,
  children,
}: {
  router: MemoryRouterInstance;
  children?: ReactNode;
}) {
  const location = useSyncExternalStore(router.subscribe, router.getSnapshot);
  const navigation = useMemo(
    () => ({
      location,
      navigate: router.navigate,
      startNavigation: ignoreNavigationStart,
    }),
    [location, router],
  );
  return (
    <NavigationContext value={navigation}>
      {children ?? renderRoutes(router.routes, location.pathname)?.node}
    </NavigationContext>
  );
}

export function MemoryRouter({
  children,
  ...options
}: MemoryOptions & { children: ReactNode }) {
  const [router] = useState(() => createMemoryRouter([], options));
  return <RouterProvider router={router}>{children}</RouterProvider>;
}

type RouteProps = Omit<RouteObject, "children"> & { children?: ReactNode };
export const Route: ComponentType<RouteProps> = () => null;

function routeObjects(children: ReactNode): RouteObject[] {
  return Children.toArray(children).flatMap((child): RouteObject[] => {
    if (!isValidElement<RouteProps>(child)) return [];
    const props = child.props;
    if (child.type !== Route) return routeObjects(props.children);
    return [
      {
        ...props,
        children: props.children ? routeObjects(props.children) : undefined,
      },
    ];
  });
}

export function Routes({ children }: { children: ReactNode }) {
  const { pathname } = useContext(NavigationContext)!.location;
  return renderRoutes(routeObjects(children), pathname)?.node;
}
