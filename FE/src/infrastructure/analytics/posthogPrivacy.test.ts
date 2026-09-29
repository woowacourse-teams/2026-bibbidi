import { describe, expect, it } from "vitest";
import { createPreparationItemAddEvent } from "../../features/preparation/analytics/preparationAnalytics";
import { createPageViewEvent } from "../../app/analytics/pageView";
import {
  PRIVATE_REPLAY_CONFIG,
  sanitizeAnalyticsUrl,
  sanitizePostHogEvent,
} from "./posthogPrivacy";

describe("PostHog 개인정보 정제", () => {
  it("준비 추천의 카탈로그 이름과 단계를 보존한다", () => {
    const event = createPreparationItemAddEvent({
      source: "planner_recommendation",
      categoryName: "예식장",
      itemCount: 2,
      phase: 1,
    });
    expect(
      sanitizePostHogEvent({
        uuid: "test",
        event: event.name,
        properties: event.parameters,
      })?.properties,
    ).toEqual(event.parameters);
  });
  it("페이지 정의에 지정된 고정 제목을 포함해 기존 페이지 속성을 보존한다", () => {
    const event = createPageViewEvent({
      origin: "https://example.com",
      pagePath: "/planner",
      referrerPath: "/",
    });
    expect(
      sanitizePostHogEvent({
        uuid: "test",
        event: event.name,
        properties: event.parameters,
      })?.properties,
    ).toEqual(event.parameters);
  });
  it.each([
    "https://example.com/auth/kakao?code=secret&state=secret",
    "https://example.com/users/123",
    "javascript:secret",
    "secret",
  ])("수집하지 않는 URL %s를 제거한다", (url) => {
    expect(sanitizeAnalyticsUrl(url)).toBe("");
  });
  it("일반 화면의 쿼리와 해시도 제거한다", () => {
    expect(
      sanitizeAnalyticsUrl(
        "https://example.com/onboarding/account?code=secret#secret",
      ),
    ).toBe("https://example.com/onboarding/account");
  });
  it("자동 초기 유입, referrer, Person 속성과 임의의 원문 속성을 제거한다", () => {
    const result = sanitizePostHogEvent({
      uuid: "id",
      event: "$identify",
      $set: { email: "secret" },
      $set_once: { $initial_current_url: "secret" },
      properties: {
        token: "public-token",
        distinct_id: "bibbidi:user:42",
        $anon_distinct_id: "anon",
        $session_id: "session",
        $current_url: "https://example.com/checklist?title=secret#secret",
        $initial_referrer: "secret",
        $session_entry_url: "secret",
        $set: { nickname: "secret" },
        nickname: "secret",
        message: "secret",
        $referrer: "https://ad.example/secret",
        category_id: "1",
      },
    });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(result?.properties).toEqual({
      token: "public-token",
      distinct_id: "bibbidi:user:42",
      $anon_distinct_id: "anon",
      $session_id: "session",
      $current_url: "https://example.com/checklist",
      category_id: "1",
    });
  });
  it("홍보 유입의 캠페인 값과 유입 도메인은 남기고 URL 원문은 제거한다", () => {
    const result = sanitizePostHogEvent({
      uuid: "id",
      event: "$pageview",
      $set_once: {
        $initial_utm_source: "instagram",
        $initial_utm_campaign: "launch",
        $initial_referring_domain: "m.instagram.com",
        $initial_referrer: "https://m.instagram.com/p/secret",
        $initial_current_url: "https://example.com/?code=secret",
      },
      properties: {
        distinct_id: "anon",
        utm_source: "instagram",
        utm_medium: "paid",
        utm_campaign: "launch",
        $referring_domain: "m.instagram.com",
        $referrer: "https://m.instagram.com/p/secret",
        $session_entry_utm_source: "instagram",
        $session_entry_referring_domain: "m.instagram.com",
        $session_entry_url: "https://example.com/?code=secret",
        $session_entry_referrer: "https://m.instagram.com/p/secret",
      },
    });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(result?.properties).toEqual({
      distinct_id: "anon",
      utm_source: "instagram",
      utm_medium: "paid",
      utm_campaign: "launch",
      $referring_domain: "m.instagram.com",
      $session_entry_utm_source: "instagram",
      $session_entry_referring_domain: "m.instagram.com",
    });
    expect(result?.$set_once).toEqual({
      $initial_utm_source: "instagram",
      $initial_utm_campaign: "launch",
      $initial_referring_domain: "m.instagram.com",
    });
  });
  it("경로 집계용 속성은 공개 경로만 남기고 콜백 경로는 제거한다", () => {
    const result = sanitizePostHogEvent({
      uuid: "id",
      event: "$pageview",
      properties: {
        $host: "dev.bibbidi.kr",
        $pathname: "/checklist/",
        $session_entry_host: "dev.bibbidi.kr",
        $session_entry_pathname: "/auth/kakao",
      },
    });
    expect(result?.properties).toEqual({
      $host: "dev.bibbidi.kr",
      $pathname: "/checklist",
      $session_entry_host: "dev.bibbidi.kr",
    });
  });
  it("입력·텍스트·민감 속성·네트워크를 마스킹하고 이미지와 iframe을 차단한다", () => {
    expect(PRIVATE_REPLAY_CONFIG.maskAllInputs).toBe(true);
    expect(PRIVATE_REPLAY_CONFIG.maskTextSelector).toBe("*");
    for (const name of [
      "title",
      "aria-label",
      "value",
      "href",
      "src",
      "data-title",
      "style",
    ]) {
      expect(PRIVATE_REPLAY_CONFIG.maskAttributeFn?.(name, "secret")).toBe(
        "[masked]",
      );
    }
    expect(
      PRIVATE_REPLAY_CONFIG.maskAttributeFn?.("class", "checklist-card"),
    ).toBe("checklist-card");
    expect(PRIVATE_REPLAY_CONFIG.blockSelector).toContain("iframe");
    const mask = PRIVATE_REPLAY_CONFIG.maskCapturedNetworkRequestFn;
    const timing = { duration: 0, startTime: 0, entryType: "navigation" };
    expect(
      mask?.({ ...timing, name: "https://example.com/auth/kakao?code=secret" }),
    ).toBeNull();
    expect(
      mask?.({ ...timing, name: "https://example.com/?code=secret" }),
    ).toEqual({ ...timing, name: "https://example.com/" });
    expect(
      mask?.({
        ...timing,
        name: "https://example.com/api/users/me",
        method: "GET",
      }),
    ).toBeNull();
  });
});
