import type { AnalyticsEvent } from "../../infrastructure/analytics";

const PAGE_DEFINITIONS = {
  "/": {
    pageTitle: "준비 목록",
    screenName: "preparation_catalog",
  },
  "/preparation": {
    pageTitle: "준비 목록",
    screenName: "preparation_catalog",
  },
  "/calendar": {
    pageTitle: "캘린더",
    screenName: "calendar",
  },
  "/checklist": {
    pageTitle: "체크리스트",
    screenName: "checklist",
  },
  "/login": {
    pageTitle: "로그인",
    screenName: "login",
  },
  "/onboarding": { pageTitle: "약관 동의", screenName: "onboarding_terms" },
  "/onboarding/account": {
    pageTitle: "계정 선택",
    screenName: "onboarding_account",
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

// 앱을 처음 불러온 주소다. GA는 첫 페이지뷰의 쿼리(UTM)와 referrer로 유입 채널을 정한다.
export interface LandingPage {
  pathname: string;
  search: string;
  referrer: string;
}

interface CreatePageViewEventParameters {
  origin: string;
  pagePath: PagePath;
  referrerPath: PagePath | null;
  landingPage?: LandingPage | null;
}

export function createPageViewEvent({
  origin,
  pagePath,
  referrerPath,
  landingPage = null,
}: CreatePageViewEventParameters): AnalyticsEvent {
  const pageDefinition = PAGE_DEFINITIONS[pagePath];

  return {
    name: "page_view",
    parameters: {
      page_location: `${createPageLocation(origin, pagePath)}${landingPage?.search ?? ""}`,
      page_path: pagePath,
      page_referrer: referrerPath
        ? createPageLocation(origin, referrerPath)
        : (landingPage?.referrer ?? ""),
      page_title: pageDefinition.pageTitle,
      screen_name: pageDefinition.screenName,
    },
  };
}
