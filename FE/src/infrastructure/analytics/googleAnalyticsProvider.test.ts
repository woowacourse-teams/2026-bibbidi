import { afterEach, describe, expect, it, vi } from "vitest";
import { createGoogleAnalyticsProvider } from "./googleAnalyticsProvider";

describe("createGoogleAnalyticsProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
    expect(googleTag).toHaveBeenNthCalledWith(2, "config", "G-TEST");
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
    ]);
    expect(Array.from(commands[2] as ArrayLike<unknown>)).toEqual([
      "event",
      "test_event",
      { source: "test" },
    ]);
  });
});
