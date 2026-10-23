import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installMatchMedia } from "../../test/matchMedia";
import { LandingFeature } from "./LandingFeature";
import { LANDING_REDUCED_MOTION_QUERY } from "./useLandingMotion";

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingFeature />
    </MemoryRouter>,
  );
}

function featureIntro() {
  return within(screen.getByRole("region", { name: "비비디 기능 소개" }));
}

beforeEach(() => {
  installMatchMedia(LANDING_REDUCED_MOTION_QUERY, false);
  vi.stubGlobal("scrollTo", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("LandingFeature", () => {
  it("실제 헤더 높이가 바뀌면 기능 소개 이동 위치도 함께 조정한다", () => {
    renderLanding();
    const header = screen.getByRole("navigation", { name: "랜딩 메뉴" });
    const feature = screen.getByRole("region", { name: "비비디 기능 소개" });
    const headerRect = vi.spyOn(header, "getBoundingClientRect");
    headerRect.mockReturnValue({
      ...header.getBoundingClientRect(),
      height: 100,
    });
    vi.spyOn(feature, "getBoundingClientRect").mockReturnValue({
      ...feature.getBoundingClientRect(),
      top: 1000,
    });
    Object.defineProperty(feature, "offsetHeight", { value: 1800 });
    vi.stubGlobal("innerHeight", 900);
    vi.stubGlobal("scrollY", 200);

    const firstStep = featureIntro().getByRole("button", {
      name: /AI에게 질문/,
    });
    fireEvent.click(firstStep);
    expect(window.scrollTo).toHaveBeenLastCalledWith({
      top: 1140,
      behavior: "smooth",
    });

    headerRect.mockReturnValue({
      ...header.getBoundingClientRect(),
      height: 150,
    });
    fireEvent.click(firstStep);
    expect(window.scrollTo).toHaveBeenLastCalledWith({
      top: 1092,
      behavior: "smooth",
    });
  });

  it("실제 화면 캡처를 소개하고 시작 버튼을 준비 목록으로 연결한다", () => {
    renderLanding();
    expect(
      screen.getByRole("main", { name: "비비디 서비스 소개" }),
    ).toBeTruthy();
    screen.getAllByRole("link", { name: /준비 시작하기/ }).forEach((link) => {
      expect(link.getAttribute("href")).toBe("/preparation");
    });
    expect(
      screen.getByRole("img", { name: /실제 모바일 준비 로드맵/ }),
    ).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "AI 대화와 추천 카드 예시" }),
    ).toBeTruthy();
    expect(
      within(
        screen.getByRole("region", { name: "AI 대화와 추천 카드 예시" }),
      ).getAllByRole("article"),
    ).toHaveLength(2);
    expect(screen.queryByRole("img", { name: /체크리스트 화면/ })).toBeNull();
    expect(
      screen.getByText("실제 서비스 화면 · AI 대화와 추천 카드는 예시입니다."),
    ).toBeTruthy();
  });

  it("움직임을 끈 상태에서도 기능 버튼으로 실제 화면을 선택할 수 있다", () => {
    renderLanding();
    fireEvent.click(screen.getByRole("button", { name: "움직임 끄기" }));
    expect(
      screen
        .getByRole("button", { name: "움직임 켜기" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(featureIntro().getByRole("button", { name: /체크리스트/ }));
    expect(
      screen.getByRole("heading", { name: /필요한 준비만,\s*하나씩 끝내요\./ }),
    ).toBeTruthy();
    expect(screen.getByRole("img", { name: /체크리스트 화면/ })).toBeTruthy();
    expect(
      screen.queryByRole("region", { name: "AI 대화와 추천 카드 예시" }),
    ).toBeNull();
    fireEvent.click(featureIntro().getByRole("button", { name: /캘린더/ }));
    expect(screen.getByRole("img", { name: /캘린더 화면/ })).toBeTruthy();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("대화 연출을 다시 재생하고 움직임을 끄면 전체 대화를 바로 보여준다", () => {
    renderLanding();
    const scene = screen.getByRole("region", {
      name: "AI 대화와 추천 카드 예시",
    });
    fireEvent.click(
      screen.getByRole("button", { name: "대화 연출 다시 보기" }),
    );
    const replayedScene = screen.getByRole("region", {
      name: "AI 대화와 추천 카드 예시",
    });
    expect(replayedScene).not.toBe(scene);
    fireEvent.click(screen.getByRole("button", { name: "움직임 끄기" }));
    expect(replayedScene.classList.contains("landing-chat-animated")).toBe(
      false,
    );
    expect(
      screen.queryByRole("button", { name: "대화 연출 다시 보기" }),
    ).toBeNull();
    expect(within(replayedScene).getAllByRole("article")).toHaveLength(2);
  });

  it("기기의 움직임 최소화 설정 변경을 반영하고 자동 모션을 중단한다", () => {
    const media = installMatchMedia(LANDING_REDUCED_MOTION_QUERY, false);
    renderLanding();
    act(() => media.setMatches(true));
    const toggle = screen.getByRole("button", {
      name: "기기 설정: 움직임 최소화",
    });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect((toggle as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(featureIntro().getByRole("button", { name: /캘린더/ }));
    expect(
      screen.getByRole("heading", {
        name: /해야 할 일이,\s*예정된 하루가 되도록\./,
      }),
    ).toBeTruthy();
    expect(window.scrollTo).not.toHaveBeenCalled();
    act(() => media.setMatches(false));
    expect(screen.getByRole("button", { name: "움직임 끄기" })).toBeTruthy();
  });

  it("페이지를 떠나면 모션 이벤트와 관찰자를 정리한다", () => {
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect = disconnect;
      },
    );
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const cancelFrame = vi.spyOn(window, "cancelAnimationFrame");
    const { unmount } = renderLanding();
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(2);
    expect(removeEventListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
    );
    expect(removeEventListener).toHaveBeenCalledWith(
      "resize",
      expect.any(Function),
    );
    expect(removeEventListener).toHaveBeenCalledWith(
      "wheel",
      expect.any(Function),
    );
    expect(cancelFrame).toHaveBeenCalled();
  });
});
