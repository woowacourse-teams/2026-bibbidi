import { afterEach, describe, expect, it, vi } from "vitest";
import type { PostHog, PostHogConfig } from "posthog-js";

import { createAnalyticsClient } from "./analytics";
import { createPostHogProvider } from "./posthogProvider";

const options = {
  enabled: true,
  token: "test-project",
  host: "https://us.i.posthog.com",
  environment: "test",
  appVersion: "test-sha",
};
const page = {
  name: "page_view",
  parameters: {
    page_location: "http://localhost:3000/onboarding?secret=hidden",
    page_path: "/onboarding",
  },
};

function setup(initialId = "anonymous-1", enabled = true) {
  let id = initialId;
  const sdk = {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn((next: string) => {
      id = next;
    }),
    reset: vi.fn(() => {
      id = "anonymous-2";
    }),
    get_distinct_id: vi.fn(() => id),
    register: vi.fn(),
    onFeatureFlags: vi.fn<
      (callback: Parameters<PostHog["onFeatureFlags"]>[0]) => () => void
    >(() => () => {}),
    getFeatureFlag: vi.fn(() => "control"),
    startSessionRecording: vi.fn(),
    stopSessionRecording: vi.fn(),
  };
  const provider = createPostHogProvider({ ...options, enabled }, sdk);
  const client = createAnalyticsClient([provider]);
  client.initialize();
  return { sdk, client, provider };
}

afterEach(() => {
  window.history.replaceState(null, "", "/");
  document.cookie = "bibbidi_internal=; Max-Age=0";
});

describe("PostHog 사용자 여정", () => {
  it("첫 화면 실험군을 읽고 SDK 플래그 노출을 기록하게 한다", async () => {
    const { sdk, client, provider } = setup();
    sdk.onFeatureFlags.mockImplementation((callback) => {
      callback(["home-entry-calendar"], {}, { errorsLoading: false });
      return () => {};
    });
    sdk.getFeatureFlag.mockReturnValue("test");
    client.setContext({ authState: "guest", pathname: "/" });

    expect(await provider.resolveHomeEntryVariant()).toBe("test");
    expect(sdk.getFeatureFlag).toHaveBeenCalledExactlyOnceWith(
      "home-entry-calendar",
    );
    const config = sdk.init.mock.calls[0][1] as PostHogConfig;
    expect(config.advanced_disable_feature_flags).toBe(false);
    expect(config.disable_web_experiments).toBe(true);
  });

  it("플래그 조회를 사용할 수 없으면 기존 로드맵을 선택한다", async () => {
    const { sdk } = setup("anonymous", false);
    const provider = createPostHogProvider({ ...options, enabled: false }, sdk);
    expect(await provider.resolveHomeEntryVariant()).toBe("control");
    expect(sdk.onFeatureFlags).not.toHaveBeenCalled();
  });

  it("플래그 응답이 지연되면 기존 로드맵으로 돌아간다", async () => {
    vi.useFakeTimers();
    try {
      const { client, provider } = setup();
      client.setContext({ authState: "guest", pathname: "/" });

      const variant = provider.resolveHomeEntryVariant();
      await vi.advanceTimersByTimeAsync(2000);

      expect(await variant).toBe("control");
    } finally {
      vi.useRealTimers();
    }
  });

  it("익명 세션 종료는 녹화와 수집을 중지하되 온보딩의 SDK ID를 유지한다", () => {
    const { sdk, client } = setup();
    client.setContext({
      authState: "onboardingRequired",
      pathname: "/onboarding",
    });
    client.reset();
    client.track(page);
    expect(sdk.stopSessionRecording).toHaveBeenCalledOnce();
    expect(sdk.reset).not.toHaveBeenCalled();
    expect(sdk.get_distinct_id()).toBe("anonymous-1");
    expect(sdk.capture).not.toHaveBeenCalled();
    client.setContext({ authState: "guest", pathname: "/login" });
    expect(sdk.get_distinct_id()).toBe("anonymous-1");
  });
  it("회원 세션 종료는 SDK ID를 초기화한다", () => {
    const { sdk, client } = setup("bibbidi:user:42");
    client.setContext({
      authState: "authenticated",
      pathname: "/",
      userId: 42,
    });
    client.reset();
    expect(sdk.stopSessionRecording).toHaveBeenCalledOnce();
    expect(sdk.reset).toHaveBeenCalledExactlyOnceWith(true);
    expect(sdk.get_distinct_id()).toBe("anonymous-2");
  });
  it("회원 식별에 실패하면 이전 회원으로 후속 이벤트를 보내지 않는다", () => {
    const { sdk, client } = setup();
    sdk.identify.mockImplementation(() => {
      throw new Error("SDK failure");
    });
    client.setContext({
      authState: "authenticated",
      pathname: "/",
      userId: 42,
    });
    client.track(page);
    expect(sdk.capture).not.toHaveBeenCalled();
    expect(sdk.startSessionRecording).not.toHaveBeenCalled();
  });
  it("비활성 또는 키 누락이면 SDK를 초기화하지 않는다", () => {
    const { sdk, client } = setup("anonymous", false);
    client.setContext({ authState: "guest", pathname: "/" });
    client.track(page);
    client.reset();
    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.capture).not.toHaveBeenCalled();
    expect(sdk.startSessionRecording).not.toHaveBeenCalled();
    createPostHogProvider({ ...options, token: "" }, sdk).initialize();
    expect(sdk.init).not.toHaveBeenCalled();
  });
  it("캠퍼스 IP 표시 쿠키가 있으면 SDK를 초기화하지 않아 이벤트와 녹화를 보내지 않는다", () => {
    document.cookie = "bibbidi_internal=1";
    const { sdk, client } = setup();
    client.setContext({ authState: "guest", pathname: "/" });
    client.track(page);
    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.capture).not.toHaveBeenCalled();
    expect(sdk.startSessionRecording).not.toHaveBeenCalled();
  });

  it("약관과 임시 계정의 여정을 익명으로 유지하고 최종 회원에 한 번만 연결한다", () => {
    const { sdk, client } = setup();
    client.setContext({
      authState: "onboardingRequired",
      pathname: "/onboarding",
    });
    client.track(page);
    client.setContext({
      authState: "synchronizing",
      pathname: "/onboarding/account",
      userId: 999,
    });
    client.setContext({
      authState: "accountSetupRequired",
      pathname: "/onboarding/account",
      userId: 999,
    });
    client.track({ name: "legacy_transfer_complete", parameters: {} });
    expect(sdk.identify).not.toHaveBeenCalled();
    expect(sdk.reset).not.toHaveBeenCalled();
    client.setContext({
      authState: "authenticated",
      pathname: "/",
      userId: 42,
    });
    client.setContext({
      authState: "authenticated",
      pathname: "/",
      userId: 42,
    });
    expect(sdk.identify).toHaveBeenCalledExactlyOnceWith("bibbidi:user:42");
    expect(sdk.reset).not.toHaveBeenCalled();
    expect(sdk.capture).toHaveBeenCalledWith(
      "legacy_transfer_complete",
      expect.objectContaining({ auth_state: "accountSetupRequired" }),
    );
  });

  it("인증 확인 실패로 회원 ID를 지우거나 수집을 계속하지 않는다", () => {
    const { sdk, client } = setup("bibbidi:user:42");
    client.setContext({
      authState: "authenticated",
      pathname: "/",
      userId: 42,
    });
    client.setContext({ authState: "error", pathname: "/" });
    client.track(page);
    expect(sdk.capture).not.toHaveBeenCalled();
    expect(sdk.reset).not.toHaveBeenCalled();
    expect(sdk.stopSessionRecording).toHaveBeenCalledOnce();
    client.setContext({
      authState: "authenticated",
      pathname: "/",
      userId: 42,
    });
    expect(sdk.startSessionRecording).toHaveBeenCalledTimes(2);
  });

  it("같은 회원 새로고침은 유지하고 다른 회원으로 전환하면 reset 후 identify한다", () => {
    const { sdk, client } = setup("bibbidi:user:42");
    client.setContext({
      authState: "authenticated",
      pathname: "/",
      userId: 42,
    });
    expect(sdk.identify).not.toHaveBeenCalled();
    client.setContext({
      authState: "authenticated",
      pathname: "/",
      userId: 84,
    });
    expect(sdk.reset).toHaveBeenCalledExactlyOnceWith(true);
    expect(sdk.identify).toHaveBeenCalledExactlyOnceWith("bibbidi:user:84");
    expect(sdk.reset.mock.invocationCallOrder[0]).toBeLessThan(
      sdk.identify.mock.invocationCallOrder[0],
    );
  });

  it("비로그인 방문자도 브라우저 단위로 구분해 유입 캠페인과 함께 기록한다", () => {
    const { sdk, client } = setup();
    client.setContext({ authState: "guest", pathname: "/" });
    client.track({
      name: "page_view",
      parameters: { page_location: "http://localhost:3000/", page_path: "/" },
    });
    const config = sdk.init.mock.calls[0][1] as PostHogConfig;
    expect(config.persistence).toBe("localStorage");
    expect(config.person_profiles).toBe("always");
    expect(config.save_campaign_params).toBe(true);
    expect(config.save_referrer).toBe(true);
    expect(sdk.capture).toHaveBeenCalledWith(
      "$pageview",
      expect.objectContaining({ auth_state: "guest" }),
    );
    expect(sdk.startSessionRecording).toHaveBeenCalled();
    expect(sdk.register).toHaveBeenCalledWith({
      environment: "test",
      app_version: "test-sha",
    });
  });

  it("기존 회원이 게스트가 되면 한 번만 reset하고 익명 탐색을 유지한다", () => {
    const { sdk, client } = setup("bibbidi:user:42");
    client.setContext({ authState: "guest", pathname: "/login" });
    client.setContext({ authState: "guest", pathname: "/" });
    expect(sdk.reset).toHaveBeenCalledOnce();
  });

  it("로그아웃은 이전 회원의 이벤트 이후 reset하고 늦은 이벤트는 버린다", () => {
    const { sdk, client } = setup("bibbidi:user:42");
    client.setContext({
      authState: "authenticated",
      pathname: "/",
      userId: 42,
    });
    client.track({ name: "logout", parameters: {} });
    client.reset();
    client.track({ name: "appointment_create", parameters: {} });
    expect(sdk.capture).toHaveBeenCalledOnce();
    expect(sdk.capture.mock.invocationCallOrder[0]).toBeLessThan(
      sdk.reset.mock.invocationCallOrder[0],
    );
  });

  it("콜백은 녹화하지 않고 인증 확인 중에도 정제된 실패만 익명으로 기록한다", () => {
    window.history.replaceState(
      null,
      "",
      "/auth/kakao?code=secret&state=secret",
    );
    const { sdk, client } = setup("bibbidi:user:42");
    client.setContext({ authState: "loading", pathname: "/auth/kakao" });
    client.track(page);
    client.track({
      name: "social_login_callback_failed",
      parameters: { provider: "kakao", failure_kind: "cancelled" },
    });
    expect(sdk.capture).toHaveBeenCalledOnce();
    expect(sdk.reset).toHaveBeenCalledOnce();
    expect(sdk.startSessionRecording).not.toHaveBeenCalled();
    const config = sdk.init.mock.calls[0][1] as PostHogConfig;
    const beforeSend = config.before_send;
    if (typeof beforeSend !== "function")
      throw new Error("before_send missing");
    expect(
      beforeSend({ event: "$snapshot", uuid: "test", properties: {} }),
    ).toBeNull();
    expect(config.disable_session_recording).toBe(true);
  });

  it("SDK 장애가 기존 GA나 제품 호출을 막지 않는다", () => {
    const { sdk } = setup();
    sdk.init.mockImplementation(() => {
      throw new Error("blocked SDK");
    });
    const ga = { initialize: vi.fn(), track: vi.fn() };
    const client = createAnalyticsClient([
      createPostHogProvider(options, sdk),
      ga,
    ]);
    expect(() => {
      client.initialize();
      client.setContext({ authState: "guest", pathname: "/" });
      client.track(page);
      client.reset();
    }).not.toThrow();
    expect(ga.track).toHaveBeenCalledWith(page);
  });
});
