import { describe, expect, it, vi } from "vitest";
import {
  AnalyticsEvent,
  AnalyticsProvider,
  createAnalyticsClient,
} from "./analytics";

const event: AnalyticsEvent = {
  name: "test_event",
  parameters: { source: "test" },
};

function createProvider(): AnalyticsProvider {
  return {
    initialize: vi.fn(),
    track: vi.fn(),
  };
}

describe("createAnalyticsClient", () => {
  it("등록된 모든 Provider를 초기화하고 이벤트를 전달한다", () => {
    const firstProvider = createProvider();
    const secondProvider = createProvider();
    const client = createAnalyticsClient([firstProvider, secondProvider]);

    client.initialize();
    client.track(event);

    expect(firstProvider.initialize).toHaveBeenCalledOnce();
    expect(secondProvider.initialize).toHaveBeenCalledOnce();
    expect(firstProvider.track).toHaveBeenCalledWith(event);
    expect(secondProvider.track).toHaveBeenCalledWith(event);
  });

  it("한 Provider가 실패해도 다른 Provider에 이벤트를 전달한다", () => {
    const failedProvider: AnalyticsProvider = {
      initialize: vi.fn(() => {
        throw new Error("초기화 실패");
      }),
      track: vi.fn(() => {
        throw new Error("전송 실패");
      }),
    };
    const availableProvider = createProvider();
    const client = createAnalyticsClient([failedProvider, availableProvider]);

    expect(() => client.initialize()).not.toThrow();
    expect(() => client.track(event)).not.toThrow();
    expect(availableProvider.initialize).toHaveBeenCalledOnce();
    expect(availableProvider.track).toHaveBeenCalledWith(event);
  });

  it("등록된 Provider가 없어도 안전하게 동작한다", () => {
    const client = createAnalyticsClient([]);

    expect(() => client.initialize()).not.toThrow();
    expect(() => client.track(event)).not.toThrow();
  });
});
