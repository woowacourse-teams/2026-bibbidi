import type { AnalyticsEvent } from "../../infrastructure/analytics";

const PAGE_DEFINITIONS = {
  "/": {
    pageTitle: "준비 목록",
    screenName: "preparation_catalog",
  },
  "/planner": {
    pageTitle: "플래너",
    screenName: "planner",
  },
  "/checklist": {
    pageTitle: "체크리스트",
    screenName: "checklist",
  },
  "/login": {
    pageTitle: "로그인",
    screenName: "login",
  },
} as const;

export type PagePath = keyof typeof PAGE_DEFINITIONS;

function removeTrailingSlash(pathname: string) {
  if (pathname === "/") {
    return pathname;
  }

  return pathname.replace(/\/+$/, "");
}

export function normalizePagePath(pathname: string): PagePath | null {
  const normalizedPathname = removeTrailingSlash(pathname);

  if (Object.hasOwn(PAGE_DEFINITIONS, normalizedPathname)) {
    return normalizedPathname as PagePath;
  }

  return null;
}

function createPageLocation(origin: string, pagePath: PagePath) {
  const normalizedOrigin = new URL(origin).origin;

  return new URL(pagePath, normalizedOrigin).href;
}

interface CreatePageViewEventParameters {
  origin: string;
  pagePath: PagePath;
  referrerPath: PagePath | null;
}

export function createPageViewEvent({
  origin,
  pagePath,
  referrerPath,
}: CreatePageViewEventParameters): AnalyticsEvent {
  const pageDefinition = PAGE_DEFINITIONS[pagePath];

  return {
    name: "page_view",
    parameters: {
      page_location: createPageLocation(origin, pagePath),
      page_path: pagePath,
      page_referrer: referrerPath
        ? createPageLocation(origin, referrerPath)
        : "",
      page_title: pageDefinition.pageTitle,
      screen_name: pageDefinition.screenName,
    },
  };
}
