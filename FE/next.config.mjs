import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";
import { withSentryConfig } from "@sentry/nextjs/config";

export default function config(phase) {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  const apiTarget = process.env.BIBBIDI_API_PROXY_TARGET?.replace(/\/+$/, "");
  const assetTarget = (
    process.env.BIBBIDI_ASSET_PROXY_TARGET || "https://dev.bibbidi.kr"
  ).replace(/\/+$/, "");
  const sentryEnabled = !isDev && process.env.BIBBIDI_SENTRY_ENABLED === "true";
  const release =
    process.env.BIBBIDI_APP_VERSION ||
    process.env.CODEBUILD_RESOLVED_SOURCE_VERSION ||
    "unknown";

  if (
    sentryEnabled &&
    (!process.env.BIBBIDI_SENTRY_DSN ||
      !process.env.SENTRY_ORG ||
      !process.env.SENTRY_PROJECT ||
      !process.env.SENTRY_AUTH_TOKEN ||
      release === "unknown")
  ) {
    throw new Error(
      "Sentry 배포 설정(DSN, 조직, 프로젝트, 인증 토큰, 버전)이 필요합니다.",
    );
  }

  const posthogEnabled = process.env.BIBBIDI_POSTHOG_ENABLED === "true";
  const nextConfig = {
    ...(!isDev && { output: "export" }),
    agentRules: false,
    trailingSlash: true,
    skipTrailingSlashRedirect: true,
    images: { unoptimized: true },
    env: {
      NEXT_PUBLIC_BIBBIDI_API_BASE_URL: process.env.BIBBIDI_API_BASE_URL ?? "",
      NEXT_PUBLIC_BIBBIDI_GA_MEASUREMENT_ID:
        process.env.BIBBIDI_GA_MEASUREMENT_ID ?? "",
      NEXT_PUBLIC_BIBBIDI_POSTHOG_ENABLED: String(posthogEnabled),
      NEXT_PUBLIC_BIBBIDI_POSTHOG_PROJECT_TOKEN:
        process.env.BIBBIDI_POSTHOG_PROJECT_TOKEN ?? "",
      NEXT_PUBLIC_BIBBIDI_POSTHOG_HOST:
        process.env.BIBBIDI_POSTHOG_HOST ?? "https://us.i.posthog.com",
      NEXT_PUBLIC_BIBBIDI_SENTRY_ENABLED: String(sentryEnabled),
      NEXT_PUBLIC_BIBBIDI_SENTRY_DSN: process.env.BIBBIDI_SENTRY_DSN ?? "",
      NEXT_PUBLIC_BIBBIDI_APP_ENV:
        process.env.BIBBIDI_APP_ENV ?? (isDev ? "development" : "production"),
      NEXT_PUBLIC_BIBBIDI_APP_VERSION: release,
    },
    turbopack: {
      resolveAlias: {
        ...(!posthogEnabled && {
          "posthog-js": "./src/infrastructure/analytics/disabledPosthog.ts",
        }),
        ...(!sentryEnabled && {
          "@sentry/react":
            "./src/infrastructure/error-tracking/disabledSentry.ts",
        }),
      },
    },
    ...(isDev && {
      async rewrites() {
        return [
          ...(apiTarget
            ? [
                {
                  source: "/api/:path*",
                  destination: `${apiTarget}/api/:path*`,
                },
              ]
            : []),
          {
            source: "/balance-game/:image([^/]+\\.webp)",
            destination: `${assetTarget}/balance-game/:image`,
          },
        ];
      },
    }),
  };

  return sentryEnabled
    ? withSentryConfig(nextConfig, {
        telemetry: false,
        release: { name: release, inject: false },
        sourcemaps: { deleteSourcemapsAfterUpload: true },
      })
    : nextConfig;
}
