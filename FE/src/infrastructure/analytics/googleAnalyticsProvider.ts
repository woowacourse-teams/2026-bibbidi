import type { AnalyticsEvent, AnalyticsProvider } from "./analytics";

const GOOGLE_TAG_SCRIPT_ID = "bibbidi-google-analytics";

type GoogleTag = (...arguments_: unknown[]) => void;
type GoogleTagLoader = (measurementId: string) => GoogleTag;

function createPageContext(event: AnalyticsEvent) {
  if (event.name !== "page_view") {
    return null;
  }

  const { page_location, page_referrer, page_title } = event.parameters;

  if (
    typeof page_location !== "string" ||
    typeof page_referrer !== "string" ||
    typeof page_title !== "string"
  ) {
    return null;
  }

  return { page_location, page_referrer, page_title };
}

interface GoogleAnalyticsWindow extends Window {
  dataLayer?: unknown[];
  gtag?: GoogleTag;
}

function loadGoogleTag(measurementId: string): GoogleTag {
  const analyticsWindow = window as GoogleAnalyticsWindow;

  analyticsWindow.dataLayer ??= [];
  analyticsWindow.gtag ??= function googleTag() {
    // Google Tag는 rest parameter 배열이 아닌 Arguments 객체를 명령으로 사용한다.
    // eslint-disable-next-line prefer-rest-params
    analyticsWindow.dataLayer?.push(arguments);
  };

  if (!document.getElementById(GOOGLE_TAG_SCRIPT_ID)) {
    const script = document.createElement("script");
    script.async = true;
    script.id = GOOGLE_TAG_SCRIPT_ID;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);
  }

  return analyticsWindow.gtag;
}

export function createGoogleAnalyticsProvider(
  measurementId: string,
  loadTag: GoogleTagLoader = loadGoogleTag,
): AnalyticsProvider {
  let googleTag: GoogleTag | undefined;

  return {
    initialize() {
      if (googleTag || !measurementId) {
        return;
      }

      googleTag = loadTag(measurementId);
      googleTag("js", new Date());
      googleTag("config", measurementId, { send_page_view: false });
    },
    track(event: AnalyticsEvent) {
      const pageContext = createPageContext(event);

      if (pageContext) {
        googleTag?.("set", pageContext);
      }

      googleTag?.("event", event.name, event.parameters);
    },
  };
}
