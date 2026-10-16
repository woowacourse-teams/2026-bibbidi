import type { ErrorEvent } from "@sentry/react";
import { describe, expect, it } from "vitest";

import { safeSentryBreadcrumb, sanitizeSentryEvent } from "./sentryPrivacy";

describe("Sentry 개인정보 정제", () => {
  it("원문 메시지·요청·사용자 정보·자동 breadcrumb를 버리고 코드 위치를 남긴다", () => {
    const event: ErrorEvent = {
      type: undefined,
      event_id: "event-id",
      message: "secret title",
      request: { url: "https://example.com/auth/kakao?code=secret" },
      user: { id: "42", email: "secret@example.com" },
      extra: { response: "secret" },
      contexts: { private: { token: "secret" } },
      tags: {
        page_path: "/calendar",
        feature: "calendar",
        private: "secret",
      },
      debug_meta: {
        images: [
          {
            type: "sourcemap",
            debug_id: "12345678-1234-1234-1234-123456789abc",
            code_file: "https://example.com/assets/app.js?code=secret",
          },
        ],
      },
      breadcrumbs: [
        {
          category: "fetch",
          message: "https://example.com?code=secret",
        },
        {
          category: "bibbidi.navigation",
          message: "/calendar",
          data: { title: "secret" },
        },
      ],
      exception: {
        values: [
          {
            type: "TypeError",
            value: "secret title",
            stacktrace: {
              frames: [
                {
                  filename: "https://example.com/assets/app.js?code=secret",
                  abs_path: "https://example.com/assets/app.js#secret",
                  function: "submit",
                  lineno: 10,
                  colno: 4,
                  vars: { title: "secret" },
                },
              ],
            },
          },
        ],
      },
    };

    const result = sanitizeSentryEvent(event);
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(result).toMatchObject({
      event_id: "event-id",
      user: { id: "42" },
      tags: { page_path: "/calendar", feature: "calendar" },
      debug_meta: {
        images: [
          {
            type: "sourcemap",
            debug_id: "12345678-1234-1234-1234-123456789abc",
            code_file: "https://example.com/assets/app.js",
          },
        ],
      },
      exception: {
        values: [
          {
            type: "TypeError",
            value: "TypeError",
            stacktrace: {
              frames: [
                {
                  filename: "https://example.com/assets/app.js",
                  abs_path: "https://example.com/assets/app.js",
                  function: "submit",
                  lineno: 10,
                  colno: 4,
                },
              ],
            },
          },
        ],
      },
    });
    expect(result?.breadcrumbs).toEqual([
      {
        category: "bibbidi.navigation",
        level: undefined,
        message: "/calendar",
        timestamp: undefined,
      },
    ]);
  });

  it("처리되지 않은 오류는 fatal로 분류하고 임의 메시지 이벤트는 버린다", () => {
    expect(
      sanitizeSentryEvent({
        type: undefined,
        level: "error",
        exception: {
          values: [
            {
              type: "Error",
              value: "private",
              mechanism: {
                type: "onerror",
                handled: false,
              },
            },
          ],
        },
      })?.level,
    ).toBe("fatal");
    expect(
      sanitizeSentryEvent({
        type: undefined,
        message: "private",
      }),
    ).toBeNull();
    expect(
      sanitizeSentryEvent({
        type: undefined,
        exception: { values: [{ type: "Secret customer name" }] },
      })?.exception?.values?.[0]?.type,
    ).toBe("Error");
  });

  it("허용한 화면과 고정 동작만 단서로 남긴다", () => {
    expect(
      safeSentryBreadcrumb({
        category: "bibbidi.navigation",
        message: "/auth/kakao?code=secret",
      }),
    ).toBeNull();
    expect(
      safeSentryBreadcrumb({
        category: "bibbidi.action",
        message: "appointment.create",
        data: { title: "private" },
      }),
    ).toEqual({
      category: "bibbidi.action",
      level: undefined,
      message: "appointment.create",
      timestamp: undefined,
    });
  });
});
