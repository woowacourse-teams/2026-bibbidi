import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LandingAiChatScene } from "./LandingAiChatScene";

afterEach(() => vi.unstubAllGlobals());

describe("LandingAiChatScene", () => {
  it("화면에 들어온 활성 AI 장면에서만 대화 연출을 시작한다", () => {
    let notify: IntersectionObserverCallback;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          notify = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const { rerender, unmount } = render(
      <LandingAiChatScene active motionDisabled={false} />,
    );
    const scene = screen.getByRole("region", {
      name: "AI 대화와 추천 카드 예시",
    });
    expect(scene.classList.contains("landing-chat-playing")).toBe(false);
    act(() =>
      notify(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    expect(scene.classList.contains("landing-chat-playing")).toBe(true);
    rerender(<LandingAiChatScene active={false} motionDisabled={false} />);
    expect(scene.classList.contains("landing-chat-playing")).toBe(false);
    rerender(<LandingAiChatScene active motionDisabled={false} />);
    expect(scene.classList.contains("landing-chat-playing")).toBe(true);
    act(() =>
      notify(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    expect(scene.classList.contains("landing-chat-playing")).toBe(false);
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
