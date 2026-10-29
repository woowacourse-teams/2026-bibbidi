import { afterEach, describe, expect, it, vi } from "vitest";
import { createGoogleAnalyticsProvider } from "./googleAnalyticsProvider";

describe("createGoogleAnalyticsProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  it("콜백 이벤트에 GA의 원본 OAuth URL을 사용하지 않는다", () => {
    window.history.replaceState(
      null,
      "",
      "/auth/google?code=secret&state=secret",
    );
    const googleTag = vi.fn();
    const provider = createGoogleAnalyticsProvider("G-TEST", () => googleTag);
    provider.initialize();
    provider.track({
      name: "social_login_callback_failed",
      parameters: { provider: "google", failure_kind: "cancelled" },
    });
    expect(googleTag).toHaveBeenLastCalledWith(
      "event",
      "social_login_callback_failed",
      {
        provider: "google",
        failure_kind: "cancelled",
        page_location: "http://localhost:3000/auth/callback",
        page_referrer: "",
        page_title: "소셜 로그인 결과",
      },
    );
    expect(JSON.stringify(googleTag.mock.calls)).not.toContain("secret");
  });

  it("Google Tag를 한 번만 초기화하고 이벤트를 전달한다", () => {
    const googleTag = vi.fn();
    const loadTag = vi.fn(() => googleTag);
    const provider = createGoogleAnalyticsProvider("G-TEST", loadTag);

    provider.initialize();
    provider.initialize();
    provider.track({
      name: "preparation_catalog_view",
      parameters: { initial_category_id: "wedding-hall" },
    });

    expect(loadTag).toHaveBeenCalledOnce();
    expect(loadTag).toHaveBeenCalledWith("G-TEST");
    expect(googleTag.mock.calls[0]?.[0]).toBe("js");
    expect(googleTag).toHaveBeenNthCalledWith(2, "config", "G-TEST", {
      send_page_view: false,
    });
    expect(googleTag).toHaveBeenNthCalledWith(
      3,
      "event",
      "preparation_catalog_view",
      { initial_category_id: "wedding-hall" },
    );
  });

  it("측정 ID가 없으면 Google Tag를 초기화하지 않는다", () => {
    const loadTag = vi.fn(() => vi.fn());
    const provider = createGoogleAnalyticsProvider("", loadTag);

    provider.initialize();

    expect(loadTag).not.toHaveBeenCalled();
  });

  it("페이지뷰의 정규화된 페이지 컨텍스트를 이후 이벤트의 기본값으로 설정한다", () => {
    const googleTag = vi.fn();
    const provider = createGoogleAnalyticsProvider("G-TEST", () => googleTag);
    const pageView = {
      name: "page_view",
      parameters: {
        page_location: "https://bibbidi.example/checklist",
        page_path: "/checklist",
        page_referrer: "https://bibbidi.example/calendar",
        page_title: "체크리스트",
        screen_name: "checklist",
      },
    };

    provider.initialize();
    provider.track(pageView);

    expect(googleTag).toHaveBeenNthCalledWith(3, "set", {
      page_location: "https://bibbidi.example/checklist",
      page_referrer: "https://bibbidi.example/calendar",
      page_title: "체크리스트",
    });
    expect(googleTag).toHaveBeenNthCalledWith(4, "event", "page_view", {
      page_location: "https://bibbidi.example/checklist",
      page_path: "/checklist",
      page_referrer: "https://bibbidi.example/calendar",
      page_title: "체크리스트",
      screen_name: "checklist",
    });
  });

  it("초기화 전에 발생한 이벤트는 제품 오류 없이 무시한다", () => {
    const provider = createGoogleAnalyticsProvider("G-TEST", vi.fn());

    expect(() =>
      provider.track({ name: "test_event", parameters: {} }),
    ).not.toThrow();
  });

  it("Google Tag 명령을 arguments 객체로 dataLayer에 전달한다", () => {
    const analyticsWindow: { dataLayer?: unknown[] } = {};

    vi.stubGlobal("window", analyticsWindow);
    vi.stubGlobal("document", {
      createElement: vi.fn(() => ({})),
      getElementById: vi.fn(() => null),
      head: { appendChild: vi.fn() },
    });

    const provider = createGoogleAnalyticsProvider("G-TEST");

    provider.initialize();
    provider.track({ name: "test_event", parameters: { source: "test" } });

    const commands = analyticsWindow.dataLayer ?? [];

    expect(commands).toHaveLength(3);
    expect(Array.isArray(commands[0])).toBe(false);
    expect(Array.from(commands[0] as ArrayLike<unknown>)).toEqual([
      "js",
      expect.any(Date),
    ]);
    expect(Array.from(commands[1] as ArrayLike<unknown>)).toEqual([
      "config",
      "G-TEST",
      { send_page_view: false },
    ]);
    expect(Array.from(commands[2] as ArrayLike<unknown>)).toEqual([
      "event",
      "test_event",
      { source: "test" },
    ]);
  });
});

describe("밸런스게임의 GA 최소 수집", () => {
  it("상세 행동·오류·최종 선택은 GA로 보내지 않는다", () => {
    const googleTag = vi.fn();
    const provider = createGoogleAnalyticsProvider("G-TEST", () => googleTag);
    provider.initialize();
    googleTag.mockClear();
    for (const name of [
      "balance_game_question_view",
      "balance_game_answer_select",
      "balance_game_card_view",
      "balance_game_task_decision",
      "balance_game_task_created",
      "balance_game_error",
      "checklist_task_view",
      "checklist_task_status_change",
      "checklist_task_delete",
    ])
      provider.track({ name, parameters: { game_run_id: "run-private" } });
    expect(googleTag).not.toHaveBeenCalled();
  });
  it("시작과 신규 생성만 요약 속성으로 보내며 연결 ID는 제거한다", () => {
    const googleTag = vi.fn();
    const provider = createGoogleAnalyticsProvider("G-TEST", () => googleTag);
    provider.initialize();
    googleTag.mockClear();
    provider.track({
      name: "balance_game_start",
      parameters: {
        question_count: 10,
        auth_state: "guest",
        game_run_id: "private",
        question_id: "Q1",
      },
    });
    provider.track({
      name: "balance_game_save_success",
      parameters: { created_count: 0, card_type: "LUXURY" },
    });
    provider.track({
      name: "balance_game_save_success",
      parameters: {
        created_count: 2,
        card_type: "LUXURY",
        origin: "balance_game",
        game_run_id: "private",
        attempt_id: "private",
      },
    });
    expect(googleTag.mock.calls).toEqual([
      [
        "event",
        "balance_game_start",
        { question_count: 10, auth_state: "guest" },
      ],
      [
        "event",
        "balance_game_save_success",
        { created_count: 2, card_type: "LUXURY", origin: "balance_game" },
      ],
    ]);
  });
  it("기존 일정 생성 이벤트의 내부 할 일 ID도 GA에서 제거한다", () => {
    const googleTag = vi.fn();
    const provider = createGoogleAnalyticsProvider("G-TEST", () => googleTag);
    provider.initialize();
    provider.track({
      name: "appointment_create",
      parameters: {
        source: "checklist",
        checklist_item_id: 500,
        catalog_item_id: 19,
      },
    });
    expect(googleTag).toHaveBeenLastCalledWith("event", "appointment_create", {
      source: "checklist",
    });
  });
});
