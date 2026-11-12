import type { AnalyticsEvent } from "./analytics";

interface RouterSnapshot {
  location: { pathname: string };
  navigation: { location?: { pathname: string } };
}

export interface TimingRouter {
  state: RouterSnapshot;
  subscribe: (listener: (state: RouterSnapshot) => void) => () => void;
}

const eventNames = {
  catalog: "catalog_content_visible",
  content: "page_content_timing",
  personal: "personal_preparation_timing",
} as const;

// DOM을 확인한 뒤 두 프레임을 기다린다. 정적 HTML은 계측 시작 전에 표시될 수 있다.
export function startPageContentTiming(
  router: TimingRouter,
  track: (event: AnalyticsEvent) => void,
  measure: keyof typeof eventNames = "content",
) {
  if (typeof MutationObserver === "undefined") return () => {};
  let pathname = "";
  let committed = false;
  let sequence = 0;
  let frame: number | undefined;
  let attempt: {
    path: string;
    startedAt: number;
    kind: "document" | "spa";
    id: string;
  } | null = null;
  const root = document.getElementById("root") ?? document.body;
  const cancelFrame = () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
  };
  const finish = (outcome: string) => {
    if (!attempt) return;
    const current = attempt;
    attempt = null;
    cancelFrame();
    observer.disconnect();
    try {
      track({
        name: eventNames[measure],
        parameters: {
          page_path: current.path,
          screen_name: "preparation_catalog",
          measurement_id: current.id,
          navigation_kind: current.kind,
          duration_ms: Math.max(
            0,
            Math.round(performance.now() - current.startedAt),
          ),
          outcome,
          ...(measure !== "content" ? { measurement_version: 1 } : {}),
          ...(measure === "catalog"
            ? {
                timing_source:
                  current.kind === "document"
                    ? "document_observation"
                    : "spa_dom_commit",
              }
            : {}),
        },
      });
    } catch {
      // 계측 실패가 콘텐츠 표시나 화면 이동을 막지 않는다.
    }
  };
  const contentOutcome = () => {
    if (
      measure === "catalog" &&
      root.querySelector(
        ".preparation-catalog-page [data-catalog-content-visible]",
      )
    )
      return "success";
    if (measure === "personal") {
      const personalState = root
        .querySelector(
          ".preparation-catalog-page [data-personal-preparation-state]",
        )
        ?.getAttribute("data-personal-preparation-state");
      if (personalState === "ready") return "success";
      if (personalState === "guest" || personalState === "error")
        return personalState;
    }
    const state = root
      .querySelector(".preparation-catalog-page [data-page-content-state]")
      ?.getAttribute("data-page-content-state");
    return state &&
      ((state === "success" && measure === "content") ||
        ["empty", "error", "authentication-required"].includes(state))
      ? state.replaceAll("-", "_")
      : null;
  };
  const checkContent = () => {
    if (!attempt || !committed || frame !== undefined || !contentOutcome())
      return;
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        frame = undefined;
        const outcome = contentOutcome();
        if (document.visibilityState === "hidden") finish("hidden");
        else if (committed && outcome) finish(outcome);
      });
    });
  };
  const observer = new MutationObserver(checkContent);
  const navigate = (state: RouterSnapshot, initial = false) => {
    const next = state.navigation.location?.pathname ?? state.location.pathname;
    committed = !state.navigation.location && state.location.pathname === next;
    if (next === pathname) {
      checkContent();
      return;
    }
    finish("abandoned");
    pathname = next;
    const path = next === "/" ? next : next.replace(/\/+$/, "");
    if (path !== "/" && path !== "/preparation") return;
    attempt = {
      path,
      startedAt: initial ? 0 : performance.now(),
      kind: initial ? "document" : "spa",
      id: `content-${++sequence}`,
    };
    if (document.visibilityState === "hidden") {
      finish("hidden");
      return;
    }
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "data-page-content-state",
        ...(measure === "personal" ? ["data-personal-preparation-state"] : []),
        ...(measure === "catalog" ? ["data-catalog-content-visible"] : []),
      ],
    });
    checkContent();
  };
  const onHidden = () => {
    if (document.visibilityState === "hidden") finish("hidden");
  };
  const onPageHide = () => finish("abandoned");
  document.addEventListener("visibilitychange", onHidden);
  window.addEventListener("pagehide", onPageHide);
  navigate(router.state, true);
  const unsubscribe = router.subscribe((state) => navigate(state));
  return () => {
    unsubscribe();
    observer.disconnect();
    cancelFrame();
    document.removeEventListener("visibilitychange", onHidden);
    window.removeEventListener("pagehide", onPageHide);
  };
}
