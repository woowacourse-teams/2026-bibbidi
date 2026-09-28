import { describe, expect, it } from "vitest";

import { createPageViewEvent, normalizePagePath } from "./pageView";

describe("normalizePagePath", () => {
  it.each([
    ["/", "/"],
    ["/planner", "/planner"],
    ["/planner/", "/planner"],
    ["/checklist", "/checklist"],
    ["/login", "/login"],
  ] as const)(
    "허용된 경로 %s를 화면 경로로 정규화한다",
    (pathname, expected) => {
      expect(normalizePagePath(pathname)).toBe(expected);
    },
  );

  it.each(["/preparation", "/signup", "/unknown", "/checklist/task-123"])(
    "리다이렉트·식별자 경로 %s는 화면으로 측정하지 않는다",
    (pathname) => {
      expect(normalizePagePath(pathname)).toBeNull();
    },
  );
});

describe("createPageViewEvent", () => {
  it("고정 화면 이름과 정규화된 위치만 포함한다", () => {
    expect(
      createPageViewEvent({
        origin: "https://bibbidi.example",
        pagePath: "/checklist",
        referrerPath: "/planner",
      }),
    ).toEqual({
      name: "page_view",
      parameters: {
        page_location: "https://bibbidi.example/checklist",
        page_path: "/checklist",
        page_referrer: "https://bibbidi.example/planner",
        page_title: "체크리스트",
        screen_name: "checklist",
      },
    });
  });

  it("최초 진입의 원본 외부 referrer를 전송하지 않는다", () => {
    expect(
      createPageViewEvent({
        origin: "https://bibbidi.example",
        pagePath: "/",
        referrerPath: null,
      }).parameters.page_referrer,
    ).toBe("");
  });
});
