import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FeedbackFeature } from "./FeedbackFeature";

function setMobileViewport(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      addEventListener: () => undefined,
      matches,
      removeEventListener: () => undefined,
    }),
  });
}

function openFeedback() {
  fireEvent.click(screen.getByRole("button", { name: "의견 보내기" }));
}

function getSubmitButton() {
  return within(screen.getByRole("dialog")).getByRole("button", {
    name: "의견 보내기",
  }) as HTMLButtonElement;
}

describe("FeedbackFeature", () => {
  it("만족도를 선택하기 전에는 제출할 수 없다", () => {
    render(<FeedbackFeature />);
    openFeedback();

    expect(getSubmitButton().disabled).toBe(true);
  });

  it("의견 입력을 200자로 제한한다", () => {
    render(<FeedbackFeature />);
    openFeedback();

    expect(
      screen.getByLabelText("의견을 들려주세요").getAttribute("maxlength"),
    ).toBe("200");
  });

  it("만족도를 선택하면 제출할 수 있다", () => {
    render(<FeedbackFeature />);
    openFeedback();

    fireEvent.click(screen.getByRole("button", { name: "좋았어요" }));

    expect(getSubmitButton().disabled).toBe(false);
  });

  it("제출하면 폼을 닫고 성공 Snackbar를 표시한다", () => {
    render(<FeedbackFeature />);
    openFeedback();

    fireEvent.click(screen.getByRole("button", { name: "아쉬워요" }));
    fireEvent.click(getSubmitButton());

    expect(screen.getByText("소중한 의견을 보내주셔서 감사해요.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Escape 키로 닫고 플로팅 버튼에 포커스를 돌려준다", () => {
    render(<FeedbackFeature />);
    openFeedback();

    fireEvent.keyDown(document, { key: "Escape" });

    const trigger = screen.getByRole("button", { name: "의견 보내기" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("모바일에서는 Bottom Sheet를 열고 배경 스크롤을 잠근다", () => {
    setMobileViewport(true);
    render(<FeedbackFeature />);
    openFeedback();

    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(
      screen.getAllByRole("button", { name: "피드백 창 닫기" })[0],
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "의견 보내기" }),
    );
  });
});
